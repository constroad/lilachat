import type { MencionEnMensaje } from './menciones.js';

export type Seleccion = { start: number; end: number };
/** Un «@algo» que se está escribiendo: desde dónde y qué se lleva tipeado. */
export type ConsultaDeMencion = { inicio: number; consulta: string };
export type MencionElegida = { userId: string; nombre: string };

/** Lo que se escribe después del «@» antes de rendirse: un nombre no es un párrafo. */
const MAX_CONSULTA = 30;

/** Pone un fragmento donde está el cursor (o reemplaza lo seleccionado); sin cursor, al final. */
export function insertarEnTexto(texto: string, seleccion: Seleccion | null, fragmento: string): { texto: string; cursor: number } {
  const inicio = seleccion ? Math.min(seleccion.start, texto.length) : texto.length;
  const fin = seleccion ? Math.min(Math.max(seleccion.end, inicio), texto.length) : texto.length;
  return { texto: texto.slice(0, inicio) + fragmento + texto.slice(fin), cursor: inicio + fragmento.length };
}

/** Joiners and modifiers that belong to the emoji before them (ZWJ, variation selector, skin tones, tags, keycap). */
const EMOJI_TAIL = /^(?:\u200D|\uFE0F|\u20E3|[\u{1F3FB}-\u{1F3FF}]|[\u{E0020}-\u{E007F}])$/u;
const REGIONAL_INDICATOR = /^[\u{1F1E6}-\u{1F1FF}]$/u;

/** How many code points the last visible character takes (a composed emoji counts as one). */
function lastCharacterLength(points: string[]): number {
  let count = 0;
  let index = points.length - 1;
  while (index >= 0) {
    const point = points[index]!;
    count += 1;
    index -= 1;
    const joined = index >= 0 && points[index] === '\u200D';
    if (EMOJI_TAIL.test(point) && index >= 0) continue;
    if (joined) {
      count += 1;
      index -= 1;
      continue;
    }
    if (REGIONAL_INDICATOR.test(point) && index >= 0 && REGIONAL_INDICATOR.test(points[index]!) && count === 1) count += 1;
    break;
  }
  return count;
}

/**
 * The backspace key of the emoji panel (design `s1-app-panel-stickers`): it
 * removes the selection, or the character before the cursor — a whole emoji,
 * even a composed one, not half of it.
 */
export function deleteBeforeCursor(texto: string, seleccion: Seleccion | null): { texto: string; cursor: number } {
  const start = seleccion ? Math.min(seleccion.start, texto.length) : texto.length;
  const end = seleccion ? Math.min(Math.max(seleccion.end, start), texto.length) : texto.length;
  if (end > start) return { texto: texto.slice(0, start) + texto.slice(end), cursor: start };
  const before = Array.from(texto.slice(0, start));
  if (!before.length) return { texto, cursor: start };
  const kept = before.slice(0, before.length - lastCharacterLength(before)).join('');
  return { texto: kept + texto.slice(start), cursor: kept.length };
}

/**
 * ¿Se está escribiendo una mención? Un «@» al principio o tras un espacio,
 * seguido de lo tipeado hasta el cursor sin espacios. Un correo no lo es.
 */
export function consultaDeMencion(texto: string, cursor: number): ConsultaDeMencion | null {
  const antes = texto.slice(0, cursor);
  const arroba = antes.lastIndexOf('@');
  if (arroba < 0 || (arroba > 0 && !/\s/.test(antes[arroba - 1]!))) return null;
  const consulta = antes.slice(arroba + 1);
  if (/\s/.test(consulta) || consulta.length > MAX_CONSULTA) return null;
  return { inicio: arroba, consulta };
}

/** Cambia el «@an» que se escribía por «@Ana » y deja el cursor detrás. */
export function completarMencion(texto: string, consulta: ConsultaDeMencion, nombre: string): { texto: string; cursor: number } {
  const fin = consulta.inicio + 1 + consulta.consulta.length;
  const mencion = `@${nombre} `;
  return { texto: texto.slice(0, consulta.inicio) + mencion + texto.slice(fin), cursor: consulta.inicio + mencion.length };
}

/**
 * Los rangos de cada «@Nombre» elegido que sigue en el texto final. Un nombre
 * pegado a más letras («@Anabel») no cuenta como «@Ana».
 */
export function rangosDeMenciones(texto: string, elegidas: readonly MencionElegida[]): MencionEnMensaje[] {
  const rangos: MencionEnMensaje[] = [];
  for (const { userId, nombre } of elegidas) {
    const buscada = `@${nombre}`;
    for (let desde = texto.indexOf(buscada); desde >= 0; desde = texto.indexOf(buscada, desde + 1)) {
      const siguiente = texto[desde + buscada.length];
      if (siguiente !== undefined && /[\p{L}\p{N}]/u.test(siguiente)) continue;
      rangos.push({ userId, desde, largo: buscada.length });
    }
  }
  return rangos.sort((a, b) => a.desde - b.desde);
}

/**
 * Cómo se lee una @mención en la burbuja: «@Tú» si soy yo, el nombre que YO
 * le tengo a esa persona si tiene letras, y si no el texto de quien escribió
 * (19/10: me salía «@902049935» porque no me puse nombre).
 */
export function textoDeMencion(params: { userId: string; original: string; nombres?: ReadonlyMap<string, string>; yo: string }): string {
  if (params.userId === params.yo) return '@Tú';
  const nombre = params.nombres?.get(params.userId);
  return nombre && /\p{L}/u.test(nombre) ? `@${nombre}` : params.original;
}
