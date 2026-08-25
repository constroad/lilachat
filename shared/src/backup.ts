/**
 * Las decisiones del respaldo (F7).
 *
 * El tamaño legible NO se define acá: `formatBytes` ya vive en `media.ts` desde
 * F3. Duplicarlo habría dado dos formatos distintos para lo mismo en dos
 * pantallas de la misma app.
 *
 * Un backup es fácil de creer y difícil de comprobar: corre de noche, escribe
 * un archivo y nadie lo mira hasta el día en que hace falta. Todo lo que
 * DECIDE algo —qué se borra, qué se muestra, si estamos al día— vive acá, con
 * test, y el que toca disco y red no decide nada.
 */

/** Cuánto se guarda. Treinta días es lo declarado en el spec §9. */
export const BACKUP_RETENTION_DAYS = 30;

/** A partir de cuántas horas sin respaldo la pantalla lo marca en rojo. */
const STALE_AFTER_HOURS = 48;

const PREFIX = 'lilachat-';
const SUFFIX = '.tar.gz';

/**
 * `lilachat-2026-08-24T043000Z.tar.gz`.
 *
 * En UTC y con la fecha en formato ordenable, para que el orden alfabético sea
 * el orden cronológico. Con hora local, el orden se rompe dos veces al año al
 * cambiar el horario, y el «último respaldo» pasaría a ser uno viejo.
 */
export function backupFileName(at: Date): string {
  const iso = at.toISOString().replace(/[:.]/g, '').replace(/\d{3}Z$/, 'Z');
  return `${PREFIX}${iso}${SUFFIX}`;
}

export function parseBackupName(name: string): Date | null {
  if (!name.startsWith(PREFIX) || !name.endsWith(SUFFIX)) return null;

  const stamp = name.slice(PREFIX.length, -SUFFIX.length);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(stamp);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const at = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * Cuáles borrar.
 *
 * **Nunca deja la carpeta vacía.** Un reloj mal puesto, o una máquina que
 * estuvo apagada un mes, haría que todo se vea vencido — y la limpieza borraría
 * hasta el último respaldo justo el día en que se necesita. El más reciente
 * sobrevive siempre, tenga la edad que tenga.
 *
 * Y lo que no reconoce, no lo toca: borrar un archivo ajeno de una carpeta
 * compartida no se deshace.
 */
export function expiredBackups(
  names: string[],
  now: Date,
  retentionDays = BACKUP_RETENTION_DAYS
): string[] {
  const known = names
    .map((name) => ({ name, at: parseBackupName(name) }))
    .filter((item): item is { name: string; at: Date } => item.at !== null)
    .sort((a, b) => b.at.getTime() - a.at.getTime());

  const limit = now.getTime() - retentionDays * 86_400_000;
  // `slice(1)` es el seguro: el más nuevo queda fuera del barrido.
  return known
    .slice(1)
    .filter((item) => item.at.getTime() < limit)
    .map((item) => item.name);
}

export type BackupSummary = {
  count: number;
  lastAt: Date | null;
  totalBytes: number;
  /** Sin respaldos, o el último demasiado viejo: la pantalla debe DECIRLO. */
  stale: boolean;
};

export function summarizeBackups(
  files: { name: string; sizeBytes: number }[],
  now: Date
): BackupSummary {
  const dates = files
    .map((file) => parseBackupName(file.name))
    .filter((at): at is Date => at !== null);

  // El MÁS RECIENTE, no el último de la lista: el orden en que el sistema de
  // archivos devuelve los nombres no es una promesa.
  const lastAt = dates.length
    ? dates.reduce((latest, at) => (at > latest ? at : latest))
    : null;

  return {
    count: files.length,
    lastAt,
    totalBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
    stale: !lastAt || now.getTime() - lastAt.getTime() > STALE_AFTER_HOURS * 3_600_000,
  };
}
