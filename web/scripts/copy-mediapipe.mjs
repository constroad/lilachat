/**
 * Copies MediaPipe's wasm (the web sticker cutout) to `public/mediapipe/<version>/`:
 * served from our own origin — the CSP does not allow scripts from a CDN — and
 * with the version in the path, so a new deploy never mixes the loader of one
 * version with the binary of another. Runs before `dev` and `build`; the
 * folder is not in the repo (10 MB).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILES = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm'];
const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = dirname(createRequire(join(web, 'package.json')).resolve('@mediapipe/tasks-vision'));
const { version } = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
const target = join(web, 'public', 'mediapipe', version);

mkdirSync(target, { recursive: true });
for (const file of FILES) {
  if (!existsSync(join(target, file))) copyFileSync(join(packageDir, 'wasm', file), join(target, file));
}
console.log(`[mediapipe] ${version} in public/mediapipe/${version}`);
