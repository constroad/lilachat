import { Router } from 'express';
import { Types } from 'mongoose';
import { ChatModel } from './chatModels.js';
import { textoDeRecordatorioEnElChat } from '@lilachat/shared';
import { ReminderModel, type Reminder } from './eventModels.js';
import type { MediaUploader } from './mediaClient.js';
import { buildLilaUploader, toAbsoluteMediaUrl } from './mediaClient.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { multerDeAvatar, subirFotoRedonda } from './subirAvatar.js';
import { publicarEnElChat } from './publicarEnElChat.js';
import { avisarCambioDeTarjeta } from './avisoDeTarjeta.js';

/**
 * Recordatorios del GRUPO (José, 19/10): viven en el grupo, los crean y
 * administran sus admins, llevan descripción e imagen, y a la hora le suenan a
 * todos. No aparecen en la agenda personal de nadie.
 */

const asObjectId = (valor: unknown): Types.ObjectId | null =>
  Types.ObjectId.isValid(String(valor)) ? new Types.ObjectId(String(valor)) : null;

type Rol = 'ajeno' | 'miembro' | 'admin';

/** Qué soy en ese chat, y si es un grupo. */
export async function rolEnElChat(chatId: unknown, userId: Types.ObjectId): Promise<{ esGrupo: boolean; rol: Rol; nombre?: string; miembros: string[] }> {
  const id = asObjectId(chatId);
  const chat = id ? await ChatModel.findById(id).select('kind name members.userId members.role').lean() : null;
  if (!chat) return { esGrupo: false, rol: 'ajeno', miembros: [] };
  const yo = chat.members.find((m) => String(m.userId) === String(userId));
  return {
    esGrupo: chat.kind === 'group',
    rol: !yo ? 'ajeno' : yo.role === 'admin' ? 'admin' : 'miembro',
    nombre: chat.name,
    miembros: chat.members.map((m) => String(m.userId)),
  };
}

/**
 * ¿Puedo editar o borrar este recordatorio? El personal, solo su dueño; el del
 * grupo, cualquier admin. `404` si no lo puedo ver; `403` si lo veo y no es mío.
 */
export async function permisoSobreRecordatorio(reminderId: unknown, userId: Types.ObjectId): Promise<{ estado: 200 | 403 | 404; recordatorio?: Reminder }> {
  const id = asObjectId(reminderId);
  const recordatorio = id ? await ReminderModel.findById(id).lean() : null;
  if (!recordatorio) return { estado: 404 };
  if (recordatorio.chatId) {
    const { esGrupo, rol } = await rolEnElChat(recordatorio.chatId, userId);
    if (esGrupo) return rol === 'admin' ? { estado: 200, recordatorio } : { estado: rol === 'miembro' ? 403 : 404 };
  }
  return String(recordatorio.userId) === String(userId) ? { estado: 200, recordatorio } : { estado: 404 };
}

/** Lo que la app recibe de un recordatorio del grupo: la imagen ya absoluta. */
const vista = (r: Reminder) => ({ ...r, ...(r.imageUrl ? { imageUrl: toAbsoluteMediaUrl(r.imageUrl) } : {}) });

