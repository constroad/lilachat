import type { Recurrence } from '@lilachat/shared';

/**
 * Lo puro del formulario de recordatorio de la web (W3c, 20/10): las mismas
 * reglas que `CreateReminderScreen` de la app.
 */
export function validarRecordatorio(params: { titulo: string; cuando: Date; repetir: Recurrence; ahora: Date }): string | null {
  if (!params.titulo.trim()) return 'Ponle un nombre al recordatorio.';
  if (Number.isNaN(params.cuando.getTime())) return 'Elige el día y la hora.';
  // Uno que se repite sigue sonando aunque el primer día ya haya pasado.
  if (params.repetir === 'once' && params.cuando.getTime() < params.ahora.getTime()) return 'Esa hora ya pasó. Elige una que venga.';
  return null;
}

const dos = (numero: number) => String(numero).padStart(2, '0');

/** El valor de un `<input type="datetime-local">`, en la hora LOCAL (no la de UTC de `toISOString`). */
export function aValorLocal(fecha: Date): string {
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}
