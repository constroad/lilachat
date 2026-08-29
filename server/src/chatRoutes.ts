import { Router } from 'express';
import { Types } from 'mongoose';
import { ChatModel } from './chatModels.js';
import { DeviceModel, UserModel } from './models.js';
import {
  ForbiddenChatError,
  addMember,
  leaveChat,
  listChats,
  listMessages,
  markRead,
} from './chatService.js';
import { toClientMessages } from './messageView.js';
import { avisarCambioDeChat } from './socket.js';
import { requireSession } from './requireSession.js';

/**
 * REST de chats: el arranque de la app (lista e historial). El tiempo real va
 * por el socket, pero el historial paginado no: pedirle 50 mensajes viejos a un
 * socket es peor que un GET que se cachea y se reintenta solo.
 */
export function buildChatRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/', async (req, res) => {
    res.json({ chats: await listChats(req.session!.userId) });
  });

  router.post('/', async (req, res) => {
    const kind = req.body?.kind === 'group' ? 'group' : 'direct';
    const rawMembers = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];
    const memberIds = rawMembers
      .map((value: unknown) => String(value))
      .filter((value: string) => Types.ObjectId.isValid(value))
      .map((value: string) => new Types.ObjectId(value));

    // El creador SIEMPRE va adentro, aunque no se haya incluido: un chat sin su
    // autor es un chat que nadie puede abrir.
    const me = req.session!.userId;
    const unique = new Map<string, Types.ObjectId>([[String(me), me]]);
    for (const id of memberIds) unique.set(String(id), id);
    if (unique.size < 2) {
      return res.status(400).json({ message: 'Elige con quién quieres hablar.' });
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

    // UN GRUPO SIN NOMBRE NO ES USABLE: la lista lo mostraría sin título y no
    // habría forma de distinguirlo de los demás.
    if (kind === 'group' && !name) {
      return res.status(400).json({ message: 'Ponle un nombre al grupo.' });
    }

    // EL 1:1 NO SE DUPLICA.
    //
    // Tocar dos veces a la misma persona desde «nuevo chat» tiene que llevar a
    // la MISMA conversación. Sin esto los mensajes quedan repartidos entre dos
    // chats con la misma persona y no hay forma de juntarlos después.
    //
    // Los GRUPOS sí se repiten a propósito: «Cumpleaños» y «Viaje» con la misma
    // gente son dos conversaciones legítimas.
    if (kind === 'direct') {
      const ids = [...unique.values()];
      const existente = await ChatModel.findOne({
        kind: 'direct',
        'members.userId': { $all: ids },
        members: { $size: ids.length },
      })
        .select('_id')
        .lean();
      if (existente) return res.status(201).json({ chatId: String(existente._id) });
    }

    const chat = await ChatModel.create({
      kind,
      // Se decide AL CREAR y no se puede cambiar después: un chat que a veces
      // cifra y a veces no da una promesa que nadie puede sostener (F9).
      encrypted: req.body?.encrypted === true,
      name: name || undefined,
      members: [...unique.values()].map((userId) => ({
        userId,
        role: String(userId) === String(me) ? 'admin' : 'member',
      })),
      lastSeq: 0,
    });
    res.status(201).json({ chatId: String(chat._id) });
  });

  /**
   * El detalle de una conversación: quiénes están y con qué rol.
   *
   * Existe para la pantalla «Chat Detail» del diseño
   * (`design/stitch/info-grupo-alpha.png`), que estaba diseñada y sin
   * implementar. `GET /api/chats` da los `memberIds` pero no los nombres, así
   * que la pantalla no tenía con qué dibujar la lista.
   *
   * **Devuelve el teléfono de cada miembro** por el mismo motivo que el resumen
   * del chat (§ del nombre de contacto): el server solo conoce el nombre que
   * cada uno se puso, y el que importa —el de TU agenda— solo lo puede resolver
   * el teléfono. No filtra nada nuevo: son las personas con las que ya compartís
   * una conversación.
   */
  router.get('/:chatId/detail', async (req, res) => {
    const userId = new Types.ObjectId(req.session!.userId);
    // La membresía primero: sin esto se podría sondear la existencia de chats
    // ajenos por la diferencia entre «no existe» y «no permitido».
    const chat = await ChatModel.findOne({
      _id: req.params.chatId,
      'members.userId': userId,
    }).lean();
    if (!chat) return res.status(404).json({ message: 'No encontramos esa conversación.' });

    const ids = chat.members.map((m) => m.userId);
    const personas = await UserModel.find({ _id: { $in: ids } })
      .select('name phone')
      .lean<{ _id: unknown; name?: string; phone: string }[]>();
    const porId = new Map(personas.map((persona) => [String(persona._id), persona]));

    return res.json({
      id: String(chat._id),
      kind: chat.kind,
      name: chat.name,
      encrypted: chat.encrypted === true,
      members: chat.members.map((m) => {
        const persona = porId.get(String(m.userId));
        return {
          id: String(m.userId),
          name: persona?.name ?? null,
          phone: persona?.phone ?? null,
          role: m.role ?? 'member',
          esYo: String(m.userId) === String(userId),
        };
      }),
    });
  });

  /**
   * Sumar a alguien a un grupo.
   *
   * Existe desde el 29/08/2026: la pantalla de detalle tenía el botón «Añadir»
   * apagado, y no era pereza de UI — **el server no sabía hacerlo**. Un botón
   * inerte y una capacidad inexistente se ven igual desde afuera, que es la
   * trampa de dejar botones apagados «por ahora».
   */
  router.post('/:chatId/members', async (req, res) => {
    const userId = new Types.ObjectId(req.session!.userId);
    const aQuien = String(req.body?.userId ?? '').trim();
    if (!aQuien) return res.status(400).json({ message: 'Falta a quién sumar.' });
    if (!Types.ObjectId.isValid(aQuien)) {
      return res.status(400).json({ message: 'No encontramos a esa persona.' });
    }

    const r = await addMember({ chatId: req.params.chatId!, quien: userId, aQuien });
    // El motivo VIAJA: un «no» mudo en una pantalla de permisos se lee como que
    // la app se colgó, y acá los motivos son accionables («ya está en el grupo»).
    if (!r.ok) return res.status(400).json({ message: r.motivo });

    // A todos los miembros, incluido el nuevo: su lista de chats tiene que
    // mostrarle el grupo sin que tenga que reabrir la app.
    for (const miembro of r.chat.members) {
      avisarCambioDeChat(String(miembro.userId), String(r.chat._id));
    }
    return res.status(200).json({ ok: true });
  });

  /**
   * Salir de un grupo.
   *
   * Si se va el último admin, `leaveChat` promueve al miembro más antiguo: sin
   * eso queda un grupo que nadie puede administrar nunca más.
   */
  router.post('/:chatId/leave', async (req, res) => {
    const userId = new Types.ObjectId(req.session!.userId);
    const r = await leaveChat({ chatId: req.params.chatId!, quien: userId });
    if (!r.ok) return res.status(400).json({ message: r.motivo });

    // A los que quedan Y a quien se fue: su lista tiene que dejar de mostrarlo.
    for (const id of [...r.miembrosRestantes, String(userId)]) {
      avisarCambioDeChat(id, req.params.chatId!);
    }
    return res.status(200).json({ ok: true });
  });

  router.get('/:chatId/messages', async (req, res) => {
    try {
      const beforeSeq = Number(req.query.beforeSeq);
      const messages = await listMessages({
        chatId: String(req.params.chatId),
        userId: req.session!.userId,
        limit: Number(req.query.limit) || undefined,
        beforeSeq: Number.isFinite(beforeSeq) && beforeSeq > 0 ? beforeSeq : undefined,
      });
      res.json({ messages: toClientMessages(messages) });
    } catch (error) {
      if (error instanceof ForbiddenChatError) {
        return res.status(403).json({ message: error.message });
      }
      throw error;
    }
  });

  router.post('/:chatId/read', async (req, res) => {
    const seq = Number(req.body?.seq);
    if (!Number.isFinite(seq) || seq < 0) {
      return res.status(400).json({ message: 'Falta hasta dónde leíste.' });
    }
    try {
      await markRead({ chatId: String(req.params.chatId), userId: req.session!.userId, seq });
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof ForbiddenChatError) {
        return res.status(403).json({ message: error.message });
      }
      throw error;
    }
  });

  /**
   * El token de push del teléfono. Va contra el DEVICE de la sesión, no contra
   * el usuario: cada aparato tiene el suyo, y notificar al token de un teléfono
   * que se cambió de dueño es peor que no notificar.
   */
  router.post('/push-token', async (req, res) => {
    const pushToken = String(req.body?.pushToken ?? '').trim();
    if (!pushToken) return res.status(400).json({ message: 'Falta el token.' });
    await DeviceModel.updateOne(
      { deviceId: req.session!.deviceId },
      { $set: { pushToken, platform: 'android' } }
    );
    res.json({ ok: true });
  });

  return router;
}
