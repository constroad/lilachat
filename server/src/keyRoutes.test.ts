import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { DeviceModel, UserModel } from './models.js';
import { signSession } from './sessions.js';

/**
 * Claves públicas y chats secretos (F9).
 *
 * El server es un CARTERO de claves públicas: las guarda y las reparte, y no
 * puede hacer nada con ellas. Lo que se prueba es justamente eso — que solo
 * salen claves públicas, que nadie puede publicar por otro, y que de un chat
 * secreto el server no guarda ni una letra en claro.
 */
let mongo: MongoMemoryServer;
const app = buildApp();

const yo = new Types.ObjectId();
const mama = new Types.ObjectId();
const jwtYo = signSession({ userId: String(yo), deviceId: 'd-yo', email: 'x' });
const jwtMama = signSession({ userId: String(mama), deviceId: 'd-mama', email: 'y' });

const CLAVE_YO = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=';
const CLAVE_MAMA = 'HyAhIiMkJSYnKCkqKywtLi8wMTIzNDU2Nzg5Ojs8PT4=';

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_keys_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([
    ChatModel.deleteMany({}),
    MessageModel.deleteMany({}),
    UserModel.deleteMany({}),
    DeviceModel.deleteMany({}),
  ]);
  await UserModel.create([
    { _id: yo, phone: '902049935', name: 'José' },
    { _id: mama, phone: '999000111', name: 'Mamá' },
  ]);
  await DeviceModel.create([
    { deviceId: 'd-yo', userId: yo },
    { deviceId: 'd-mama', userId: mama },
  ]);
});

describe('POST /api/keys', () => {
  it('publica la clave pública del dispositivo de la sesión', async () => {
    const respuesta = await request(app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${jwtYo}`)
      .send({ publicKey: CLAVE_YO });

    expect(respuesta.status).toBe(204);
    const device = await DeviceModel.findOne({ deviceId: 'd-yo' }).lean();
    expect(device!.publicKey).toBe(CLAVE_YO);
  });

  /**
   * El dispositivo sale del JWT y NUNCA del cuerpo. Si el cliente eligiera a
   * quién pertenece la clave, cualquiera con sesión podría publicar la suya en
   * nombre de otro — y desde ese momento leería lo que le escriban a esa
   * persona. Es el ataque que este endpoint tiene que hacer imposible.
   */
  it('no se puede publicar la clave de otro', async () => {
    await request(app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${jwtYo}`)
      .send({ publicKey: CLAVE_YO, deviceId: 'd-mama', userId: String(mama) });

    const deMama = await DeviceModel.findOne({ deviceId: 'd-mama' }).lean();
    expect(deMama!.publicKey).toBeFalsy();
  });

  /** Una clave con forma inválida no se guarda: rompería el descifrado. */
  it('rechaza una clave que no mide 32 bytes', async () => {
    const respuesta = await request(app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${jwtYo}`)
      .send({ publicKey: 'AAAA' });

    expect(respuesta.status).toBe(400);
  });

  it('sin sesión, 401', async () => {
    expect((await request(app).post('/api/keys').send({ publicKey: CLAVE_YO })).status).toBe(401);
  });
});

describe('GET /api/keys/:userId', () => {
  beforeEach(async () => {
    await DeviceModel.updateOne({ deviceId: 'd-mama' }, { publicKey: CLAVE_MAMA });
  });

  it('devuelve las claves públicas de los dispositivos de esa persona', async () => {
    const respuesta = await request(app)
      .get(`/api/keys/${mama}`)
      .set('Authorization', `Bearer ${jwtYo}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.devices).toEqual([{ deviceId: 'd-mama', publicKey: CLAVE_MAMA }]);
  });

  /** Solo lo PÚBLICO: nada del resto del dispositivo sale por acá. */
  it('no filtra nada más del dispositivo', async () => {
    await DeviceModel.updateOne({ deviceId: 'd-mama' }, { pushToken: 'token-secreto' });

    const respuesta = await request(app)
      .get(`/api/keys/${mama}`)
      .set('Authorization', `Bearer ${jwtYo}`);

    expect(JSON.stringify(respuesta.body)).not.toContain('token-secreto');
  });

  /** Quien todavía no publicó clave no puede recibir mensajes cifrados. */
  it('sin claves devuelve una lista vacía, no un error', async () => {
    const respuesta = await request(app)
      .get(`/api/keys/${yo}`)
      .set('Authorization', `Bearer ${jwtMama}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.devices).toEqual([]);
  });
});

describe('mensajes de un chat secreto', () => {
  /**
   * LA prueba de la fase: de un chat cifrado, el server no guarda ni una letra
   * en claro. Solo el sobre.
   */
  it('el server guarda el sobre y NADA del texto', async () => {
    const chat = await ChatModel.create({
      kind: 'direct',
      encrypted: true,
      lastSeq: 0,
      members: [{ userId: yo }, { userId: mama }],
    });

    await MessageModel.create({
      chatId: chat._id,
      seq: 1,
      senderId: yo,
      kind: 'text',
      clientKey: 'e1',
      envelope: { v: 1, nonce: 'bm9uY2U=', ciphertext: 'c2VjcmV0bw==' },
    });

    const guardado = await MessageModel.findOne({ seq: 1 }).lean();
    expect(guardado!.body).toBeFalsy();
    expect(guardado!.envelope!.ciphertext).toBe('c2VjcmV0bw==');
  });

  /**
   * Y el asistente NO lo mira. Un chat cifrado que igual se le manda a Claude
   * sería el peor de los dos mundos: la promesa del candado y el texto saliendo
   * por la puerta de al lado.
   */
  it('el asistente no recibe el contenido de un chat cifrado', async () => {
    const chat = await ChatModel.create({
      kind: 'direct',
      encrypted: true,
      lastSeq: 1,
      members: [{ userId: yo }, { userId: mama }],
    });
    await MessageModel.create({
      chatId: chat._id,
      seq: 1,
      senderId: mama,
      kind: 'text',
      clientKey: 'e2',
      envelope: { v: 1, nonce: 'bm9uY2U=', ciphertext: 'c2VjcmV0bw==' },
    });

    const respuesta = await request(app)
      .post('/api/assistant/catch-up')
      .set('Authorization', `Bearer ${jwtYo}`)
      .send({ chatId: String(chat._id) });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.message).toMatch(/cifrad/i);
  });
});

describe('el server corta el texto plano en un chat cifrado', () => {
  /**
   * Aunque el cliente mande LOS DOS campos, solo se guarda el sobre.
   *
   * Es lo que hace real la promesa: si el server aceptara `body` junto al
   * sobre, un cliente con un bug —o modificado a propósito— dejaría el texto en
   * claro dentro de una conversación con candado, y nadie lo notaría hasta que
   * alguien mirara la base.
   */
  it('descarta el body cuando viene un sobre', async () => {
    const { sendMessage } = await import('./chatService.js');
    const chat = await ChatModel.create({
      kind: 'direct',
      encrypted: true,
      lastSeq: 0,
      members: [{ userId: yo }, { userId: mama }],
    });

    const { message } = await sendMessage({
      chatId: String(chat._id),
      senderId: yo,
      clientKey: 'mixto',
      kind: 'text',
      body: 'esto NO debe guardarse',
      envelope: { v: 1, nonce: 'bm9uY2U=', ciphertext: 'c29icmU=' },
    });

    expect(message.body).toBeUndefined();
    expect(message.envelope?.ciphertext).toBe('c29icmU=');

    const enLaBase = await MessageModel.findById(message._id).lean();
    expect(JSON.stringify(enLaBase)).not.toContain('NO debe guardarse');
  });
});
