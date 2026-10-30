/**
 * Eventos y recordatorios (F5). Motores PUROS.
 *
 * El cálculo de «cuándo toca» vive acá y no en el cron: es la clase de lógica
 * que se prueba con veinte casos en un segundo y que, metida en un job que
 * corre cada minuto, solo se puede observar esperando.
 */

import { nextRepeat, type RepeatRule } from './repeatRule.js';

export type Recurrence = 'once' | 'daily' | 'weekly' | 'monthly';

/**
 * La PRÓXIMA vez que toca, estrictamente después de `from`.
 *
 * «Estrictamente después» importa: si fuera «desde», un recordatorio que acaba
 * de sonar devolvería el mismo instante y el cron lo repetiría en cada corrida.
 */
export function nextOccurrence(params: {
  startsAt: Date;
  recurrence: Recurrence;
  from: Date;
  /** Weekdays, the month's last day, every N (pending 65). */
  rule?: RepeatRule;
}): Date | null {
  return nextRepeat(params);
}

/**
 * ¿Hay que avisar YA de este evento?
 *
 * Se compara contra el instante del aviso —el evento menos su antelación— y se
 * exige que no se haya avisado antes: el cron se solapa a propósito para no
 * perder nada, y sin el sello mandaría el mismo aviso en cada corrida.
 */
export function shouldRemind(params: {
  startsAt: Date;
  remindMinutesBefore: number;
  now: Date;
  alreadyRemindedAt?: Date | null;
  /** Cuánto atrás mira el cron. Un aviso más viejo que esto ya no se manda:
   *  avisar de una cena a las once de la noche no le sirve a nadie. */
  lookbackMinutes?: number;
}): boolean {
  if (params.alreadyRemindedAt) return false;
  const remindAt = params.startsAt.getTime() - params.remindMinutesBefore * 60_000;
  const now = params.now.getTime();
  const lookback = (params.lookbackMinutes ?? 60) * 60_000;
  return now >= remindAt && now - remindAt <= lookback;
}

export type Rsvp = 'yes' | 'no' | 'maybe';

export type AttendeeSummary = { yes: number; no: number; maybe: number; pending: number };

/** El resumen que se muestra bajo un evento. */
export function summarizeRsvp(attendees: { rsvp?: Rsvp | null }[]): AttendeeSummary {
  const summary: AttendeeSummary = { yes: 0, no: 0, maybe: 0, pending: 0 };
  for (const attendee of attendees) {
    if (attendee.rsvp === 'yes') summary.yes += 1;
    else if (attendee.rsvp === 'no') summary.no += 1;
    else if (attendee.rsvp === 'maybe') summary.maybe += 1;
    else summary.pending += 1;
  }
  return summary;
}

/**
 * Cómo se lee la fecha de un evento en la tarjeta: el diseño muestra
 * «Tomorrow, 7:00 PM», no una fecha completa.
 */
/** Built once: Hermes pays ICU's locale matching on every formatter it creates (OOM, 30/10). */
let eventClock: Intl.DateTimeFormat | null = null;
let eventDay: Intl.DateTimeFormat | null = null;

export function formatEventWhen(startsAt: Date, now: Date = new Date()): string {
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOfDay(startsAt) - startOfDay(now)) / 86_400_000);
  const time = (eventClock ??= new Intl.DateTimeFormat('es-PE', { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' })).format(startsAt);

  if (days === 0) return `Hoy, ${time}`;
  if (days === 1) return `Mañana, ${time}`;
  if (days === -1) return `Ayer, ${time}`;
  const date = (eventDay ??= new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' })).format(startsAt);
  return `${date.replace('.', '')}, ${time}`;
}

/** Lo que el cron hace con un recordatorio activo en esta pasada. */
export type DecisionDeRecordatorio =
  | { accion: 'esperar' }
  | { accion: 'avisar' }
  /** Se pasó la hora sin avisar: a la próxima vez, o `null` = se apaga. Sin push tarde. */
  | { accion: 'reprogramar'; proxima: Date | null };

/**
 * Qué hacer con un recordatorio (auditoría 17/10/2026). La ventana de
 * `shouldRemind` (una hora) sigue valiendo para no avisar tarde; lo nuevo es
 * que lo que quedó FUERA de la ventana se resuelve —se mueve a la próxima vez
 * o se apaga— en vez de quedar activo para siempre.
 */
export function decidirRecordatorio(params: {
  startsAt: Date;
  recurrence: Recurrence;
  remindedAt: Date | null | undefined;
  now: Date;
  lookbackMinutes?: number;
  /** Weekdays, the month's last day, every N (pending 65). */
  rule?: RepeatRule;
}): DecisionDeRecordatorio {
  const ventana = (params.lookbackMinutes ?? 60) * 60_000;
  const atraso = params.now.getTime() - params.startsAt.getTime();
  if (atraso > ventana) {
    return { accion: 'reprogramar', proxima: nextOccurrence({ startsAt: params.startsAt, recurrence: params.recurrence, rule: params.rule, from: params.now }) };
  }
  if (params.remindedAt || atraso < 0) return { accion: 'esperar' };
  return { accion: 'avisar' };
}
