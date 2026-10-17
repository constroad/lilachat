import { Router } from 'express';
import { Types } from 'mongoose';
import {
  applyVote,
  cambiosDeEvento,
  cambiosDeRecordatorio,
  summarizeRsvp,
  validatePoll,
  type Recurrence,
} from '@lilachat/shared';
import { ChatModel } from './chatModels.js';
import { ForbiddenChatError } from './chatService.js';
import { EventModel, PollModel, ReminderModel } from './eventModels.js';
import { asyncRoute, requireSession } from './requireSession.js';

/**
 * Eventos, recordatorios y encuestas (F5).
 *
 * La membresía del chat es el ÚNICO permiso: quien puede escribir en la
 * conversación puede crear un evento o una encuesta ahí, y quien no, no ve
 * nada. Re-implementar permisos propios sería inventar una segunda verdad.
 */
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

/** Un evento de un chat del que soy miembro; `null` si no existe o no lo veo. */
async function eventoVisible(eventId: unknown, userId: Types.ObjectId) {
  const id = asObjectId(eventId);
  if (!id) return null;
  const evento = await EventModel.findById(id).select('chatId createdBy startsAt').lean();
  if (!evento) return null;
  const esMiembro = await ChatModel.exists({ _id: evento.chatId, 'members.userId': userId });
  return esMiembro ? evento : null;
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

  router.get('/events', asyncRoute(async (req, res) => {
    const chatIds = await myChatIds(req.session!.userId);
    // Solo los que vienen: la pantalla es «qué se viene», no un archivo.
    const events = await EventModel.find({
      chatId: { $in: chatIds },
      startsAt: { $gte: new Date(Date.now() - 6 * 3_600_000) },
    })
      .sort({ startsAt: 1 })
      .limit(100)
      .lean();

    res.json({
      events: events.map((event) => ({
        ...event,
        id: String(event._id),
        // La app ofrece editar y cancelar solo a quien lo creó.
        mio: String(event.createdBy) === String(req.session!.userId),
        rsvpSummary: summarizeRsvp(event.attendees),
        myRsvp:
          event.attendees.find(
            (attendee) => String(attendee.userId) === String(req.session!.userId)
          )?.rsvp ?? null,
      })),
    });
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
      res.status(201).json({ id: String(poll._id) });
    } catch (error) {
      if (error instanceof ForbiddenChatError || error instanceof ChatSecretoError) {
        return res.status(403).json({ message: error.message });
      }
      throw error;
    }
  }));

  router.get('/polls', asyncRoute(async (req, res) => {
    const chatIds = await myChatIds(req.session!.userId);
    const polls = await PollModel.find({ chatId: { $in: chatIds } })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ polls: polls.map((poll) => ({ ...poll, id: String(poll._id) })) });
  }));

  router.post('/polls/:pollId/vote', asyncRoute(async (req, res) => {
    const pollId = asObjectId(req.params.pollId);
    if (!pollId) return res.status(404).json({ message: 'Esa encuesta no existe.' });
    const poll = await PollModel.findById(pollId).lean();
    if (!poll) return res.status(404).json({ message: 'Esa encuesta no existe.' });
    try {
      await assertMember(poll.chatId, req.session!.userId);
    } catch {
      return res.status(403).json({ message: 'No tienes acceso a esa encuesta.' });
    }

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

    await PollModel.updateOne(
      { _id: pollId },
      {
        $set: {
          options: outcome.options.map((option) => ({
            text: option.text,
            votes: option.votes.map((voter) => new Types.ObjectId(voter)),
          })),
        },
      }
    );
    res.json({ ok: true });
  }));

  return router;
}
