import { Router } from 'express';
import { Types } from 'mongoose';
import { formatBytes } from '@lilachat/shared';
import { backupStatus, runBackup } from './backupRunner.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { UserModel } from './models.js';

/**
 * Respaldo y export (F7).
 *
 * **La membresía del chat es el permiso**, igual que en todo el resto del
 * sistema. Acá pesa más que en ningún otro lado: el export devuelve la
 * conversación ENTERA en un request, así que un permiso mal puesto no filtra un
 * dato — filtra un chat completo.
 */
let corriendo = false;

/**
 * El nombre del archivo descargado, a prueba del nombre del chat.
 *
 * **Esto tumbó el server en el E2E de F7.** El nombre iba directo a la cabecera
 * y un chat llamado «QA-F7 — borrar» —un guion largo— hizo que Node rechazara
 * el header con `ERR_INVALID_CHAR`. Como el throw ocurre dentro de un handler
 * async de Express 4, nadie lo atrapa: el proceso ENTERO se muere. Cualquiera
 * podía voltear el servidor poniéndole una tilde o un emoji al nombre de su
 * chat y tocando exportar.
 *
 * La cabecera lleva las dos formas: `filename` en ASCII para clientes viejos y
 * `filename*` en UTF-8 (RFC 5987) para los que sí saben leerlo. Y se recortan
 * los saltos de línea, que serían inyección de cabeceras.
 */
export function contentDisposition(name: string): string {
  const limpio = name.replace(/[\r\n"]/g, ' ').trim().slice(0, 60) || 'conversacion';
  const ascii = limpio.replace(/[^\x20-\x7E]/g, '_');
  return `attachment; filename="lilachat-${ascii}.json"; filename*=UTF-8''${encodeURIComponent(
    `lilachat-${limpio}.json`
  )}`;
}

export function buildBackupRouter(): Router {
  const router = Router();

  router.get('/', requireSession, asyncRoute(async (_req, res) => {
    const estado = await backupStatus();
    res.json({ ...estado, totalLabel: formatBytes(estado.totalBytes) });
  }));

  /**
   * Disparar un respaldo a mano («Respaldar ahora» del diseño).
   *
   * Con candado en memoria: dos toques seguidos lanzarían dos `mongodump` a la
   * vez sobre la misma base y el disco de la mini pagaría el doble por nada. El
   * segundo recibe 409, que la pantalla lee como «ya está corriendo».
   */
  router.post('/run', requireSession, asyncRoute(async (_req, res) => {
    if (corriendo) {
      res.status(409).json({ message: 'Ya hay un respaldo en curso.' });
      return;
    }
    corriendo = true;
    try {
      const resultado = await runBackup();
      res.json({
        name: resultado.name,
        sizeBytes: resultado.sizeBytes,
        sizeLabel: formatBytes(resultado.sizeBytes),
        mediaCount: resultado.mediaCount,
        removed: resultado.removed.length,
      });
    } catch (error) {
      // El motivo va al log del server, no al cliente: lleva rutas y la URI.
      console.error('[backup] falló:', error instanceof Error ? error.message : error);
      res.status(500).json({ message: 'No se pudo completar el respaldo.' });
    } finally {
      corriendo = false;
    }
  }));

  /**
   * El export de UNA conversación, en JSON legible.
   *
   * Los remitentes salen con NOMBRE y no con `ObjectId`: quien abra este
   * archivo dentro de cinco años necesita leerlo, no cruzarlo contra otra
   * colección que quizá ya no exista.
   */
  router.get('/export/:chatId', requireSession, asyncRoute(async (req, res) => {
    // El id se lee a `string` ANTES de validarlo: con `noUncheckedIndexedAccess`
    // el parámetro de ruta es `string | undefined`, y pasarlo así al constructor
    // no compila.
    const crudo = String(req.params.chatId ?? '');
    const chatId = Types.ObjectId.isValid(crudo) ? new Types.ObjectId(crudo) : null;

    // Mismo 403 para «no existe» y «no sos miembro»: distinguirlos confirmaría
    // qué conversaciones existen.
    const chat = chatId
      ? await ChatModel.findOne({ _id: chatId, 'members.userId': req.session!.userId }).lean()
      : null;
    if (!chat) {
      res.status(403).json({ message: 'No tienes acceso a esa conversación.' });
      return;
    }

    const [messages, members] = await Promise.all([
      MessageModel.find({ chatId }).sort({ seq: 1 }).lean(),
      UserModel.find({ _id: { $in: chat.members.map((member) => member.userId) } })
        .select('name phone')
        .lean(),
    ]);

    const nombre = new Map(
      members.map((member) => [String(member._id), member.name ?? member.phone])
    );

    res.setHeader('Content-Disposition', contentDisposition(chat.name ?? 'conversacion'));
    res.json({
      exportedAt: new Date().toISOString(),
      chat: {
        id: String(chat._id),
        kind: chat.kind,
        name: chat.name ?? null,
        members: members.map((member) => member.name ?? member.phone),
      },
      messages: messages.map((message) => ({
        seq: message.seq,
        // `at`, no `createdAt`: el esquema no usa timestamps de mongoose. Con
        // el nombre equivocado, cada mensaje del export salía con la fecha en
        // `undefined` —y un export sin fechas no sirve para nada—.
        at: message.at,
        from: nombre.get(String(message.senderId)) ?? 'Desconocido',
        kind: message.kind,
        body: message.body ?? null,
        // La URL queda anotada: el binario vive en lila, y el export es de la
        // conversación, no del archivo.
        mediaUrl: message.media?.url ?? null,
      })),
    });
  }));

  return router;
}
