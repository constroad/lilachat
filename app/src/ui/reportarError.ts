import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { armarReporte } from '@lilachat/shared';

/**
 * Contarle al server que algo se rompió.
 *
 * Hasta el 26/08/2026 un fallo en el teléfono de alguien era invisible: no
 * aparecía en el server ni en Torre, y la única forma de enterarse era que la
 * persona lo contara. Esto no es un sistema de observabilidad completo — es el
 * piso: que quede UNA línea en el log de producción.
 *
 * **Nunca lanza y nunca bloquea.** Un reporte que rompe la app al fallar es
 * peor que no tener reportes; y esperar a que el reporte viaje antes de mostrar
 * la pantalla de error deja a la persona mirando el vacío mientras hay red mala.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lilachat.constroad.com';
const TIMEOUT_MS = 5_000;

export function reportarError(pantalla: string, error: unknown): void {
  const reporte = armarReporte({
    app: 'lilachat',
    version: Constants.expoConfig?.version ?? '',
    plataforma: Platform.OS,
    pantalla,
    error,
    enviadoEn: new Date().toISOString(),
  });

  // Fire-and-forget, con el `catch` obligatorio: sin él, un rechazo acá se
  // vuelve un `unhandledRejection` y el reporte de errores pasa a ser una
  // fuente de errores.
  void fetch(`${BASE_URL}/api/crash`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reporte),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => {
    // Sin red no hay nada que hacer. Encolarlo sería lo correcto y es la
    // siguiente vuelta; hoy se pierde y se sabe que se pierde.
  });

  // También al log local: con `adb logcat` se ve al instante, sin esperar al
  // server ni depender de que haya red.
  console.error(`[crash] ${pantalla} — ${reporte.mensaje}`);
}
