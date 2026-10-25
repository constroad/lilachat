import { advanceDue, advanceNote, decidirRecordatorio, MAX_ADVANCE_MINUTES, nextOccurrence, REMINDER_NATIVE_CAPABILITY, shouldRemind } from '@lilachat/shared';
import { EventModel, ReminderModel } from './eventModels.js';
import { DeviceModel } from './models.js';
import { ChatModel } from './chatModels.js';
import { buildPushSender, type PushSender } from './pushSender.js';
import { runScheduledTick } from './scheduledMessages.js';
import { avisarEnElChat } from './chatRoutes.js';

/**
 * El cron que dispara eventos y recordatorios (F5).
 *
 * Corre DENTRO del server, no como proceso aparte: es un `setInterval` de un
 * minuto sobre dos consultas indexadas, y montar un segundo servicio con su
 * plist y su health para eso sería más infraestructura que trabajo.
 *
 * Dos reglas heredadas de los crons que ya dolieron:
 *
 * 1. **La ventana se solapa** (mira una hora atrás) para no perder avisos si el
 *    proceso estuvo caído — y el sello `remindedAt` es lo que impide que el
 *    solape los duplique.
 * 2. **Un aviso viejo NO se manda.** Avisar a las once de la noche de una cena
 *    de las siete no le sirve a nadie y hace desconfiar de las notificaciones.
 */
const TICK_MS = 60_000;
/** Tope por corrida: un pico de avisos no puede quedarse con el proceso. */
const MAX_PER_TICK = 50;
/** The advance pass looks at what has advances and starts within the longest one allowed. */
const ADVANCE_LOOKAHEAD_MS = MAX_ADVANCE_MINUTES * 60_000;
const MAX_ADVANCE_PER_TICK = 200;

let timer: ReturnType<typeof setInterval> | null = null;
let sender: PushSender = buildPushSender();

export function setReminderPushSender(next: PushSender): void {
  sender = next;
}

/**
 * Un aviso de la agenda va a TODOS los teléfonos de la persona, esté o no en
 * línea (auditoría 17/10/2026). Antes se filtraba a los desconectados, como un
 * mensaje de chat; pero un recordatorio no se «ve en pantalla» por estar en
 * línea —nada lo mandaba por el socket—, así que con la app abierta, la web
 * abierta o «Conexión permanente» encendida no llegaba nunca. La app lo
 * muestra con banner por el `tipo`.
 */
export async function pushTo(userIds: string[], title: string, body: string, data: { chatId: string; seq: number }) {
  if (userIds.length === 0) return;
  const devices = await DeviceModel.find({
    userId: { $in: userIds },
    pushToken: { $exists: true, $ne: '' },
  })
    .select('pushToken')
    .lean();
  if (devices.length === 0) return;
  // Un token, un envío (José, 18/10: el recordatorio llegaba dos veces). El
  // mismo teléfono puede figurar en dos devices después de reinstalar.
  const tokens = [...new Set(devices.map((device) => device.pushToken!))];
  await sender.send({ tokens, title, body, data: { ...data, tipo: 'agenda' } });
}

/** A reminder's data push lives this long: one that rings ten minutes late is already no use (pending 63). */
const REMINDER_PUSH_TTL_S = 600;

/**
 * A reminder rings on every phone of the person, like `pushTo`, but a phone
 * that draws it full screen (pending 63, `REMINDER_NATIVE_CAPABILITY`) gets it
 * as data with what its big screen shows; the rest get the usual notice.
 */
async function ringReminder(params: { userIds: string[]; title: string; note?: string; chat?: string; reminderId: string; data: { chatId: string; seq: number } }) {
  if (params.userIds.length === 0) return;
  const devices = await DeviceModel.find({ userId: { $in: params.userIds }, pushToken: { $exists: true, $ne: '' } })
    .select('pushToken capacidades')
    .lean();
  if (devices.length === 0) return;
  const native = sender.sendDatos ? new Set(devices.filter((device) => device.capacidades?.includes(REMINDER_NATIVE_CAPABILITY)).map((device) => device.pushToken!)) : new Set<string>();
  const plain = [...new Set(devices.map((device) => device.pushToken!))].filter((token) => !native.has(token));
  if (native.size) {
    await sender.sendDatos!({
      tokens: [...native],
      ttlSegundos: REMINDER_PUSH_TTL_S,
      data: { tipo: 'recordatorio', recordatorioId: params.reminderId, titulo: params.title, nota: params.note ?? '', chat: params.chat ?? '', chatId: params.data.chatId },
    });
  }
  if (plain.length) {
    const title = params.chat ? `${params.chat} · ${params.title}` : params.title;
    await sender.send({ tokens: plain, title, body: params.note || 'Recordatorio', data: { ...params.data, tipo: 'agenda' } });
  }
}

