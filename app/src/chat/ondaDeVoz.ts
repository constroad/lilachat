/**
 * La onda de una nota de voz (FL9). PURO.
 *
 * El grabador mide el nivel cada 250 ms en dB (0 es el tope, cuanto más
 * negativo más silencio). Se pasa a barras de 0 a 100, como dibuja WhatsApp:
 * por debajo de -60 dB ya es silencio para el oído.
 */
const SILENCIO_DB = -60;
/** Las barras que se mandan y se dibujan. */
export const BARRAS_DE_ONDA = 40;

const nivel = (db: number) => Math.round(Math.min(1, Math.max(0, (db - SILENCIO_DB) / -SILENCIO_DB)) * 100);

export function ondaDesdeMuestras(muestrasDb: readonly number[], barras = BARRAS_DE_ONDA): number[] {
  const niveles = muestrasDb.filter((db) => Number.isFinite(db)).map(nivel);
  if (niveles.length <= barras) return niveles;
  // Más muestras que barras: cada barra es el promedio de su tramo.
  return Array.from({ length: barras }, (_, indice) => {
    const desde = Math.floor((indice * niveles.length) / barras);
    const hasta = Math.max(desde + 1, Math.floor(((indice + 1) * niveles.length) / barras));
    const tramo = niveles.slice(desde, hasta);
    return Math.round(tramo.reduce((suma, valor) => suma + valor, 0) / tramo.length);
  });
}
