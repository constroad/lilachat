/** Por debajo de esto ya es silencio (y evita el -Infinity del log de cero). */
const PISO_DB = -100;

/** El nivel de un tramo de audio en dB (0 = tope), como el que mide el grabador de la app. */
export function nivelEnDb(muestras: Float32Array): number {
  if (muestras.length === 0) return PISO_DB;
  let suma = 0;
  for (const muestra of muestras) suma += muestra * muestra;
  const rms = Math.sqrt(suma / muestras.length);
  return rms > 0 ? Math.max(PISO_DB, 20 * Math.log10(rms)) : PISO_DB;
}

/** Los formatos en orden: webm/opus lo graban Chrome y Firefox y lo reproduce Android; Safari graba mp4. */
const PREFERIDOS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function tipoDeGrabacion(soporta: (tipo: string) => boolean): string {
  return PREFERIDOS.find((tipo) => soporta(tipo)) ?? '';
}
