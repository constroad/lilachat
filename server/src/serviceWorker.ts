import { createHash } from 'node:crypto';
import type { Express } from 'express';

/**
 * El service worker de la web (W4). Se sirve por `/service-worker` (SIN
 * extensión) con `no-store`: Cloudflare cachea por extensión, y un `.js`
 * quedaba horas viejo — la versión nueva no le llegaba a nadie.
 *
 * La versión sale del `index.html` del build: cada deploy cambia los nombres
 * con hash de los archivos, cambia el `index.html`, cambia el script y el
 * navegador instala el service worker nuevo.
 */
export const versionDelBundle = (indexHtml: string): string => createHash('sha256').update(indexHtml).digest('hex').slice(0, 12);

export const scriptDelServiceWorker = (plantilla: string, version: string): string => plantilla.replaceAll('__VERSION__', version);

export function montarServiceWorker(app: Express, archivos: { plantilla: string; indexHtml: string }): void {
  const script = scriptDelServiceWorker(archivos.plantilla, versionDelBundle(archivos.indexHtml));
  // `/sw.js` es la ruta vieja (F6): los navegadores que ya lo tienen la siguen
  // pidiendo para actualizarse, y tienen que recibir el mismo script.
  app.get(['/service-worker', '/sw.js'], (_req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Service-Worker-Allowed', '/');
    res.send(script);
  });
}