export async function runReminderTick(now: Date = new Date()): Promise<{ events: number; reminders: number; advances: number }> {
  let events = 0;
  let reminders = 0;

  // ─── Eventos que empiezan pronto ────────────────────────────────────────
  const soon = await EventModel.find({
    remindedAt: null,
    // Los eventos viejos no tienen el campo: cuentan como encendido.
    remindGuests: { $ne: false },
    startsAt: { $gte: new Date(now.getTime() - 3_600_000), $lte: new Date(now.getTime() + 24 * 3_600_000) },
  })
    .limit(MAX_PER_TICK)
    .lean();

  for (const event of soon) {
    if (
      !shouldRemind({
        startsAt: event.startsAt,
        remindMinutesBefore: event.remindMinutesBefore,
        now,
        alreadyRemindedAt: event.remindedAt,
      })
    ) {
      continue;
    }
    // El sello se pone ANTES de avisar y de forma condicional: si se pusiera
    // después, dos corridas solapadas mandarían el aviso dos veces.
    const claimed = await EventModel.updateOne(
      { _id: event._id, remindedAt: null },
      { $set: { remindedAt: now } }
    );
    if (claimed.modifiedCount === 0) continue;

    await pushTo(
      event.attendees.map((attendee) => String(attendee.userId)),
      event.title,
      `Empieza en ${event.remindMinutesBefore} minutos`,
      { chatId: String(event.chatId), seq: 0 }
    );
    // También en el chat del evento (José, 20/10), no solo en la barra del teléfono.
    await avisarSinTumbar({ chatId: String(event.chatId), quien: event.createdBy, evento: 'evento-pronto', valor: `${event.title} · empieza en ${event.remindMinutesBefore} minutos`, ref: { tipo: 'evento', id: String(event._id) } });
    events += 1;
  }

  // ─── Recordatorios ──────────────────────────────────────────────────────
  // Ordenados: los más viejos primero. Sin orden, 50 vencidos sin resolver
  // tapaban para siempre a los que tocaba avisar.
  const due = await ReminderModel.find({
    active: true,
    startsAt: { $lte: new Date(now.getTime() + 60_000) },
  })
    .sort({ startsAt: 1 })
    .limit(MAX_PER_TICK)
    .lean();

  for (const reminder of due) {
    const decision = decidirRecordatorio({
      startsAt: reminder.startsAt,
      recurrence: reminder.recurrence,
      rule: reminder.repeat,
      remindedAt: reminder.remindedAt,
      now,
    });
    if (decision.accion === 'esperar') continue;
    if (decision.accion === 'reprogramar') {
      // Se pasó la hora sin avisar (cron caído, reactivado tarde): a la
      // próxima vez sin avisar tarde, o se apaga si era «una vez».
      await ReminderModel.updateOne(
        { _id: reminder._id },
        decision.proxima ? { $set: { startsAt: decision.proxima, remindedAt: null, advanceSent: [] } } : { $set: { active: false } }
      );
      continue;
    }
    const claimed = await ReminderModel.updateOne(
      { _id: reminder._id, remindedAt: reminder.remindedAt ?? null },
      { $set: { remindedAt: now } }
    );
    if (claimed.modifiedCount === 0) continue;

    // El de un CHAT le suena a todos sus miembros (grupo 19/10; 1:1 y borrador
    // 20/10); el del grupo lleva su nombre.
    const chat = reminder.chatId ? await ChatModel.findById(reminder.chatId).select('kind name members.userId').lean() : null;
    await ringReminder({
      userIds: chat ? chat.members.map((m) => String(m.userId)) : [String(reminder.userId)],
      title: reminder.title,
      note: reminder.note,
      chat: chat?.kind === 'group' ? (chat.name ?? 'Grupo') : undefined,
      reminderId: String(reminder._id),
      // A call-back reminder is personal and opens the chat of that call (backlog 23).
      data: { chatId: String(reminder.chatId ?? reminder.callBack?.chatId ?? ''), seq: 0 },
    });
    // El de un chat también queda escrito en el chat (José, 20/10).
    if (chat) await avisarSinTumbar({ chatId: String(chat._id), quien: reminder.userId, evento: 'recordatorio-suena', valor: reminder.title, ref: { tipo: 'recordatorio', id: String(reminder._id) } });
    reminders += 1;

    // Recurrente: se REPROGRAMA y se limpia el sello. Sin esto, un «cada día»
    // sonaría una sola vez en su vida.
    const next = nextOccurrence({ startsAt: reminder.startsAt, recurrence: reminder.recurrence, rule: reminder.repeat, from: now });
    await ReminderModel.updateOne(
      { _id: reminder._id },
      next
        ? { $set: { startsAt: next, remindedAt: null, advanceSent: [] } }
        : { $set: { active: false } } // «una vez» ya cumplió: se apaga sola.
    );
  }

  return { events, reminders, advances: await runAdvancePass(now) };
}

