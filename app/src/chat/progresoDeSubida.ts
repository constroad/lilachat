/**
 * El porcentaje que se muestra al subir un archivo. Motor PURO.
 *
 * José, 27/08/2026, mandando una foto: «encima sale 199%, qué asco».
 *
 * Tenía razón y el número no era un detalle cosmético: **199 % es una barra que
 * miente**, y una barra que miente es peor que no tener barra — deja de servir
 * para saber cuánto falta.
 *
 * El origen es que `XMLHttpRequest.upload` en React Native reporta un `loaded`
 * que no se corresponde con el `total` que informa: en un multipart el archivo
 * se contabiliza además de la envoltura, así que la razón se pasa de 1. En vez
 * de adivinar la fórmula del bindeo nativo —que cambia entre versiones— se
 * ACOTA: el progreso de algo que sube está entre 0 y 100, siempre, y eso es
 * cierto sin importar cómo lo cuente la plataforma.
 */
export function porcentajeDeSubida(razon: number): number {
  // `NaN` e `Infinity` salen de un `total` en cero: el archivo todavía no se
  // midió. Eso NO es estar terminado, así que se muestra 0 y no 100 — decir 100
  // sin saberlo es la misma mentira que el 199 %.
  if (!Number.isFinite(razon) || razon <= 0) return 0;
  return Math.min(100, Math.round(razon * 100));
}

/**
 * El texto de la etiqueta.
 *
 * Al llegar a 100 no dice «100 %» sino que cambia de frase: los últimos bytes
 * llegan mucho antes de que el server responda, así que un «100 %» quieto
 * durante segundos se lee como colgado. Es el mismo motivo por el que WhatsApp
 * cambia a un círculo giratorio al final.
 */
export function textoDeSubida(razon: number): string {
  const porcentaje = porcentajeDeSubida(razon);
  return porcentaje >= 100 ? 'Procesando…' : `Enviando… ${porcentaje}%`;
}
