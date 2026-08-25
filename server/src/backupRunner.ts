import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { backupFileName, expiredBackups, summarizeBackups, type BackupSummary } from '@lilachat/shared';
import { MessageModel } from './chatModels.js';

const run = promisify(execFile);

/**
 * El respaldo nocturno (F7).
 *
 * `mongodump` de la base + un **manifiesto de media** → `tar.gz` en disco de la
 * mini. Los archivos de media NO se copian: ya viven en el storage de lila, que
 * tiene su propio respaldo, y duplicar gigabytes cada noche llenaría el disco
 * sin agregar seguridad. Lo que se guarda es la LISTA — con eso se sabe qué
 * falta si alguna vez hay que reconciliar.
 *
 * **Un backup sin restore no es un backup**: el camino de vuelta está en
 * `scripts/restore.ts` y se prueba contra una base efímera (spec §9).
 */
const DUMP_TIMEOUT_MS = 10 * 60_000;

export function backupDir(): string {
  return process.env.BACKUP_DIR || path.join(process.env.HOME ?? '/tmp', 'backups/lilachat');
}

function mongoUrl(): string {
  const url = process.env.MONGO_URL || '';
  if (!url) throw new Error('MONGO_URL no está configurada: no hay nada que respaldar.');
  return url;
}

/**
 * La lista de media referenciada por los mensajes.
 *
 * Sale de la BASE y no de una carpeta: lo que importa es lo que los mensajes
 * apuntan, y un archivo huérfano en el storage no es parte de la conversación.
 */
async function mediaManifest(): Promise<string> {
  // `media.url`, NO `mediaUrl`. El esquema guarda un SUBDOCUMENTO `media` y la
  // fecha se llama `at`, no `createdAt`. Con los nombres inventados la consulta
  // no encontraba nada nunca y el manifiesto decía «0 archivos» — un cero
  // perfectamente creíble, que es lo que lo hacía invisible.
  const withMedia = await MessageModel.find({ 'media.url': { $exists: true, $ne: null } })
    .select('chatId seq kind media at')
    .lean();

  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      note: 'Los binarios viven en el storage de lila. Esto es la lista de lo referenciado.',
      count: withMedia.length,
      files: withMedia.map((message) => ({
        chatId: String(message.chatId),
        seq: message.seq,
        kind: message.kind,
        mediaUrl: message.media?.url ?? null,
        thumbnailUrl: message.media?.thumbUrl ?? null,
        at: message.at,
      })),
    },
    null,
    2
  );
}

export type BackupResult = {
  name: string;
  path: string;
  sizeBytes: number;
  mediaCount: number;
  removed: string[];
};

export async function runBackup(now = new Date()): Promise<BackupResult> {
  const destino = backupDir();
  await run('/bin/mkdir', ['-p', destino]);

  // El dump se arma en un temporal PROPIO y recién al final se mueve al
  // destino: si el proceso muere a mitad, la carpeta de respaldos no queda con
  // un tar truncado que parece un backup válido.
  const trabajo = await mkdtemp(path.join(tmpdir(), 'lilachat-backup-'));
  try {
    await run('mongodump', [`--uri=${mongoUrl()}`, `--out=${path.join(trabajo, 'dump')}`], {
      timeout: DUMP_TIMEOUT_MS,
    });

    const manifest = await mediaManifest();
    await writeFile(path.join(trabajo, 'media-manifest.json'), manifest, 'utf8');

    const name = backupFileName(now);
    const temporal = path.join(trabajo, name);
    await run('/usr/bin/tar', ['-czf', temporal, '-C', trabajo, 'dump', 'media-manifest.json'], {
      timeout: DUMP_TIMEOUT_MS,
    });

    const final = path.join(destino, name);
    await run('/bin/mv', [temporal, final]);
    const info = await stat(final);

    return {
      name,
      path: final,
      sizeBytes: info.size,
      mediaCount: (JSON.parse(manifest) as { count: number }).count,
      removed: await pruneBackups(now),
    };
  } finally {
    await rm(trabajo, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Aplica la retención. La decisión de QUÉ borrar es del motor con test. */
export async function pruneBackups(now = new Date()): Promise<string[]> {
  const destino = backupDir();
  const names = await readdir(destino).catch(() => [] as string[]);
  const vencidos = expiredBackups(names, now);

  for (const name of vencidos) {
    await rm(path.join(destino, name), { force: true }).catch(() => undefined);
  }
  return vencidos;
}

export async function listBackups(): Promise<{ name: string; sizeBytes: number }[]> {
  const destino = backupDir();
  const names = await readdir(destino).catch(() => [] as string[]);

  const files = await Promise.all(
    names.map(async (name) => {
      const info = await stat(path.join(destino, name)).catch(() => null);
      return info?.isFile() ? { name, sizeBytes: info.size } : null;
    })
  );
  return files.filter((file): file is { name: string; sizeBytes: number } => file !== null);
}

export async function backupStatus(now = new Date()): Promise<BackupSummary & { dir: string }> {
  return { ...summarizeBackups(await listBackups(), now), dir: backupDir() };
}
