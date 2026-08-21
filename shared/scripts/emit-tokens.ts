/**
 * Genera `shared/tokens.json` desde la fuente TS. Existe porque el
 * `tailwind.config` de la app corre en Node sin transpilar TS: consume el JSON
 * generado, nunca una copia a mano. Correr tras tocar `src/tokens.ts`
 * (`npm run emit-tokens` en la raíz).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { vividPulse } from '../src/tokens.js';

const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'tokens.json');
writeFileSync(outPath, JSON.stringify(vividPulse, null, 2) + '\n');
console.log(`tokens.json regenerado (${Object.keys(vividPulse.colors.light).length} colores light)`);
