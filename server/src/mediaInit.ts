import './env.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MEDIA_MARKER, mediaRoot } from './mediaDisk.js';

/**
 * Run ONCE, by hand, on the machine that serves Lilachat (pending 82): creates
 * the media root and the `.lilachat-medios` marker the server uses to know the
 * disk is there. The server never does it by itself: with the disk missing it
 * would write on the startup disk (`deploy-mini` §7.16). Until it runs,
 * uploads keep going to lila.
 *
 *   npm run medios:init -w server
 */
const root = mediaRoot();
if (!root) {
  console.error('[lilachat] falta CHAT_STORAGE_ROOT: no hay dónde crear la raíz de los medios.');
  process.exit(1);
}
await mkdir(root, { recursive: true });
await writeFile(path.join(root, MEDIA_MARKER), `lilachat-medios · creado ${new Date().toISOString()}\n`, { flag: 'wx' }).catch((error: NodeJS.ErrnoException) => {
  if (error.code !== 'EEXIST') throw error;
});
console.log(`[lilachat] raíz de los medios lista: ${root}`);