/**
 * The advance alerts (José 25/10: «avisar 15 minutos antes», several). Same rules as the reminder
 * itself: the stamp (`advanceSent`) is claimed BEFORE ringing and conditionally, so two overlapping
 * ticks never ring twice, and a late one is stamped without ringing. It does not write in the chat:
 * the notice of the reminder itself will.
 */
async function runAdvancePass(now: Date): Promise<number> {
  const upcoming = await ReminderModel.find({
    active: true,
    'advance.0': { $exists: true },
    startsAt: { $gt: now, $lte: new Date(now.getTime() + ADVANCE_LOOKAHEAD_MS) },
  })
    .sort({ startsAt: 1 })
    .limit(MAX_ADVANCE_PER_TICK)
    .lean();
  let rung = 0;
  for (const reminder of upcoming) {
    const { ring, stamp } = advanceDue({ startsAt: reminder.startsAt, advance: reminder.advance ?? [], sent: reminder.advanceSent ?? [], now });
    if (stamp.length === 0) continue;
    const claimed = await ReminderModel.updateOne({ _id: reminder._id, advanceSent: { $nin: stamp } }, { $addToSet: { advanceSent: { $each: stamp } } });
    if (claimed.modifiedCount === 0 || ring === null) continue;
    const chat = reminder.chatId ? await ChatModel.findById(reminder.chatId).select('kind name members.userId').lean() : null;
    await ringReminder({
      userIds: chat ? chat.members.map((m) => String(m.userId)) : [String(reminder.userId)],
      title: reminder.title,
      note: [advanceNote(ring), reminder.note].filter(Boolean).join(' · '),
      chat: chat?.kind === 'group' ? (chat.name ?? 'Grupo') : undefined,
      reminderId: String(reminder._id),
      data: { chatId: String(reminder.chatId ?? reminder.callBack?.chatId ?? ''), seq: 0 },
    });
    rung += 1;
  }
  return rung;
}

export function startReminderCron(): void {
  if (timer) return;
  timer = setInterval(() => {
    void runReminderTick().catch((error) => {
      // Un tick que falla no puede matar el proceso: el siguiente reintenta, y
      // lo que no se avisó sigue sin sello.
      console.error('[cron] tick de recordatorios falló:', error instanceof Error ? error.message : error);
    });
    // Mismo reloj para los mensajes programados (F11): cada minuto manda los que
    // vencieron. Independiente del de recordatorios: si uno falla, el otro sigue.
    void runScheduledTick().catch((error) => {
      console.error('[cron] tick de programados falló:', error instanceof Error ? error.message : error);
    });
  }, TICK_MS);
  // `unref`: el cron no sostiene el proceso vivo por su cuenta.
  timer.unref?.();
}

export function stopReminderCron(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Un aviso en el chat que falla no frena el resto de la corrida: el push ya salió. */
async function avisarSinTumbar(params: Parameters<typeof avisarEnElChat>[0]): Promise<void> {
  try {
    await avisarEnElChat(params);
  } catch (error) {
    console.error('[cron] no se pudo escribir el aviso en el chat:', error instanceof Error ? error.message : error);
  }
}
