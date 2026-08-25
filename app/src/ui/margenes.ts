/**
 * El aire de arriba y de abajo, en función de lo que ocupa el sistema.
 *
 * La app tenía `pb-8` y `pt-14` escritos a mano en cada pantalla. En un teléfono
 * con barra de gestos alcanza; con la barra de TRES BOTONES de Android (48 px)
 * el botón del pie queda debajo de ella y no se puede tocar. Le pasó a José el
 * 25/08/2026 en la pantalla de acceso, y pasaba en las diez pantallas que tienen
 * algo anclado al pie.
 *
 * **Es un máximo, no una suma.** El inset YA incluye el alto de la barra: sumarle
 * el margen de diseño deja un hueco enorme justo en los teléfonos donde el inset
 * es grande. Y se acota por arriba para que una medición rara no empuje el botón
 * a la mitad de la pantalla.
 */

/** Lo que el diseño quiere aunque no haya nada del sistema estorbando. */
const MINIMO_PIE = 24;
const MINIMO_CABECERA = 20;

/** Techo: por encima de esto, la medición es un error y no un teléfono raro. */
const MAXIMO_PIE = 64;
const MAXIMO_CABECERA = 80;

const acotar = (valor: number, minimo: number, maximo: number): number =>
  Math.min(Math.max(Number.isFinite(valor) ? valor : 0, minimo), maximo);

export const margenInferior = (insetBottom: number): number =>
  acotar(insetBottom, MINIMO_PIE, MAXIMO_PIE);

export const margenSuperior = (insetTop: number): number =>
  acotar(insetTop, MINIMO_CABECERA, MAXIMO_CABECERA);
