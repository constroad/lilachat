import type { ContactoDeAgenda } from '@lilachat/shared';

/**
 * Los cuatro estados de leer la agenda del teléfono.
 *
 * Existe por el bug del 26/08/2026: «Invitar» se quedó con los esqueletos para
 * siempre. `getContactsAsync` y `Fields` ya no viven en la raíz de
 * `expo-contacts` 57 —son de `expo-contacts/legacy`—, así que la llamada
 * reventaba… y como «cargando» era simplemente «todavía no hay datos», el fallo
 * se veía **idéntico** a una carga lenta.
 *
 * De ahí la regla que fija este motor: **el error es un estado propio**.
 * Mientras «cargando» signifique «no llegó nada», todo lo que salga mal va a
 * parecer que está por llegar.
 */
export type EstadoAgenda =
  | { estado: 'cargando' }
  | { estado: 'denegado' }
  | { estado: 'error'; mensaje: string }
  | { estado: 'listo'; agenda: ContactoDeAgenda[] };

export function resolverEstadoAgenda(params: {
  permiso: 'concedido' | 'denegado' | null;
  agenda: ContactoDeAgenda[] | null;
  /** El mensaje del fallo, si lo hubo. */
  fallo: string | null;
}): EstadoAgenda {
  // El fallo gana sobre todo lo demás: si ya se sabe que se rompió, seguir
  // mostrando el esqueleto es mentirle a quien mira.
  if (params.fallo) return { estado: 'error', mensaje: params.fallo };
  if (params.permiso === 'denegado') return { estado: 'denegado' };
  if (params.permiso === null || params.agenda === null) return { estado: 'cargando' };
  return { estado: 'listo', agenda: params.agenda };
}
