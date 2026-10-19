import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { montarServiceWorker, scriptDelServiceWorker, versionDelBundle } from './serviceWorker.js';

/**
 * W4 (19/10): el service worker se sirve por una ruta SIN extensión y sin
 * caché. Cloudflare cachea por extensión: un `.js` quedaba horas viejo y nadie
 * recibía la versión nueva (`web-app-blueprint` §4).
 */
describe('serviceWorker', () => {
  it('la versión sale del index.html: otro deploy, otra versión', () => {
    expect(versionDelBundle('<html>a</html>')).not.toBe(versionDelBundle('<html>b</html>'));
    expect(versionDelBundle('<html>a</html>')).toHaveLength(12);
  });

  it('pone la versión en el script', () => {
    expect(scriptDelServiceWorker("const VERSION = '__VERSION__';", 'abc123')).toBe("const VERSION = 'abc123';");
  });

  it('se sirve sin caché, como JavaScript y con alcance a todo el sitio', async () => {
    const app = express();
    montarServiceWorker(app, { plantilla: "const VERSION = '__VERSION__';", indexHtml: '<html>x</html>' });

    const respuesta = await request(app).get('/service-worker');

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['cache-control']).toBe('no-store');
    expect(respuesta.headers['content-type']).toMatch(/javascript/);
    expect(respuesta.headers['service-worker-allowed']).toBe('/');
    expect(respuesta.text).toContain(versionDelBundle('<html>x</html>'));
  });

  it('la ruta vieja /sw.js recibe el mismo script, con su versión', async () => {
    const app = express();
    montarServiceWorker(app, { plantilla: "const VERSION = '__VERSION__';", indexHtml: '<html>x</html>' });

    const respuesta = await request(app).get('/sw.js');

    expect(respuesta.headers['cache-control']).toBe('no-store');
    expect(respuesta.text).not.toContain('__VERSION__');
  });
});
