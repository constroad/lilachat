/**
 * Qué claves de la caché vieja se migran al almacén (F12.0). PURO.
 *
 * La caché guardaba un blob cifrado por chat en AsyncStorage bajo
 * `lilachat.msgs.<chatId>`. La migración lee cada uno, lo abre con la misma
 * clave y lo vuelca en SQLite; acá solo se decide CUÁLES son.
 */
export const PREFIJO_CACHE_VIEJA = 'lilachat.msgs.';

export function chatIdsAMigrar(claves: readonly string[]): string[] {
  return claves
    .filter((clave) => clave.startsWith(PREFIJO_CACHE_VIEJA) && clave.length > PREFIJO_CACHE_VIEJA.length)
    .map((clave) => clave.slice(PREFIJO_CACHE_VIEJA.length));
}
