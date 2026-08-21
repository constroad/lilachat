import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

/**
 * El contrato mínimo del server (F0): el health que Torre va a consultar.
 *
 * `deploy-mini` §1: el health check prueba que ESTE servicio contesta, así que
 * el payload lleva el nombre — un puerto respondido por otro proceso no puede
 * pasar por Lilachat.
 */
describe('GET /api/health', () => {
  it('responde 200 con la identidad del servicio', async () => {
    const response = await request(buildApp()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', service: 'lilachat-server' });
  });

  it('declara la versión, para saber qué corre en producción', async () => {
    const response = await request(buildApp()).get('/api/health');

    expect(response.body.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('una ruta desconocida da 404 JSON, no un stack', async () => {
    const response = await request(buildApp()).get('/api/no-existe');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Not found' });
  });
});
