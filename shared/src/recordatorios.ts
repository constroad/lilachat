import { formatEventWhen, nextOccurrence, type Recurrence } from './events.js';
import { repeatLabel, type RepeatRule } from './repeatRule.js';

export const ETIQUETA_DE_REPETICION: Record<Recurrence, string> = {
  once: 'Una vez',
  daily: 'Diario',
  weekly: 'Semanal',
  monthly: 'Mensual',
};

/**
 * When it rings, in one line (19/10: the chat card and the group list): the
 * day and time; if it repeats, how (pending 65: «Mar y jue», «Fin de mes») and
 * the next time.
 */
export function whenItRings(reminder: { startsAt: string; recurrence: Recurrence; repeat?: RepeatRule; active: boolean }, now: Date = new Date()): string {
  if (!reminder.active) return 'Apagado';
  const next = nextOccurrence({ startsAt: new Date(reminder.startsAt), recurrence: reminder.recurrence, rule: reminder.repeat, from: now });
  if (!next) return 'Ya pasó';
  const when = formatEventWhen(next, now);
  return reminder.recurrence === 'once' ? when : `${repeatLabel(reminder.recurrence, reminder.repeat, ETIQUETA_DE_REPETICION[reminder.recurrence])} · ${when}`;
}

type ClaseDeChat = 'direct' | 'group' | 'notas';

/** La línea bajo «Nuevo recordatorio» al crearlo desde un chat (20/10: no solo en grupos). */
export function aQuienSuena(kind: ClaseDeChat, nombre: string): string {
  if (kind === 'group') return `Para «${nombre}»: le suena a todo el grupo.`;
  if (kind === 'direct') return `Con «${nombre}»: les suena a los dos.`;
  return 'Solo para ti: te suena a ti.';
}

/** La opción del clip que lo crea. */
export function etiquetaDeRecordatorioEnElChat(kind: ClaseDeChat): string {
  return kind === 'group' ? 'Recordatorio del grupo' : 'Recordatorio';
}
