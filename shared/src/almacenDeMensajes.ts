/**
 * El almacén durable de mensajes del teléfono (F12.0). Lo PURO, compartido por
 * la app y la web.
 *
 * Hasta acá el teléfono guardaba una CACHÉ: un blob por chat con los últimos 60
 * mensajes, recortado en cada escritura. Con el cifrado por defecto (F12.3) el
 * server deja de poder leer las conversaciones, así que la copia completa tiene
 * que vivir en el teléfono, fila por fila — y de esa copia sale el respaldo.
 *
 * El server sigue siendo la verdad sobre QUÉ mensajes existen (modelo Telegram,
 * `conciliarMensajes.ts`): el almacén guarda lo que llega y borra lo que el
 * server dejó de tener. Esta función es el puente entre las dos cosas.
 */

/**
 * Qué `seq` hay que BORRAR del disco después de conciliar una página.
 *
 * `conciliarPagina` ya decidió qué se queda en pantalla; acá se calcula lo que
 * se fue. Es una resta, pero es la resta que evita el bug que José pidió
 * limpiar (30/08/2026): un mensaje borrado en la base que seguía dibujándose en
 * cada teléfono. Si el disco no se pone de acuerdo con la pantalla, la línea
 * vuelve en la próxima apertura.
 */
export function seqsQueSobran<T extends { seq: number }>(guardados: T[], conciliados: T[]): number[] {
  const quedan = new Set(conciliados.map((uno) => uno.seq));
  return guardados.map((uno) => uno.seq).filter((seq) => !quedan.has(seq));
}

/** El primer `seq` de todo chat: el server numera desde 1. */
const PRIMER_SEQ = 1;

/**
 * La página anterior servida DESDE el teléfono — o `null` si hay que pedirla
 * al server.
 *
 * El almacén puede tener huecos: un teléfono que vuelve tras días recibe 200
 * mensajes del delta y queda un agujero entre lo viejo y lo nuevo. Servir «lo
 * que hay antes» saltando el agujero haría desaparecer conversación sin que
 * nadie lo note. Así que lo local solo vale si es CONTIGUO hasta `beforeSeq` y
 * está entero: `limit` filas, o menos pero llegando al primer mensaje.
 */
export function tramoContiguoAntesDe<T extends { seq: number }>(params: {
  /** Las filas locales con `seq < beforeSeq`, ascendentes, a lo sumo `limit`. */
  locales: T[];
  beforeSeq: number;
  limit: number;
}): T[] | null {
  const { locales, beforeSeq, limit } = params;
  const primero = locales[0];
  const ultimo = locales[locales.length - 1];
  if (!primero || !ultimo) return null;

  const pegadoALaPantalla = ultimo.seq === beforeSeq - 1;
  const sinHuecosAdentro = ultimo.seq - primero.seq + 1 === locales.length;
  const entero = locales.length === limit || primero.seq === PRIMER_SEQ;

  return pegadoALaPantalla && sinHuecosAdentro && entero ? locales : null;
}

export type Hueco = { desde: number; hasta: number };

/**
 * Qué tramos faltan en el teléfono para tener el chat entero, de `1` al último
 * `seq` del server. Es lo que pide el hidratador (F12.0b) y lo que hace que el
 * respaldo sea completo.
 *
 * Se miran los NÚMEROS y no una bandera «completo»: un hueco puede formarse
 * después de haber estado completo, y una bandera no se entera.
 */
export function huecosDelHistorial(seqsLocales: readonly number[], ultimoDelServer: number): Hueco[] {
  const huecos: Hueco[] = [];
  let esperado = PRIMER_SEQ;

  for (const seq of [...seqsLocales].sort((a, b) => a - b)) {
    if (seq > ultimoDelServer) break;
    if (seq > esperado) huecos.push({ desde: esperado, hasta: seq - 1 });
    if (seq >= esperado) esperado = seq + 1;
  }
  if (esperado <= ultimoDelServer) huecos.push({ desde: esperado, hasta: ultimoDelServer });

  return huecos;
}

/**
 * ¿La página que contestó el server trae algo del hueco que se le pidió?
 *
 * El server también puede tener huecos: las líneas de prueba que José pidió
 * limpiar se borraron de la BASE y esos `seq` no existen en ningún lado. Una
 * página sin nada del hueco significa que no hay con qué llenarlo, y el
 * hidratador tiene que darlo por cerrado en vez de pedirlo para siempre.
 */
export function cubreHueco<T extends { seq: number }>(pagina: readonly T[], hueco: Hueco): boolean {
  return pagina.some((uno) => uno.seq >= hueco.desde && uno.seq <= hueco.hasta);
}

/**
 * El hueco que toca pedir: el más nuevo que no se sepa irrellenable.
 *
 * `sinRemedio` son los `hasta` de huecos que el server tampoco tiene. Sin
 * saltearlos, el primero de esos frenaba la hidratación del chat entero y los
 * huecos más viejos quedaban sin pedir para siempre.
 */
export function siguienteHueco(huecos: readonly Hueco[], sinRemedio: ReadonlySet<number>): Hueco | null {
  for (let i = huecos.length - 1; i >= 0; i -= 1) {
    const hueco = huecos[i];
    if (hueco && !sinRemedio.has(hueco.hasta)) return hueco;
  }
  return null;
}
