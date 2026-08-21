/**
 * Eventos y recordatorios (F5). Motores PUROS.
 *
 * El cálculo de «cuándo toca» vive acá y no en el cron: es la clase de lógica
 * que se prueba con veinte casos en un segundo y que, metida en un job que
 * corre cada minuto, solo se puede observar esperando.
 */

export type Recurrence = 'once' | 'daily' | 'weekly';

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
}): Date | null {
  const start = params.startsAt.getTime();
  const from = params.from.getTime();

  if (params.recurrence === 'once') return start > from ? new Date(start) : null;

  const period = params.recurrence === 'daily' ? 86_400_000 : 7 * 86_400_000;
  if (start > from) return new Date(start);
  // Se salta de un golpe a la ocurrencia que viene: iterar sumando períodos
  // desde una fecha de hace meses son miles de vueltas por recordatorio.
  const periodsElapsed = Math.floor((from - start) / period) + 1;
  return new Date(start + periodsElapsed * period);
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
export function formatEventWhen(startsAt: Date, now: Date = new Date()): string {
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOfDay(startsAt) - startOfDay(now)) / 86_400_000);
  const time = new Intl.DateTimeFormat('es-PE', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(startsAt);

  if (days === 0) return `Hoy, ${time}`;
  if (days === 1) return `Mañana, ${time}`;
  if (days === -1) return `Ayer, ${time}`;
  const date = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' }).format(startsAt);
  return `${date.replace('.', '')}, ${time}`;
}
