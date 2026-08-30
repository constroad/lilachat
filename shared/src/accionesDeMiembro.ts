import { puedeCambiarRol, puedeSacar, type MiembroDeChat } from './miembrosDeGrupo.js';

/**
 * Qué se puede hacer con un miembro del grupo. PURO.
 *
 * **Existe para que la pantalla y el server no opinen distinto.** La regla de
 * quién puede qué ya vive en `puedeSacar` y `puedeCambiarRol`; si la lista de
 * botones se armara aparte —«mostrar sacar si soy admin»— sería una segunda
 * copia de las mismas reglas, y las dos copias se separan en el primer cambio.
 * Acá se PREGUNTA a las mismas funciones que después decide el server.
 *
 * Una fila sin acciones no abre menú. Ofrecer opciones que van a fallar enseña
 * que los botones de esta app no responden, y esa lección se aplica después a
 * los que sí funcionan.
 */
export type AccionDeMiembro = 'hacer-admin' | 'dejar-admin' | 'sacar';

export function accionesDeMiembro(params: {
  quien: string;
  aQuien: string;
  miembros: readonly MiembroDeChat[];
  esGrupo: boolean;
}): AccionDeMiembro[] {
  const acciones: AccionDeMiembro[] = [];

  if (puedeCambiarRol({ ...params, rol: 'admin' }).ok) acciones.push('hacer-admin');
  if (puedeCambiarRol({ ...params, rol: 'member' }).ok) acciones.push('dejar-admin');
  if (puedeSacar(params).ok) acciones.push('sacar');

  return acciones;
}
