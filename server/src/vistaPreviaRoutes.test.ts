import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildApp } from './app.js';
import { signSession } from './sessions.js';
import { resetVistasPrevias } from './vistaPreviaRoutes.js';

const jwt = signSession({ userId: '665f1a2b3c4d5e6f70818293', deviceId: 'd1', email: 'x' });
const tarjeta = { url: 'https://lila.pe/almuerzo', titulo: 'Menú', sitio: 'lila.pe' };

describe('GET /api/enlaces/vista-previa', () => {
  beforeEach(() => resetVistasPrevias());

  it('sin sesión, 401', async () => {
    const app = buildApp({ traerVistaPrevia: vi.fn() });
    await request(app).get('/api/enlaces/vista-previa').query({ url: tarjeta.url }).expect(401);
  });

  it('una url que no es pública, 400 y no sale a buscar nada', async () => {
    const traer = vi.fn();
    const app = buildApp({ traerVistaPrevia: traer });
    await request(app).get('/api/enlaces/vista-previa').query({ url: 'http://127.0.0.1/' }).set('Authorization', `Bearer ${jwt}`).expect(400);
    expect(traer).not.toHaveBeenCalled();
  });

  it('devuelve la tarjeta y la segunda vez sale de la caché', async () => {
    const traer = vi.fn().mockResolvedValue(tarjeta);
    const app = buildApp({ traerVistaPrevia: traer });

    for (const _vuelta of [1, 2]) {
      const { body } = await request(app).get('/api/enlaces/vista-previa').query({ url: tarjeta.url }).set('Authorization', `Bearer ${jwt}`).expect(200);
      expect(body.vistaPrevia).toEqual(tarjeta);
    }
    expect(traer).toHaveBeenCalledTimes(1);
  });

  it('una página sin tarjeta (o que no respondió) devuelve null, y también se recuerda', async () => {
    const traer = vi.fn().mockResolvedValue(null);
    const app = buildApp({ traerVistaPrevia: traer });

    for (const _vuelta of [1, 2]) {
      const { body } = await request(app).get('/api/enlaces/vista-previa').query({ url: tarjeta.url }).set('Authorization', `Bearer ${jwt}`).expect(200);
      expect(body.vistaPrevia).toBeNull();
    }
    expect(traer).toHaveBeenCalledTimes(1);
  });

  it('si traerla revienta, null y no 500', async () => {
    const app = buildApp({ traerVistaPrevia: vi.fn().mockRejectedValue(new Error('timeout')) });
    const { body } = await request(app).get('/api/enlaces/vista-previa').query({ url: tarjeta.url }).set('Authorization', `Bearer ${jwt}`).expect(200);
    expect(body.vistaPrevia).toBeNull();
  });
});
