import { decidirRecordatorio, nextOccurrence, shouldRemind } from '@lilachat/shared';
import { EventModel, ReminderModel } from './eventModels.js';
import { DeviceModel } from './models.js';
import { ChatModel } from './chatModels.js';
import { buildPushSender, type PushSender } from './pushSender.js';
import { runScheduledTick } from './scheduledMessages.js';

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
async function pushTo(userIds: string[], title: string, body: string, data: { chatId: string; seq: number }) {
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

export async function runReminderTick(now: Date = new Date()): Promise<{ events: number; reminders: number }> {
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
      remindedAt: reminder.remindedAt,
      now,
    });
    if (decision.accion === 'esperar') continue;
    if (decision.accion === 'reprogramar') {
      // Se pasó la hora sin avisar (cron caído, reactivado tarde): a la
      // próxima vez sin avisar tarde, o se apaga si era «una vez».
      await ReminderModel.updateOne(
        { _id: reminder._id },
        decision.proxima ? { $set: { startsAt: decision.proxima, remindedAt: null } } : { $set: { active: false } }
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
    await pushTo(
      chat ? chat.members.map((m) => String(m.userId)) : [String(reminder.userId)],
      chat?.kind === 'group' ? `${chat.name ?? 'Grupo'} · ${reminder.title}` : reminder.title,
      reminder.note || 'Recordatorio',
      { chatId: String(reminder.chatId ?? ''), seq: 0 }
    );
    reminders += 1;

    // Recurrente: se REPROGRAMA y se limpia el sello. Sin esto, un «cada día»
    // sonaría una sola vez en su vida.
    const next = nextOccurrence({ startsAt: reminder.startsAt, recurrence: reminder.recurrence, from: now });
    await ReminderModel.updateOne(
      { _id: reminder._id },
      next
        ? { $set: { startsAt: next, remindedAt: null } }
        : { $set: { active: false } } // «una vez» ya cumplió: se apaga sola.
    );
  }

  return { events, reminders };
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
