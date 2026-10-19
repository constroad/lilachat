/**
 * Registrar el service worker de la web (W4). Solo en producción: en
 * desarrollo, una caché vieja hace creer que un cambio no se aplicó.
 *
 * La versión nueva NO se activa sola: se avisa («Hay una versión nueva») y se
 * activa al tocar «Recargar». Se busca al volver a la pestaña, sin polling.
 */
export const RUTA_DEL_SW = '/service-worker';
export const OPCIONES_DEL_SW: RegistrationOptions = { scope: '/', updateViaCache: 'none' };

export function registrarServiceWorker(alHaberVersionNueva: () => void): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .register(RUTA_DEL_SW, OPCIONES_DEL_SW)
    .then((registro) => {
      // Esperando y con otra versión al mando: hay una nueva lista.
      const avisarSiEspera = () => {
        if (registro.waiting && navigator.serviceWorker.controller) alHaberVersionNueva();
      };
      avisarSiEspera();
      registro.addEventListener('updatefound', () => {
        const nuevo = registro.installing;
        nuevo?.addEventListener('statechange', () => nuevo.state === 'installed' && avisarSiEspera());
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registro.update().catch(() => undefined);
      });
    })
    // No es mudo: sin service worker la web anda igual, pero sin abrir sin red.
    .catch((error: unknown) => console.warn('[sw] no se pudo registrar:', error));
}

/** «Recargar»: la versión que espera toma el mando y la página se recarga una vez. */
export function activarVersionNueva(): void {
  let recargada = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargada) return;
    recargada = true;
    location.reload();
  });
  void navigator.serviceWorker.getRegistration(RUTA_DEL_SW).then((registro) => {
    if (registro?.waiting) registro.waiting.postMessage({ tipo: 'activar' });
    else location.reload();
  });
}
