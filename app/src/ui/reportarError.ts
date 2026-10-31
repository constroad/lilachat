import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { armarReporte, pendingReportsFrom, queueReport, type CrashReport } from '@lilachat/shared';
import { registrarError } from '../diagnostico/diagnostico';
import { appUpdateId } from '../api/appBuild';

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

/** Where the reports that could not leave wait (31/10): a fatal error closes the app before its request goes out. */
const PENDING_KEY = 'lilachat.crash.pendientes';

export function reportarError(pantalla: string, error: unknown): void {
  // También al diagnóstico de LilaStore: ahí se miran errores y tiempos juntos.
  void registrarError(error, pantalla);
  reportToServer(pantalla, error);
}

/**
 * Only the server's report (the global handler already wrote the diagnostic).
 * Stored first and sent after: if the app dies on the way, the next start sends it.
 */
export function reportToServer(screen: string, error: unknown): void {
  const reporte = armarReporte({
    app: 'lilachat',
    version: Constants.expoConfig?.version ?? '',
    plataforma: Platform.OS,
    pantalla: screen,
    error,
    enviadoEn: new Date().toISOString(),
    // Which OTA crashed (31/10): «the app keeps closing» needs to know if the phone had the fix.
    code: appUpdateId(),
  });
  void enqueue((pending) => queueReport(pending, reporte)).then(sendPendingReports);

  // También al log local: con `adb logcat` se ve al instante, sin esperar al
  // server ni depender de que haya red.
  console.error(`[crash] ${screen} — ${reporte.mensaje}`);
}

/** At start and after each new report: what is waiting goes, and only what did not arrive stays. */
export function sendPendingReports(): Promise<void> {
  return enqueue(async (pending) => {
    const delivered = await Promise.all(pending.map(sendReport));
    return pending.filter((_report, index) => !delivered[index]);
  });
}

// One change at a time: two reports at once would each read the list before the other wrote it.
let chain: Promise<void> = Promise.resolve();
function enqueue(change: (pending: CrashReport[]) => CrashReport[] | Promise<CrashReport[]>): Promise<void> {
  chain = chain.then(async () => {
    try {
      const next = await change(pendingReportsFrom(await AsyncStorage.getItem(PENDING_KEY)));
      await (next.length ? AsyncStorage.setItem(PENDING_KEY, JSON.stringify(next)) : AsyncStorage.removeItem(PENDING_KEY));
    } catch (failure) {
      // Never throws: a report that breaks the app when it fails is worse than none.
      console.warn('[crash] no se pudo guardar el reporte:', failure instanceof Error ? failure.message : failure);
    }
  });
  return chain;
}

/** Fire and wait at most TIMEOUT_MS; any answer from the server counts as delivered (it answers 204 even to what it drops). */
async function sendReport(reporte: CrashReport): Promise<boolean> {
  try {
    const answer = await fetch(`${BASE_URL}/api/crash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reporte),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return answer.status < 500;
  } catch {
    // No signal: it stays for the next start.
    return false;
  }
}