export function buildRecordatoriosDeGrupoRouter(uploaderInyectado?: MediaUploader): Router {
  const uploader = uploaderInyectado ?? buildLilaUploader();
  const router = Router();
  router.use(requireSession);

  /** Los del grupo, para su detalle. Solo miembros; a un ajeno, 404. */
  router.get(
    '/reminders/del-chat/:chatId',
    asyncRoute(async (req, res) => {
      const { rol } = await rolEnElChat(req.params.chatId, req.session!.userId);
      if (rol === 'ajeno') return res.status(404).json({ message: 'No encontramos esa conversación.' });
      const reminders = await ReminderModel.find({ chatId: asObjectId(req.params.chatId) }).sort({ active: -1, startsAt: 1 }).lean();
      res.json({ reminders: reminders.map(vista) });
    })
  );

  /** Uno, para la tarjeta del chat. Solo miembros del chat (o su dueño, si es personal). */
  router.get(
    '/reminders/:reminderId',
    asyncRoute(async (req, res) => {
      const id = asObjectId(req.params.reminderId);
      const recordatorio = id ? await ReminderModel.findById(id).lean() : null;
      const visible = recordatorio?.chatId
        ? (await rolEnElChat(recordatorio.chatId, req.session!.userId)).rol !== 'ajeno'
        : String(recordatorio?.userId) === String(req.session!.userId);
      if (!recordatorio || !visible) return res.status(404).json({ message: 'Ese recordatorio no existe.' });
      res.json({ reminder: vista(recordatorio) });
    })
  );

  /** La imagen del recordatorio del grupo: se sube y se guarda en UN request, como la foto del grupo. */
  router.post(
    '/reminders/:reminderId/imagen',
    multerDeAvatar.single('file'),
    asyncRoute(async (req, res) => {
      const permiso = await permisoSobreRecordatorio(req.params.reminderId, req.session!.userId);
      if (permiso.estado !== 200) return res.status(permiso.estado).json({ message: 'No puedes cambiar ese recordatorio.' });
      const subida = await subirFotoRedonda({
        uploader,
        file: req.file,
        carpeta: String(permiso.recordatorio!.chatId ?? 'recordatorios'),
        nombrePorDefecto: 'recordatorio.jpg',
        siNoEsImagen: 'La imagen del recordatorio tiene que ser una imagen.',
      });
      if (!subida.ok) return res.status(subida.status).json({ message: subida.message });
      await ReminderModel.updateOne({ _id: permiso.recordatorio!._id }, { $set: { imageUrl: subida.url, imageMediaId: subida.mediaId } });
      res.json({ ok: true, imageUrl: toAbsoluteMediaUrl(subida.url) });
      void avisarCambioDeTarjeta({ chatId: permiso.recordatorio!.chatId, tipo: 'recordatorio', id: permiso.recordatorio!._id });
    })
  );

  /** Quitar la imagen al editar: solo un admin (o el dueño, si es personal). */
  router.delete(
    '/reminders/:reminderId/imagen',
    asyncRoute(async (req, res) => {
      const permiso = await permisoSobreRecordatorio(req.params.reminderId, req.session!.userId);
      if (permiso.estado !== 200) return res.status(permiso.estado).json({ message: 'No puedes cambiar ese recordatorio.' });
      await ReminderModel.updateOne({ _id: permiso.recordatorio!._id }, { $unset: { imageUrl: 1, imageMediaId: 1 } });
      res.status(204).end();
      void avisarCambioDeTarjeta({ chatId: permiso.recordatorio!.chatId, tipo: 'recordatorio', id: permiso.recordatorio!._id });
    })
  );

  /**
   * Sacar la tarjeta en el chat, cuando el recordatorio ya está completo (con
   * su imagen). Idempotente y atómico: dos toques o un reintento dejan UNA.
   * Si publicar falla, se suelta la marca para que el reintento pueda.
   */
  router.post(
    '/reminders/:reminderId/publicar',
    asyncRoute(async (req, res) => {
      const permiso = await permisoSobreRecordatorio(req.params.reminderId, req.session!.userId);
      if (permiso.estado !== 200) return res.status(permiso.estado).json({ message: 'No puedes publicar ese recordatorio.' });
      const recordatorio = permiso.recordatorio!;
      if (!recordatorio.chatId) return res.status(400).json({ message: 'Ese recordatorio no es de un grupo.' });
      const tomado = await ReminderModel.findOneAndUpdate({ _id: recordatorio._id, publicadoEn: null }, { $set: { publicadoEn: new Date() } });
      if (!tomado) return res.status(204).end();
      try {
        await publicarEnElChat({ chatId: String(recordatorio.chatId), autor: req.session!.userId, ref: { tipo: 'recordatorio', id: String(recordatorio._id) }, texto: textoDeRecordatorioEnElChat(recordatorio.title) });
      } catch (error) {
        await ReminderModel.updateOne({ _id: recordatorio._id }, { $set: { publicadoEn: null } });
        throw error;
      }
      res.status(204).end();
    })
  );

  return router;
}
