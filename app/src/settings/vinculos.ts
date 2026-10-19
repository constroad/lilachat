import { formatClock, formatDayLabel, MAXIMO_DE_VINCULADOS } from '@lilachat/shared';

/**
 * Lo puro de «Dispositivos vinculados» (W5): qué dice cada fila y qué se le
 * dice a la persona cuando vincular falla.
 */
const MINUTO_MS = 60_000;
const HORA_MS = 60 * MINUTO_MS;
const RECIEN_MS = 2 * MINUTO_MS;

/** «Activo hace 5 min» · «Último uso: ayer 6:40 p. m.» (el server lo anota a lo sumo cada minuto). */
export function textoDeUltimoUso(at: string | null, ahora: Date = new Date()): string {
  const fecha = at ? new Date(at) : null;
  if (!fecha || Number.isNaN(fecha.getTime())) return 'Vinculado';
  const pasado = ahora.getTime() - fecha.getTime();
  if (pasado < RECIEN_MS) return 'Activo ahora';
  if (pasado < HORA_MS) return `Activo hace ${Math.floor(pasado / MINUTO_MS)} min`;
  const dia = formatDayLabel(fecha, ahora);
  if (dia === 'Hoy') return `Último uso: hoy ${formatClock(fecha)}`;
  if (dia === 'Ayer') return `Último uso: ayer ${formatClock(fecha)}`;
  return `Último uso: ${dia}`;
}

type Rechazo = { ok: false; status: number | 'network'; message?: string };

export function motivoDeVinculacion(rechazo: Rechazo): string {
  if (rechazo.status === 'network') return 'Sin conexión. Revisa tu internet.';
  if (rechazo.status === 410) return 'El código venció. Escanea el que se ve ahora en la computadora.';
  if ((rechazo.status === 409 || rechazo.status === 403) && rechazo.message) return rechazo.message;
  return 'No se pudo vincular. Inténtalo de nuevo.';
}

export const puedeVincularOtro = (cantidad: number): boolean => cantidad < MAXIMO_DE_VINCULADOS;
