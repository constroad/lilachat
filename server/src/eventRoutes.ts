import { Router, type Response } from 'express';
import { Types } from 'mongoose';
import {
  applyVote,
  cambiosDeEvento,
  cambiosDeRecordatorio,
  textoDeEncuestaEnElChat,
  textoDeEventoEnElChat,
  validatePoll,
  type Recurrence,
} from '@lilachat/shared';
import { ChatModel } from './chatModels.js';
import { ForbiddenChatError } from './chatService.js';
import { EventModel, PollModel, ReminderModel } from './eventModels.js';
import { vistasDeEncuestas } from './vistaDeEncuesta.js';
import { vistasDeEventos } from './vistaDeEvento.js';
import { contactosDe } from './invitarAlEvento.js';
import { pasosDelVoto } from './votoDeEncuesta.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { publicarEnElChat } from './publicarEnElChat.js';

/**
 * Eventos, recordatorios y encuestas (F5).
 *
 * La membresía del chat es el ÚNICO permiso: quien puede escribir en la
 * conversación puede crear un evento o una encuesta ahí, y quien no, no ve
 * nada. Re-implementar permisos propios sería inventar una segunda verdad.
 */
/** Cuántos se suman de una vez a un evento: más que eso es una lista de difusión. */
const MAX_INVITADOS_POR_VEZ = 20;

const asObjectId = (value: unknown): Types.ObjectId | null =>
  Types.ObjectId.isValid(String(value)) ? new Types.ObjectId(String(value)) : null;

async function assertMember(chatId: unknown, userId: Types.ObjectId): Promise<Types.ObjectId> {
  const id = asObjectId(chatId);
  if (!id) throw new ForbiddenChatError();
  if (!(await ChatModel.exists({ _id: id, 'members.userId': userId }))) {
    throw new ForbiddenChatError();
  }
  return id;
}

/**
 * En un chat secreto el server no puede guardar eventos, encuestas ni avisos
 * cifrados: aceptarlos dejaba en claro lo que el candado promete esconder
 * (auditoría 17/10/2026). 403 permanente, con el motivo en palabras.
 */
class ChatSecretoError extends Error {
  constructor() {
    super('En un chat secreto todavía no se pueden crear eventos, encuestas ni avisos: no viajarían cifrados.');
  }
}

async function assertMemberNoSecreto(chatId: unknown, userId: Types.ObjectId): Promise<Types.ObjectId> {
  const id = await assertMember(chatId, userId);
  if (await ChatModel.exists({ _id: id, encrypted: true })) throw new ChatSecretoError();
  return id;
}

/** Los chats de los que soy miembro: el alcance de todo lo que se lista acá. */
async function myChatIds(userId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const chats = await ChatModel.find({ 'members.userId': userId }).select('_id').lean();
  return chats.map((chat) => chat._id);
}

/**
 * La encuesta, si existe y soy miembro de su chat. Si no, responde (404/403)
 * y devuelve null.
 */
async function encuestaDeMiembro(pollId: unknown, userId: Types.ObjectId, res: Response) {
  const id = asObjectId(pollId);
  const poll = id ? await PollModel.findById(id).lean() : null;
  if (!poll) {
    res.status(404).json({ message: 'Esa encuesta no existe.' });
    return null;
  }
  try {
    await assertMember(poll.chatId, userId);
  } catch {
    res.status(403).json({ message: 'No tienes acceso a esa encuesta.' });
    return null;
  }
  return poll;
}

async function vistaDeUna(pollId: Types.ObjectId, userId: Types.ObjectId) {
  const poll = await PollModel.findById(pollId).lean();
  return poll ? (await vistasDeEncuestas([poll], userId))[0] : null;
}

/** Un evento de un chat del que soy miembro; `null` si no existe o no lo veo. */
async function eventoVisible(eventId: unknown, userId: Types.ObjectId) {
  const id = asObjectId(eventId);
  if (!id) return null;
  const evento = await EventModel.findById(id).select('chatId createdBy startsAt').lean();
  if (!evento) return null;
  const esMiembro = await ChatModel.exists({ _id: evento.chatId, 'members.userId': userId });
  return esMiembro ? evento : null;
}

