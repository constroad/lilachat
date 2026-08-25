import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { parseBackupName } from '@lilachat/shared';
import { backupDir } from '../server/src/backupRunner.js';

const run = promisify(execFile);

/**
 * Restaurar un respaldo (F7).
 *
 *   npx tsx scripts/restore.ts --a "mongodb://127.0.0.1:27099" [--archivo <nombre>]
 *
 * **Un backup sin restore no es un backup.** Este script existe para que el
 * camino de vuelta esté escrito ANTES de necesitarlo, y para poder probarlo
 * contra una base efímera en cada corrida de QA (spec §9).
 *
 * EL DESTINO ES OBLIGATORIO Y EXPLÍCITO. No hay default a `MONGO_URL`: el día
 * que alguien corra esto apurado, un default apuntando a producción restauraría
 * un dump viejo ENCIMA de la base viva. Que haya que escribir la URI es la
 * protección, no una molestia.
 */
const RESTORE_TIMEOUT_MS = 10 * 60_000;

function argumento(nombre: string): string | undefined {
  const indice = process.argv.indexOf(`--${nombre}`);
  return indice > -1 ? process.argv[indice + 1] : undefined;
}

/** El más reciente de la carpeta, por FECHA del nombre y no por orden de `readdir`. */
export async function latestBackup(dir: string): Promise<string | null> {
  const names = await readdir(dir).catch(() => [] as string[]);
  const conFecha = names
    .map((name) => ({ name, at: parseBackupName(name) }))
    .filter((item): item is { name: string; at: Date } => item.at !== null)
    .sort((a, b) => b.at.getTime() - a.at.getTime());

  return conFecha[0]?.name ?? null;
}

async function main(): Promise<void> {
  const destino = argumento('a');
  if (!destino) {
    console.error(
      'Falta --a <uri>. El destino se escribe a propósito: sin eso, un descuido\n' +
        'restauraría un dump viejo encima de la base de producción.'
    );
    process.exit(1);
  }

  const dir = backupDir();
  const archivo = argumento('archivo') ?? (await latestBackup(dir));
  if (!archivo) {
    console.error(`No hay respaldos en ${dir}.`);
    process.exit(1);
  }

  const trabajo = await mkdtemp(path.join(tmpdir(), 'lilachat-restore-'));
  try {
    console.log(`Restaurando ${archivo} → ${destino.replace(/\/\/[^@]+@/, '//***@')}`);
    await run('/usr/bin/tar', ['-xzf', path.join(dir, archivo), '-C', trabajo], {
      timeout: RESTORE_TIMEOUT_MS,
    });

    // `--drop` deja la base EXACTAMENTE como el dump: sin él, una colección que
    // hoy tiene documentos que el respaldo no tenía quedaría mezclada, y el
    // resultado no sería el estado de esa noche sino una fusión inventada.
    // LA RAÍZ DEL DUMP, no la carpeta de la base.
    //
    // `mongodump --out=X` escribe `X/<base>/*.bson`, y `mongorestore` deduce a
    // qué base va cada colección DEL NOMBRE DE ESA CARPETA. Apuntarle una
    // carpeta adentro le quita esa información: restaura sin base conocida y la
    // verificación encuentra todo vacío, con el dump intacto al lado.
    const dump = path.join(trabajo, 'dump');
    const bases = await readdir(dump).catch(() => [] as string[]);
    if (bases.length === 0) throw new Error('El respaldo no contiene ningún dump.');

    await run(
      'mongorestore',
      [`--uri=${destino}`, '--drop', '--nsInclude=*.*', `--dir=${dump}`],
      { timeout: RESTORE_TIMEOUT_MS }
    );
    console.log(`   bases en el dump: ${bases.join(', ')}`);
    console.log('✅ Restaurado.');
  } finally {
    await rm(trabajo, { recursive: true, force: true }).catch(() => undefined);
  }
}

// Solo al ejecutarlo directamente: importarlo desde otro script no debe
// restaurar nada.
//
// Se compara el NOMBRE EXACTO y no un `endsWith`: con `endsWith('restore.ts')`,
// correr `qa-backup-restore.ts` disparaba este `main` —«qa-backup-restore.ts»
// termina en «restore.ts»— y el script moría pidiendo un `--a` que su llamador
// nunca le pasó.
if (path.basename(process.argv[1] ?? '') === 'restore.ts') {
  void main();
}
