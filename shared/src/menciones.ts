/**
 * Una mención en un mensaje de grupo (José, 18/10: «taggear con @»). Viaja el
 * texto que eligió quien escribe («@Ana») MÁS el rango y el id: cada teléfono
 * la dibuja con SU nombre para esa persona, y una app vieja igual lee «@Ana».
 */
export type MencionEnMensaje = { userId: string; desde: number; largo: number };

export type TramoConMenciones = { tipo: 'texto'; texto: string } | { tipo: 'mencion'; userId: string; texto: string };

/** Más que esto en un mensaje es ruido (o abuso del aviso que dispara cada una). */
export const MAX_MENCIONES = 20;

const esEntero = (valor: unknown): valor is number => typeof valor === 'number' && Number.isInteger(valor);

/**
 * Las menciones que valen: de miembros del chat, dentro del texto, empezando
 * con «@», sin superponerse, ordenadas y con tope. Lo demás se descarta en
 * silencio: una mención inválida no justifica rechazar el mensaje.
 */
export function validarMenciones(texto: string, crudas: unknown, miembros: readonly string[]): MencionEnMensaje[] {
  if (!Array.isArray(crudas)) return [];
  const validos = new Set(miembros);
  const candidatas = crudas
    .filter((m): m is MencionEnMensaje => typeof m?.userId === 'string' && esEntero(m?.desde) && esEntero(m?.largo))
    .map(({ userId, desde, largo }) => ({ userId, desde, largo }))
    .filter((m) => validos.has(m.userId) && m.desde >= 0 && m.largo > 1 && m.desde + m.largo <= texto.length && texto[m.desde] === '@')
    .sort((a, b) => a.desde - b.desde);
  const aceptadas: MencionEnMensaje[] = [];
  for (const mencion of candidatas) {
    const anterior = aceptadas[aceptadas.length - 1];
    if (anterior && mencion.desde < anterior.desde + anterior.largo) continue;
    aceptadas.push(mencion);
    if (aceptadas.length === MAX_MENCIONES) break;
  }
  return aceptadas;
}

/**
 * El texto partido en tramos y menciones, para dibujarlo. Un rango que ya no
 * calza (no cae sobre un «@») se ignora: el texto se ve igual, sin resaltar.
 */
export function partirEnMenciones(texto: string, menciones: readonly MencionEnMensaje[] | undefined): TramoConMenciones[] {
  const tramos: TramoConMenciones[] = [];
  let desde = 0;
  for (const mencion of [...(menciones ?? [])].sort((a, b) => a.desde - b.desde)) {
    if (mencion.desde < desde || texto[mencion.desde] !== '@' || mencion.desde + mencion.largo > texto.length) continue;
    if (mencion.desde > desde) tramos.push({ tipo: 'texto', texto: texto.slice(desde, mencion.desde) });
    tramos.push({ tipo: 'mencion', userId: mencion.userId, texto: texto.slice(mencion.desde, mencion.desde + mencion.largo) });
    desde = mencion.desde + mencion.largo;
  }
  if (desde < texto.length || tramos.length === 0) tramos.push({ tipo: 'texto', texto: texto.slice(desde) });
  return tramos;
}
