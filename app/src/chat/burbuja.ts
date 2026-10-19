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

/**
 * Dónde va la hora (y los checks) de una burbuja: en UN solo lugar. Con texto,
 * al final de la última línea; una foto sin texto, encima; lo demás (voz,
 * archivo, eliminado), en su propio renglón.
 */
export function dondeVaLaHora(params: {
  conTexto: boolean;
  eliminado: boolean;
  fotoVisible: boolean;
}): 'en-el-texto' | 'sobre-la-foto' | 'renglon-propio' {
  if (params.conTexto && !params.eliminado) return 'en-el-texto';
  if (params.fotoVisible && !params.eliminado) return 'sobre-la-foto';
  return 'renglon-propio';
}

// El color de autor es compartido con la web (W2): vive en `shared`.
export { CANTIDAD_DE_COLORES_DE_AUTOR, colorDeAutor } from '@lilachat/shared';

/** El avatar del autor en un grupo (dp): 28, como WhatsApp. */
export const AVATAR_DE_AUTOR = 28;
