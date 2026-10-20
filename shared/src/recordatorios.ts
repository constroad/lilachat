import { formatEventWhen, nextOccurrence, type Recurrence } from './events.js';

export const ETIQUETA_DE_REPETICION: Record<Recurrence, string> = {
  once: 'Una vez',
  daily: 'Diario',
  weekly: 'Semanal',
};

/**
 * Cuándo suena, en una línea (19/10: la tarjeta del chat y la lista del
 * grupo): el día y la hora; si se repite, cada cuánto y la próxima vez.
 */
export function cuandoSuena(recordatorio: { startsAt: string; recurrence: Recurrence; active: boolean }, ahora: Date = new Date()): string {
  if (!recordatorio.active) return 'Apagado';
  const proxima = nextOccurrence({ startsAt: new Date(recordatorio.startsAt), recurrence: recordatorio.recurrence, from: ahora });
  if (!proxima) return 'Ya pasó';
  const cuando = formatEventWhen(proxima, ahora);
  return recordatorio.recurrence === 'once' ? cuando : `${ETIQUETA_DE_REPETICION[recordatorio.recurrence]} · ${cuando}`;
}
