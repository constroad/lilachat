import { nextOccurrence, shouldRemind } from '@lilachat/shared';
import { EventModel, ReminderModel } from './eventModels.js';
import { DeviceModel } from './models.js';
import { isOnline } from './presence.js';
import { buildPushSender, type PushSender } from './pushSender.js';

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

async function pushTo(userIds: string[], title: string, body: string, data: { chatId: string; seq: number }) {
  // A quien está mirando la app no se le empuja nada: ya lo ve en pantalla.
  const offline = userIds.filter((userId) => !isOnline(userId));
  if (offline.length === 0) return;
  const devices = await DeviceModel.find({
    userId: { $in: offline },
    pushToken: { $exists: true, $ne: '' },
  })
    .select('pushToken')
    .lean();
  if (devices.length === 0) return;
  await sender.send({ tokens: devices.map((device) => device.pushToken!), title, body, data });
}

export async function runReminderTick(now: Date = new Date()): Promise<{ events: number; reminders: number }> {
  let events = 0;
  let reminders = 0;

  // ─── Eventos que empiezan pronto ────────────────────────────────────────
  const soon = await EventModel.find({
    remindedAt: null,
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
  const due = await ReminderModel.find({
    active: true,
    startsAt: { $lte: new Date(now.getTime() + 60_000) },
  })
    .limit(MAX_PER_TICK)
    .lean();

  for (const reminder of due) {
    if (
      !shouldRemind({
        startsAt: reminder.startsAt,
        remindMinutesBefore: 0,
        now,
        alreadyRemindedAt: reminder.remindedAt,
      })
    ) {
      continue;
    }
    const claimed = await ReminderModel.updateOne(
      { _id: reminder._id, remindedAt: reminder.remindedAt ?? null },
      { $set: { remindedAt: now } }
    );
    if (claimed.modifiedCount === 0) continue;

    await pushTo([String(reminder.userId)], reminder.title, 'Recordatorio', {
      chatId: String(reminder.chatId ?? ''),
      seq: 0,
    });
    reminders += 1;

    // Recurrente: se REPROGRAMA y se limpia el sello. Sin esto, un «cada día»
    // sonaría una sola vez en su vida.
    const next = nextOccurrence({
      startsAt: reminder.startsAt,
      recurrence: reminder.recurrence,
      from: now,
    });
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
  }, TICK_MS);
  // `unref`: el cron no sostiene el proceso vivo por su cuenta.
  timer.unref?.();
}

export function stopReminderCron(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
