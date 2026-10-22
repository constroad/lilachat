import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { cabecerasDeSeguridad, politicaDeContenido } from './cabecerasDeSeguridad.js';

/** W0 (19/10): la web se sirve con una CSP estricta y sin poder ir en un iframe. */
describe('cabecerasDeSeguridad', () => {
  const app = express();
  app.use(cabecerasDeSeguridad);
  app.get('/', (_req, res) => res.send('<html></html>'));

  it('pone la CSP, nosniff, el referrer y prohíbe los iframes', async () => {
    const response = await request(app).get('/').set('Host', 'lilachat.constroad.com');

    expect(response.headers['content-security-policy']).toBe(politicaDeContenido('lilachat.constroad.com'));
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('same-origin');
    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('la CSP: scripts solo propios, sin eval, sin objetos ni iframes, socket al mismo host', () => {
    const csp = politicaDeContenido('lilachat.constroad.com');

    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-src 'self' blob:");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('wss://lilachat.constroad.com');
  });

  it('el recorte de stickers de la web: wasm sí (no el eval de JS) y el modelo solo del almacenamiento de MediaPipe', () => {
    const csp = politicaDeContenido('lilachat.constroad.com');

    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(csp).toMatch(/connect-src [^;]*https:\/\/storage\.googleapis\.com\/mediapipe-models\//);
  });

  it('un Host raro no se cuela en la política', () => {
    expect(politicaDeContenido('evil.com; script-src *')).not.toContain('script-src *');
  });
});
