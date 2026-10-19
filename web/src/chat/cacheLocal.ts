/**
 * La caché VIEJA de la web (F6–W0): la lista y los últimos mensajes en
 * `localStorage`, sin cifrar y con tope de ~5 MB.
 *
 * Desde W1 (19/10/2026) todo vive en IndexedDB (`local/baseLocal.ts`). Lo que
 * quedó acá se borra al arrancar y al cerrar sesión: es historial en claro que
 * ya no se usa. **Nunca lanza.**
 */
const CLAVE_CHATS = 'lilachat.chats';
const PREFIJO_MENSAJES = 'lilachat.msgs.';
/** Los emojis recientes del panel (lo guarda la librería): tampoco se heredan. */
const CLAVE_EMOJIS_RECIENTES = 'epr_suggested';

/** Al abrir borra lo viejo; al salir (`alSalir`), también los emojis recientes. */
export function olvidarCache({ alSalir = false }: { alSalir?: boolean } = {}): void {
  try {
    const claves = Object.keys(localStorage).filter(
      (clave) => clave === CLAVE_CHATS || (alSalir && clave === CLAVE_EMOJIS_RECIENTES) || clave.startsWith(PREFIJO_MENSAJES)
    );
    claves.forEach((clave) => localStorage.removeItem(clave));
  } catch {
    // Modo privado o almacenamiento bloqueado: no hay nada que borrar.
  }
}
