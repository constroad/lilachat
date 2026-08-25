import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * El dev server hace de proxy a Express: así el navegador ve UN solo origen y
 * no hay CORS ni cookies de terceros que resolver — que es exactamente cómo va
 * a correr en producción, donde Express sirve el bundle.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Al FUENTE, no al `dist`.
      //
      // Sin esto, `tsc` resuelve `@lilachat/shared` por el `paths` del
      // tsconfig —que apunta a `src`— y Vite por node_modules —que apunta al
      // `dist` compilado—. Las dos vistas discrepan apenas se agrega algo a
      // shared sin recompilar: el typecheck pasa y el navegador tira «does not
      // provide an export named X». Pasó con `mergeIncoming`.
      '@lilachat/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 4004,
    proxy: {
      '/api': 'http://127.0.0.1:4003',
      '/socket.io': { target: 'http://127.0.0.1:4003', ws: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
  test: { environment: 'jsdom', globals: true, setupFiles: './src/test/setup.ts' },
});
