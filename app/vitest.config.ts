import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * `@lilachat/shared` al FUENTE, como Metro (`metro.config.js`) y TypeScript
 * (`tsconfig.json`). Sin esto los tests leían `shared/dist`, que queda viejo
 * apenas se agrega algo a shared sin recompilar: el typecheck pasaba y el test
 * decía «colorDeAutor is not a function» (19/10).
 */
export default defineConfig({
  resolve: {
    alias: { '@lilachat/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)) },
  },
});
