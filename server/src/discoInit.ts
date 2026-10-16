import './env.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MARCA_DEL_DISCO, raizDeRespaldos } from './respaldoDisco.js';

/**
 * Se corre UNA vez, a mano, con el disco externo montado: crea la raíz de los
 * respaldos y la marca `.lilachat` que el server usa para saber que el disco
 * está. Nunca lo hace el server solo — con el disco desmontado escribiría en
 * el disco de arranque. Copiado de Lilafotos (`discoInit.ts`).
 *
 *   npm run disco:init -w server
 */
const raiz = raizDeRespaldos();
await mkdir(raiz, { recursive: true });
await writeFile(path.join(raiz, MARCA_DEL_DISCO), `lilachat-datos · creado ${new Date().toISOString()}\n`, {
  flag: 'wx',
}).catch((error: NodeJS.ErrnoException) => {
  if (error.code !== 'EEXIST') throw error;
});
console.log(`[lilachat] raíz de respaldos lista: ${raiz}`);
