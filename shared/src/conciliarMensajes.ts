/**
 * Poner la caché del teléfono de acuerdo con lo que el server acaba de decir.
 * PURO.
 *
 * José, 30/08/2026: «limpiá esas líneas». Habían quedado en su grupo unos avisos
 * de una prueba mía que borré de la base — y **no se fueron nunca del teléfono**:
 * `mergeBySeq` solo SUMA, así que un mensaje que desaparece del server sigue
 * dibujándose para siempre en cada aparato que ya lo había guardado.
 *
 * La regla es acotada a propósito: la página que llega describe un rango de
 * `seq`, y solo dentro de ESE rango el server es la verdad. Lo de más atrás no
 * lo mencionó —borrar por silencio vaciaría el historial viejo en cada
 * apertura— y lo que llegó después por socket es más nuevo que la respuesta.
 *
 * **Ojo el día que el server empiece a olvidar a propósito.** Si alguna vez se
 * adopta el modelo de WhatsApp —el server borra el mensaje al entregarlo— esta
 * función pasa de arreglar una inconsistencia a BORRAR el historial de la gente,
 * y hay que sacarla junto con ese cambio.
 */
export function conciliarPagina<T extends { seq: number }>(guardados: T[], pagina: T[]): T[] {
  // Una página vacía no dice nada: puede ser el final del historial o una
  // respuesta rara. Tomarla como «no queda nada» borraría el chat entero.
  if (pagina.length === 0) return guardados;

  const seqs = pagina.map((uno) => uno.seq);
  const desde = Math.min(...seqs);
  const hasta = Math.max(...seqs);

  const fueraDelRango = guardados.filter((uno) => uno.seq < desde || uno.seq > hasta);

  // La versión del server pisa a la guardada: un mensaje editado o con su
  // lápida puesta tiene que verse como está ahora, no como se guardó.
  return [...fueraDelRango, ...pagina].sort((a, b) => a.seq - b.seq);
}
