import { backupStatus, runBackup } from './backupRunner.js';

/**
 * El respaldo nocturno (F7).
 *
 * Vive dentro del server, como el cron de recordatorios: un `setInterval` que
 * mira una condición barata. Montar un launchd aparte —con su plist, su log y
 * su propia forma de fallar en silencio— sería más infraestructura que trabajo.
 *
 * **La condición NO es la hora**, y esa es la decisión que importa. Si fuera
 * «son las 4:30», bastaría con que el proceso no estuviera vivo ese minuto —un
 * deploy, un reinicio, la mini apagada— para saltarse el respaldo del día
 * entero. La pregunta correcta es «¿ya hay uno de hoy?», que se contesta igual
 * de bien a las 4:30 que a las 9 de la mañana.
 */
const TICK_MS = 15 * 60_000;

/** 04:30 hora de Lima (UTC-5), que es cuando la mini no está haciendo nada. */
const HORA_LIMA = 4;
const OFFSET_LIMA = -5;

let timer: ReturnType<typeof setInterval> | null = null;

/** El día en Lima, para comparar «hoy» sin arrastrar la zona del server. */
function diaEnLima(at: Date): string {
  const local = new Date(at.getTime() + OFFSET_LIMA * 3_600_000);
  return local.toISOString().slice(0, 10);
}

function horaEnLima(at: Date): number {
  return new Date(at.getTime() + OFFSET_LIMA * 3_600_000).getUTCHours();
}

export function shouldRunBackup(params: { now: Date; lastAt: Date | null }): boolean {
  if (horaEnLima(params.now) < HORA_LIMA) return false;
  if (!params.lastAt) return true;
  return diaEnLima(params.lastAt) !== diaEnLima(params.now);
}

export function startBackupCron(): void {
  if (timer) return;

  const tick = async () => {
    try {
      const estado = await backupStatus();
      if (!shouldRunBackup({ now: new Date(), lastAt: estado.lastAt })) return;

      const resultado = await runBackup();
      console.log(
        `[backup] ${resultado.name} (${resultado.sizeBytes} B), purgados: ${resultado.removed.length}`
      );
    } catch (error) {
      // Un respaldo que falla NO tumba el server, pero SÍ deja rastro: el modo
      // de falla peligroso de un backup es el silencioso.
      console.error('[backup] falló:', error instanceof Error ? error.message : error);
    }
  };

  timer = setInterval(() => void tick(), TICK_MS);
  timer.unref?.();
  void tick();
}

export function stopBackupCron(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
