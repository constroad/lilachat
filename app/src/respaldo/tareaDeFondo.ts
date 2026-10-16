import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { loadCredential } from '../auth/credentialStore';
import { leerChatsGuardados } from '../chat/chatsGuardados';
import { correrRespaldo } from './correrRespaldo';

/**
 * El respaldo en segundo plano (F12.1), con el patrón de Lilafotos: WorkManager
 * decide CUÁNDO; nosotros decidimos SI (wifi, cargando) al despertar. Sin
 * foreground service ni wakelocks para esto: si el sistema posterga seis
 * horas, está bien — un respaldo del mediodía a las dos de la mañana es el
 * mismo respaldo.
 *
 * `expo-background-task` no deja pedir «cargando» como restricción nativa; la
 * corrida lo comprueba al arrancar (`puedeSubirAhora`) y, si no se cumple,
 * termina en milisegundos. Presupuesto: 8 de los 10 minutos de WorkManager.
 */
export const NOMBRE_DE_TAREA = 'lilachat-respaldo';
const PRESUPUESTO_FONDO_MS = 8 * 60_000;
const INTERVALO_MIN = 60;

TaskManager.defineTask(NOMBRE_DE_TAREA, async () => {
  const credencial = await loadCredential();
  // Sin sesión no hay nada que respaldar: la tarea termina sin ruido.
  if (!credencial) return BackgroundTask.BackgroundTaskResult.Success;
  try {
    await correrRespaldo({
      jwt: credencial.jwt,
      telefono: credencial.phone,
      chats: (await leerChatsGuardados()) ?? [],
      forzado: false,
      presupuestoMs: PRESUPUESTO_FONDO_MS,
    });
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error('[respaldo] la tarea de fondo falló:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registrarTareaDeFondo(): Promise<void> {
  try {
    const estado = await BackgroundTask.getStatusAsync();
    if (estado === BackgroundTask.BackgroundTaskStatus.Restricted) return;
    if (await TaskManager.isTaskRegisteredAsync(NOMBRE_DE_TAREA)) return;
    await BackgroundTask.registerTaskAsync(NOMBRE_DE_TAREA, { minimumInterval: INTERVALO_MIN });
  } catch (error) {
    console.error('[respaldo] no se pudo registrar la tarea de fondo:', error);
  }
}

export async function desregistrarTareaDeFondo(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(NOMBRE_DE_TAREA)) {
      await BackgroundTask.unregisterTaskAsync(NOMBRE_DE_TAREA);
    }
  } catch {
    // Una tarea que no se pudo desregistrar termina sola: sin credencial no hace nada.
  }
}
