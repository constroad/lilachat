/**
 * Qué acciones de la barra de selección van a la vista y cuáles a «Más» (José,
 * 19/10: «el botón borrar se pierde arriba, ¿no deberían estar todos en la
 * misma línea y visibles?»). Con 7 acciones de 44 dp, en un teléfono de 360 dp
 * la última —Eliminar— quedaba fuera de la pantalla.
 *
 * Regla: todo en una línea; si no entra, las de más prioridad a la vista y el
 * resto en «⋮». Eliminar nunca se esconde.
 */
export type AccionDeBarra = 'responder' | 'hilo' | 'destacar' | 'fijar' | 'reenviar' | 'eliminar' | 'copiar' | 'editar' | 'info';

/**
 * El orden en que se dibujan Y su prioridad para quedarse a la vista. Destacar
 * (20/10) va con lo frecuente, como la estrella de WhatsApp; fijar (en un grupo,
 * solo admins) cede su lugar y queda en «⋮» si no entra.
 */
const ORDEN: AccionDeBarra[] = ['responder', 'hilo', 'destacar', 'reenviar', 'eliminar', 'fijar', 'copiar', 'editar', 'info'];
const LADO_DEL_BOTON = 44;
/** La X, el número y el margen de la barra. */
const FIJO_DE_LA_BARRA = 44 + 32 + 16;

export function repartirAcciones(acciones: readonly AccionDeBarra[], ancho: number): { visibles: AccionDeBarra[]; enMenu: AccionDeBarra[] } {
  const ordenadas = ORDEN.filter((accion) => acciones.includes(accion));
  const lugares = Math.floor((ancho - FIJO_DE_LA_BARRA) / LADO_DEL_BOTON);
  if (ordenadas.length <= lugares) return { visibles: ordenadas, enMenu: [] };
  // Un lugar es del «⋮»; eliminar se queda aunque haya que dejar afuera otra.
  const cupo = Math.max(1, lugares - 1);
  const elegidas = ordenadas.slice(0, cupo);
  if (ordenadas.includes('eliminar') && !elegidas.includes('eliminar')) elegidas.splice(cupo - 1, 1, 'eliminar');
  return { visibles: ordenadas.filter((accion) => elegidas.includes(accion)), enMenu: ordenadas.filter((accion) => !elegidas.includes(accion)) };
}
