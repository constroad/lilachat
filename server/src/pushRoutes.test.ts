import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { DeviceModel } from './models.js';
import { signSession } from './sessions.js';
import { resetVapidConfig } from './webPushSender.js';

/**
 * La suscripción de Web Push (F6).
 *
 * Es la credencial con la que el server le habla al navegador, así que el
 * dispositivo que la guarda sale del JWT y NUNCA del cuerpo: si viniera del
 * cliente, cualquiera con sesión podría redirigir las notificaciones de otro a
 * su propio navegador.
 */
let mongo: MongoMemoryServer;
const app = buildApp();
const userId = new Types.ObjectId();
const deviceId = 'device-web-1';
const jwt = signSession({ userId: String(userId), deviceId, email: '+51902049935' });

const suscripcion = {
  endpoint: 'https://fcm.googleapis.com/wp/abc',
  keys: { p256dh: 'llave-publica', auth: 'secreto' },
};

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await DeviceModel.deleteMany({});
  await DeviceModel.create({ deviceId, userId, platform: 'web' });
  resetVapidConfig();
});

describe('POST /api/push/subscribe', () => {
  it('guarda la suscripción en el dispositivo de la sesión', async () => {
    const respuesta = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ subscription: suscripcion });

    expect(respuesta.status).toBe(204);
    const device = await DeviceModel.findOne({ deviceId }).lean();
    expect(JSON.parse(device!.pushToken!)).toEqual(suscripcion);
    expect(device!.platform).toBe('web');
  });

  /** Sin sesión no hay dispositivo al que atarla. */
  it('rechaza sin sesión', async () => {
    const respuesta = await request(app)
      .post('/api/push/subscribe')
      .send({ subscription: suscripcion });

    expect(respuesta.status).toBe(401);
  });

  /**
   * Guardar basura sería peor que rechazarla: el envío la leería, la
   * descartaría en silencio y el usuario creería estar suscrito.
   */
  it('rechaza una suscripción incompleta', async () => {
    const respuesta = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ subscription: { endpoint: 'https://x' } });

    expect(respuesta.status).toBe(400);
    const device = await DeviceModel.findOne({ deviceId }).lean();
    expect(device!.pushToken).toBeFalsy();
  });

  /** El endpoint termina en un `fetch` del server: `http://` es SSRF. */
  it('rechaza un endpoint que no sea https', async () => {
    const respuesta = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ subscription: { ...suscripcion, endpoint: 'http://interno/admin' } });

    expect(respuesta.status).toBe(400);
  });

  /** Desactivar las notificaciones tiene que borrar la credencial de verdad. */
  it('DELETE olvida la suscripción', async () => {
    await DeviceModel.updateOne({ deviceId }, { pushToken: JSON.stringify(suscripcion) });

    const respuesta = await request(app)
      .delete('/api/push/subscribe')
      .set('Authorization', `Bearer ${jwt}`);

    expect(respuesta.status).toBe(204);
    const device = await DeviceModel.findOne({ deviceId }).lean();
    expect(device!.pushToken).toBeFalsy();
  });
});

describe('GET /api/push/key', () => {
  /**
   * La clave PÚBLICA la necesita el navegador para suscribirse. Va sin sesión
   * porque no es un secreto —se publica en el bundle de cualquier app web— y
   * exigir JWT solo complicaría el arranque del service worker.
   */
  it('sin claves configuradas lo DICE, en vez de devolver una vacía', async () => {
    delete process.env.VAPID_PUBLIC_KEY;

    const respuesta = await request(app).get('/api/push/key');

    expect(respuesta.status).toBe(503);
    expect(respuesta.body.key).toBeUndefined();
  });

  it('devuelve la clave pública cuando está configurada', async () => {
    process.env.VAPID_PUBLIC_KEY = 'BLlave-publica-de-prueba';

    const respuesta = await request(app).get('/api/push/key');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.key).toBe('BLlave-publica-de-prueba');
    delete process.env.VAPID_PUBLIC_KEY;
  });
});
