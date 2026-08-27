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
import { NOMBRES_DE_COLOR, variablesDeTema, type Esquema } from '../src/tema.js';

const aqui = dirname(fileURLToPath(import.meta.url));

/**
 * El mapa listo para Tailwind, resuelto acá y no en el config.
 *
 * `shared` es ESM y `tailwind.config.js` es CommonJS: un `require()` del build
 * de `shared` funciona o no según quién corra el config (Metro, la CLI de
 * Tailwind, el editor), y cuando falla lo hace en medio de un build de Android.
 * El JSON no tiene ese problema — ya se requería antes y sigue siendo un dato.
 */
const tailwindColors: Record<string, string> = {};
for (const clase of Object.keys(NOMBRES_DE_COLOR)) {
  // `<alpha-value>` es lo que mantiene vivo el `/10` de `bg-primary/10`.
  tailwindColors[clase] = `rgb(var(--color-${clase}) / <alpha-value>)`;
}

const outPath = join(aqui, '..', 'tokens.json');
writeFileSync(outPath, JSON.stringify({ ...vividPulse, tailwindColors }, null, 2) + '\n');
console.log(`tokens.json regenerado (${Object.keys(vividPulse.colors.light).length} colores light)`);

/**
 * Y el CSS de la app, con las variables de los dos modos.
 *
 * Se GENERA en vez de escribirse a mano por el fallo que este archivo ya evitaba
 * para el JSON: dos copias de la misma paleta se desincronizan, y en el caso del
 * tema el síntoma es traicionero — una variable que Tailwind nombra y el CSS no
 * define no rompe nada, se resuelve a transparente. Uno termina buscando el
 * problema en el layout.
 */
const bloque = (selector: string, esquema: Esquema): string => {
  const lineas = Object.entries(variablesDeTema(esquema))
    .map(([nombre, valor]) => `    ${nombre}: ${valor};`)
    .join('\n');
  return `  ${selector} {\n${lineas}\n  }`;
};

const css = `/* GENERADO por \`npm run emit-tokens\` — no editar a mano.
   La paleta vive en \`shared/src/tokens.ts\` y el mapa en \`shared/src/tema.ts\`. */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Los colores son VARIABLES, no valores fijos: así \`bg-surface\` y compañía
   funcionan igual en los dos modos y ninguna pantalla necesita \`dark:\`.
   NativeWind pone la clase \`dark\` en la raíz según \`colorScheme\`. */
@layer base {
${bloque(':root', 'light')}

${bloque('.dark:root', 'dark')}
}
`;

const cssPath = join(aqui, '..', '..', 'app', 'global.css');
writeFileSync(cssPath, css);
console.log(`app/global.css regenerado (${Object.keys(variablesDeTema('dark')).length} variables × 2 modos)`);