/**
 * Publicar en el chat no puede tumbar lo creado: la encuesta o el evento ya
 * existen y se ven en su pestaña. Si el mensaje falla, se registra.
 */
async function publicarSinTumbar(params: Parameters<typeof publicarEnElChat>[0]): Promise<void> {
  try {
    await publicarEnElChat(params);
  } catch (error) {
    console.error('[agenda] no se pudo publicar en el chat:', error instanceof Error ? error.message : error);
  }
}

/** `$set` y `$unset` juntos, sin mandar un operador vacío (Mongo lo rechaza). */
function actualizacion(set: object, unset: string[]): Record<string, object> {
  const operaciones: Record<string, object> = {};
  if (Object.keys(set).length > 0) operaciones.$set = set;
  if (unset.length > 0) operaciones.$unset = Object.fromEntries(unset.map((campo) => [campo, '']));
  return operaciones;
}

export function buildEventRouter(): Router {
  const router = Router();
  router.use(requireSession);

  // ─── Eventos ──────────────────────────────────────────────────────────────

  /**
   * Lo que me espera, para los contadores de las pestañas (José, 18/10): las
   * encuestas abiertas de mis chats en las que no voté y los eventos que vienen
   * y no respondí. Lo propio no cuenta. Dos conteos en paralelo, sin traer filas.
   */
  router.get('/pendientes', asyncRoute(async (req, res) => {
    const yo = req.session!.userId;
    const chatIds = await myChatIds(yo);
    const [encuestas, eventos] = await Promise.all([
      PollModel.countDocuments({ chatId: { $in: chatIds }, closedAt: null, createdBy: { $ne: yo }, 'options.votes': { $ne: yo } }),
      EventModel.countDocuments({
        startsAt: { $gte: new Date() },
        createdBy: { $ne: yo },
        attendees: { $elemMatch: { userId: yo, rsvp: null } },
      }),
    ]);
    res.json({ encuestas, eventos });
  }));

  /** Un evento por su id, para la tarjeta del chat. Quien no lo ve, 404. */
  router.get('/events/:eventId', asyncRoute(async (req, res) => {
    const yo = req.session!.userId;
    const id = asObjectId(req.params.eventId);
    const evento = id ? await EventModel.findById(id).lean() : null;
    const loVeo = evento && (evento.attendees.some((a) => a.userId.equals(yo)) || (await ChatModel.exists({ _id: evento.chatId, 'members.userId': yo })));
    if (!evento || !loVeo) return res.status(404).json({ message: 'Ese evento no existe.' });
    const chatIds = await myChatIds(yo);
    const [vista] = await vistasDeEventos([evento], yo, new Set(chatIds.map(String)));
    res.json({ event: vista });
  }));

  router.get('/events', asyncRoute(async (req, res) => {
    const chatIds = await myChatIds(req.session!.userId);
    // Solo los que vienen: la pantalla es «qué se viene», no un archivo. Los
    // de mis chats y aquellos a los que me invitaron de afuera (FL10).
    const events = await EventModel.find({
      $or: [{ chatId: { $in: chatIds } }, { 'attendees.userId': req.session!.userId }],
      startsAt: { $gte: new Date(Date.now() - 6 * 3_600_000) },
    })
      .sort({ startsAt: 1 })
      .limit(100)
      .lean();

    // Quién lo creó, quiénes van y en qué chat, para todos (FL10).
    res.json({ events: await vistasDeEventos(events, req.session!.userId, new Set(chatIds.map(String))) });
  }));

  /**
   * Sumar gente a un evento (FL10). Quien lo creó, siempre; los demás, solo
   * con «Pueden invitar a otros». Se invita a CONTACTOS de quien invita (con
   * un chat en común): un id cualquiera no entra.
   */
  router.post('/events/:eventId/invitar', asyncRoute(async (req, res) => {
    const yo = req.session!.userId;
    const eventId = asObjectId(req.params.eventId);
    const evento = eventId ? await EventModel.findById(eventId).lean() : null;
    const loVeo = evento && (evento.attendees.some((a) => a.userId.equals(yo)) || (await ChatModel.exists({ _id: evento.chatId, 'members.userId': yo })));
    if (!evento || !loVeo) return res.status(404).json({ message: 'Ese evento no existe.' });
    if (!evento.createdBy.equals(yo) && !evento.guestsCanInvite) {
      return res.status(403).json({ message: 'Solo quien creó el evento puede invitar.' });
    }
    const pedidos = Array.isArray(req.body?.userIds) ? req.body.userIds.map(String).slice(0, MAX_INVITADOS_POR_VEZ) : [];
    const yaVan = new Set(evento.attendees.map((a) => String(a.userId)));
    const nuevos = pedidos.filter((id: string) => !yaVan.has(id));
    const contactos = await contactosDe(yo, nuevos);
    if (contactos.length < nuevos.length) return res.status(400).json({ message: 'Solo puedes invitar a tus contactos de Lilachat.' });
    if (contactos.length > 0) {
      await EventModel.updateOne(
        { _id: evento._id },
        { $push: { attendees: { $each: contactos.map((userId) => ({ userId, invitedBy: yo })) } } }
      );
    }
    res.json({ ok: true, agregados: contactos.length });
  }));

  router.post('/events', asyncRoute(async (req, res) => {
    try {
      const chatId = await assertMemberNoSecreto(req.body?.chatId, req.session!.userId);
      const title = String(req.body?.title ?? '').trim();
      const startsAt = new Date(String(req.body?.startsAt ?? ''));
      if (!title) return res.status(400).json({ message: 'Ponle un nombre al evento.' });
      if (Number.isNaN(startsAt.getTime())) {
        return res.status(400).json({ message: 'Elige cuándo es.' });
      }

      // Los invitados salen de los MIEMBROS del chat, no de una lista que
      // manda el cliente: así nadie invita a alguien ajeno a la conversación.
      const chat = await ChatModel.findById(chatId).select('members.userId').lean();
      const event = await EventModel.create({
        chatId,
        title,
        description: String(req.body?.description ?? '').trim() || undefined,
        startsAt,
        endsAt: req.body?.endsAt ? new Date(String(req.body.endsAt)) : undefined,
        location: String(req.body?.location ?? '').trim() || undefined,
        createdBy: req.session!.userId,
        attendees: (chat?.members ?? []).map((member) => ({
          userId: member.userId,
          // Quien lo crea va como confirmado: no tiene sentido preguntarle.
          rsvp: String(member.userId) === String(req.session!.userId) ? 'yes' : undefined,
        })),
        remindMinutesBefore: Number(req.body?.remindMinutesBefore) || 60,
        // El interruptor «Avisar 1 hora antes»: antes se mandaba y se ignoraba.
        remindGuests: req.body?.remindGuests !== false,
        guestsCanInvite: req.body?.guestsCanInvite === true,
      });
      // Al chat, como WhatsApp (18/10): si no, nadie se entera del evento.
      await publicarSinTumbar({ chatId: String(chatId), autor: req.session!.userId, ref: { tipo: 'evento', id: String(event._id) }, texto: textoDeEventoEnElChat(title) });
      res.status(201).json({ id: String(event._id) });
    } catch (error) {
      if (error instanceof ForbiddenChatError || error instanceof ChatSecretoError) {
        return res.status(403).json({ message: error.message });
      }
      throw error;
    }
  }));

  router.post('/events/:eventId/rsvp', asyncRoute(async (req, res) => {
    const rsvp = String(req.body?.rsvp ?? '');
    if (!['yes', 'no', 'maybe'].includes(rsvp)) {
      return res.status(400).json({ message: 'Respuesta inválida.' });
    }
    const eventId = asObjectId(req.params.eventId);
    if (!eventId) return res.status(404).json({ message: 'Ese evento no existe.' });

    // Se filtra por el asistente en la MISMA consulta: un evento ajeno no se
    // llega a leer, y responder por otro es imposible.
    const updated = await EventModel.updateOne(
      { _id: eventId, 'attendees.userId': req.session!.userId },
      { $set: { 'attendees.$.rsvp': rsvp } }
    );
    if (updated.matchedCount === 0) {
      // Quien entró al chat DESPUÉS de creado el evento no estaba en la foto
      // de invitados: si es miembro del chat, se suma con su respuesta (FL8).
      const evento = await eventoVisible(eventId, req.session!.userId);
      if (!evento) return res.status(403).json({ message: 'No estás invitado a ese evento.' });
      await EventModel.updateOne(
        { _id: eventId, 'attendees.userId': { $ne: req.session!.userId } },
        { $push: { attendees: { userId: req.session!.userId, rsvp } } }
      );
    }
    res.json({ ok: true });
  }));

  /**
   * Editar un evento: solo quien lo creó. Un invitado lo ve (403, no 404: ya
   * sabe que existe); alguien fuera del chat recibe 404. Las respuestas de los
   * invitados se conservan — cambiar la hora no borra quién dijo que iba.
   */
  router.patch('/events/:eventId', asyncRoute(async (req, res) => {
    const evento = await eventoVisible(req.params.eventId, req.session!.userId);
    if (!evento) return res.status(404).json({ message: 'Ese evento no existe.' });
    if (String(evento.createdBy) !== String(req.session!.userId)) {
      return res.status(403).json({ message: 'Solo quien creó el evento puede cambiarlo.' });
    }
    const cambios = cambiosDeEvento(req.body, { startsAt: evento.startsAt });
    if (!cambios.ok) return res.status(400).json({ message: cambios.message });
    await EventModel.updateOne({ _id: evento._id }, actualizacion(cambios.set, cambios.unset));
    res.json({ ok: true });
  }));

  router.delete('/events/:eventId', asyncRoute(async (req, res) => {
    const evento = await eventoVisible(req.params.eventId, req.session!.userId);
    if (!evento) return res.status(404).json({ message: 'Ese evento no existe.' });
    if (String(evento.createdBy) !== String(req.session!.userId)) {
      return res.status(403).json({ message: 'Solo quien creó el evento puede cancelarlo.' });
    }
    await EventModel.deleteOne({ _id: evento._id });
    res.json({ ok: true });
  }));

  // ─── Recordatorios ────────────────────────────────────────────────────────

  router.get('/reminders', asyncRoute(async (req, res) => {
    const chatIds = await myChatIds(req.session!.userId);
    const [mine, shared] = await Promise.all([
      ReminderModel.find({ userId: req.session!.userId, chatId: { $exists: false } })
        .sort({ startsAt: 1 })
        .lean(),
      // Los COMPARTIDOS son los de mis chats — incluidos los que creó otro.
      // Es la pestaña «Shared» del diseño.
      ReminderModel.find({ chatId: { $in: chatIds } }).sort({ startsAt: 1 }).lean(),
    ]);
    res.json({ mine, shared });
  }));

  router.post('/reminders', asyncRoute(async (req, res) => {
    const title = String(req.body?.title ?? '').trim();
    const startsAt = new Date(String(req.body?.startsAt ?? ''));
    if (!title) return res.status(400).json({ message: 'Escribe de qué es el recordatorio.' });
    if (Number.isNaN(startsAt.getTime())) return res.status(400).json({ message: 'Elige cuándo.' });

    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : undefined;
    const recurrence = String(req.body?.recurrence ?? 'once') as Recurrence;
    let chatId: Types.ObjectId | undefined;
    if (req.body?.chatId) {
      try {
        chatId = await assertMemberNoSecreto(req.body.chatId, req.session!.userId);
      } catch (error) {
        const mensaje = error instanceof ChatSecretoError ? error.message : 'No tienes acceso a esa conversación.';
        return res.status(403).json({ message: mensaje });
      }
    }

    const reminder = await ReminderModel.create({
      userId: req.session!.userId,
      chatId,
      title,
      note,
      startsAt,
      recurrence: ['once', 'daily', 'weekly'].includes(recurrence) ? recurrence : 'once',
    });
    res.status(201).json({ id: String(reminder._id) });
  }));

  /** El switch de cada tarjeta. Solo el dueño lo toca. */
  router.post('/reminders/:reminderId/toggle', asyncRoute(async (req, res) => {
    const reminderId = asObjectId(req.params.reminderId);
    if (!reminderId) return res.status(404).json({ message: 'No existe.' });
    const updated = await ReminderModel.updateOne(
      { _id: reminderId, userId: req.session!.userId },
      // Reactivar limpia el sello: si no, uno que ya sonó quedaba con el
      // interruptor prendido y sin volver a sonar nunca.
      req.body?.active !== false ? { $set: { active: true, remindedAt: null } } : { $set: { active: false } }
    );
    if (updated.matchedCount === 0) return res.status(403).json({ message: 'No es tuyo.' });
    res.json({ ok: true });
  }));

  /**
   * Editar o borrar un recordatorio: solo el dueño. A cualquier otro, 404 —
   * el mismo que si no existiera, sin diferencia que sondear.
   */
  router.patch('/reminders/:reminderId', asyncRoute(async (req, res) => {
    const reminderId = asObjectId(req.params.reminderId);
    const actual = reminderId
      ? await ReminderModel.findOne({ _id: reminderId, userId: req.session!.userId }).select('startsAt').lean()
      : null;
    if (!actual) return res.status(404).json({ message: 'Ese recordatorio no existe.' });
    const cambios = cambiosDeRecordatorio(req.body, { startsAt: actual.startsAt });
    if (!cambios.ok) return res.status(400).json({ message: cambios.message });
    await ReminderModel.updateOne({ _id: actual._id }, actualizacion(cambios.set, cambios.unset));
    res.json({ ok: true });
  }));

  router.delete('/reminders/:reminderId', asyncRoute(async (req, res) => {
    const reminderId = asObjectId(req.params.reminderId);
    const borrado = reminderId
      ? await ReminderModel.deleteOne({ _id: reminderId, userId: req.session!.userId })
      : { deletedCount: 0 };
    if (borrado.deletedCount === 0) return res.status(404).json({ message: 'Ese recordatorio no existe.' });
    res.json({ ok: true });
  }));

  // ─── Encuestas ────────────────────────────────────────────────────────────

  router.post('/polls', asyncRoute(async (req, res) => {
    try {
      const chatId = await assertMemberNoSecreto(req.body?.chatId, req.session!.userId);
      const question = String(req.body?.question ?? '');
      const options = Array.isArray(req.body?.options) ? req.body.options.map(String) : [];

      // La MISMA validación que usa la pantalla (motor compartido): si el
      // cliente aceptara algo que el server rechaza, el usuario llena el
      // formulario para que muera al enviar.
      const invalid = validatePoll({ question, options });
      if (invalid) return res.status(400).json({ message: invalid });

      const poll = await PollModel.create({
        chatId,
        question: question.trim(),
        options: options.map((text: string) => ({ text: text.trim(), votes: [] })).filter((o: { text: string }) => o.text),
        allowMultiple: req.body?.allowMultiple === true,
        anonymous: req.body?.anonymous === true,
        createdBy: req.session!.userId,
      });
      // Al chat, como WhatsApp (José, 18/10: «Wilson nunca se enteró»).
      await publicarSinTumbar({ chatId: String(chatId), autor: req.session!.userId, ref: { tipo: 'encuesta', id: String(poll._id) }, texto: textoDeEncuestaEnElChat(question) });
      res.status(201).json({ id: String(poll._id) });
    } catch (error) {
      if (error instanceof ForbiddenChatError || error instanceof ChatSecretoError) {
        return res.status(403).json({ message: error.message });
      }
      throw error;
    }
  }));

  /**
   * Una encuesta por su id: la tarjeta del mensaje en el chat la lee así. Para
   * quien no es del chat, 404 y no 403: no se confirma que exista.
   */
  router.get('/polls/:pollId', asyncRoute(async (req, res) => {
    const id = asObjectId(req.params.pollId);
    const poll = id ? await PollModel.findById(id).select('chatId').lean() : null;
    const esMiembro = poll && (await ChatModel.exists({ _id: poll.chatId, 'members.userId': req.session!.userId }));
    if (!poll || !esMiembro) return res.status(404).json({ message: 'Esa encuesta no existe.' });
    res.json({ poll: await vistaDeUna(poll._id, req.session!.userId) });
  }));

  router.get('/polls', asyncRoute(async (req, res) => {
    const chatIds = await myChatIds(req.session!.userId);
    const polls = await PollModel.find({ chatId: { $in: chatIds } })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    // De qué chat, quién preguntó y quién votó; anónima de verdad (FL10).
    res.json({ polls: await vistasDeEncuestas(polls, req.session!.userId) });
  }));

  router.post('/polls/:pollId/vote', asyncRoute(async (req, res) => {
    const poll = await encuestaDeMiembro(req.params.pollId, req.session!.userId, res);
    if (!poll) return;

    const outcome = applyVote({
      poll: {
        question: poll.question,
        options: poll.options.map((option) => ({
          text: option.text,
          votes: option.votes.map(String),
        })),
        allowMultiple: poll.allowMultiple,
        anonymous: poll.anonymous,
        closedAt: poll.closedAt,
      },
      optionIndex: Number(req.body?.optionIndex),
      userId: String(req.session!.userId),
    });
    if (!outcome.ok) return res.status(400).json({ message: outcome.reason });

    const indice = Number(req.body?.optionIndex);
    const pasos = pasosDelVoto({
      yaVotada: poll.options[indice]!.votes.some((voter) => voter.equals(req.session!.userId)),
      permiteVarias: poll.allowMultiple,
      indice,
      yo: req.session!.userId,
    });
    for (const paso of pasos) {
      // Solo mientras siga abierta: si la cerraron en el medio, el voto no entra.
      const { matchedCount } = await PollModel.updateOne({ _id: poll._id, closedAt: null }, paso);
      if (matchedCount === 0) return res.status(400).json({ message: 'Esa encuesta ya se cerró.' });
    }
    res.json({ ok: true, poll: await vistaDeUna(poll._id, req.session!.userId) });
  }));

  /** Cerrar (FL10): solo quien la creó. Cerrada se ve, pero no se vota. */
  router.post('/polls/:pollId/close', asyncRoute(async (req, res) => {
    const poll = await encuestaDeMiembro(req.params.pollId, req.session!.userId, res);
    if (!poll) return;
    if (!poll.createdBy.equals(req.session!.userId)) {
      return res.status(403).json({ message: 'Solo quien la creó puede cerrarla.' });
    }
    if (!poll.closedAt) await PollModel.updateOne({ _id: poll._id }, { $set: { closedAt: new Date() } });
    res.json({ ok: true, poll: await vistaDeUna(poll._id, req.session!.userId) });
  }));

  router.delete('/polls/:pollId', asyncRoute(async (req, res) => {
    const poll = await encuestaDeMiembro(req.params.pollId, req.session!.userId, res);
    if (!poll) return;
    if (!poll.createdBy.equals(req.session!.userId)) {
      return res.status(403).json({ message: 'Solo quien la creó puede eliminarla.' });
    }
    await PollModel.deleteOne({ _id: poll._id });
    res.json({ ok: true });
  }));

  return router;
}
