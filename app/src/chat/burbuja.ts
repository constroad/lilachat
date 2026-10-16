/**
 * Las reglas de forma de una burbuja (FL3, spec §45; diseño «Conversación 1:1 ·
 * Claro» de Stitch). Puras: la burbuja solo las dibuja.
 */
const RADIO = 18;
const RADIO_INTERNO = 6;
const RADIO_COLA = 4;

export type Radios = { arribaIzq: number; arribaDer: number; abajoIzq: number; abajoDer: number };

/**
 * Radio 18; dentro de un bloque del mismo autor, las esquinas de SU lado que
 * tocan a la vecina bajan a 6; la última del bloque lleva la cola (4) abajo
 * del lado del autor. Así se lee un bloque como una sola voz, como WhatsApp.
 */
export function radiosDeBurbuja(params: { mia: boolean; conAnterior: boolean; conSiguiente: boolean }): Radios {
  const arribaLado = params.conAnterior ? RADIO_INTERNO : RADIO;
  const abajoLado = params.conSiguiente ? RADIO_INTERNO : RADIO_COLA;
  return params.mia
    ? { arribaIzq: RADIO, arribaDer: arribaLado, abajoIzq: RADIO, abajoDer: abajoLado }
    : { arribaIzq: arribaLado, arribaDer: RADIO, abajoIzq: abajoLado, abajoDer: RADIO };
}

/** En un grupo, el nombre va en la PRIMERA burbuja ajena de cada bloque. */
export function mostrarAutor(params: { esGrupo: boolean; mia: boolean; conAnterior: boolean }): boolean {
  return params.esGrupo && !params.mia && !params.conAnterior;
}

/** Cuántos colores de autor hay en la paleta (`autor-1` … `autor-6`). */
export const CANTIDAD_DE_COLORES_DE_AUTOR = 6;

/**
 * El color de una persona en un grupo: estable (sale de su id, no del orden de
 * llegada), así Mamá es siempre rosa en todos los chats y en todos los
 * teléfonos.
 */
export function colorDeAutor(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return (hash % CANTIDAD_DE_COLORES_DE_AUTOR) + 1;
}
