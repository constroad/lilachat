import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * El dev server hace de proxy a Express: así el navegador ve UN solo origen y
 * no hay CORS ni cookies de terceros que resolver — que es exactamente cómo va
 * a correr en producción, donde Express sirve el bundle.
 */
/**
 * The version the web shows in Ajustes (José, 21/10): the product's version
 * (the app's `app.json`), the commit and when it was built.
 */
function webBuild(): { version: string; commit: string; builtAt: string } {
  return { version: productVersion(), commit: shortCommit(), builtAt: new Date().toISOString() };
}

/** The build never fails over it: a release tree without `app/` says «dev». */
function productVersion(): string {
  try {
    const appJson = JSON.parse(readFileSync(new URL('../app/app.json', import.meta.url), 'utf8')) as { expo?: { version?: string } };
    return appJson.expo?.version ?? 'dev';
  } catch {
    return 'dev';
  }
}

/** Without git (a release made with `git archive`) the label goes without the commit. */
function shortCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: fileURLToPath(new URL('.', import.meta.url)), stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

export default defineConfig({
  plugins: [react()],
  define: { __WEB_VERSION__: JSON.stringify(webBuild()) },
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
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Las librerías en piezas propias (W2): cambian poco, así que el
        // navegador las guarda entre versiones y cada deploy baja solo la app.
        // Los íconos NO van acá: forzarlos en una pieza mete los 1500 de lucide.
        manualChunks: {
          react: ['react', 'react-dom/client'],
          datos: ['dexie', 'dexie-react-hooks', 'socket.io-client'],
          interfaz: ['@radix-ui/react-dropdown-menu', '@tanstack/react-virtual'],
        },
      },
    },
  },
  test: { environment: 'jsdom', globals: true, setupFiles: './src/test/setup.ts' },
});
