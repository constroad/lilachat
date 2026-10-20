import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { DestacadoModel } from './destacadoModel.js';
import { signSession } from './sessions.js';

/**
 * «Destacados» (José aprobó el 20/10): la estrella PERSONAL de WhatsApp. El
 * fijado es para todos; destacar es mío: nadie más lo ve.
 */
let mongo: MongoMemoryServer;
let yo: Types.ObjectId;
let ana: Types.ObjectId;
let chatId: Types.ObjectId;
const conJwt = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' })}` });
const app = buildApp({});

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_destacados'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({}), DestacadoModel.deleteMany({})]);
  const usuarios = await UserModel.create([{ phone: '900000001', name: 'José' }, { phone: '900000002', name: 'Ana' }]);
  yo = usuarios[0]!._id;
  ana = usuarios[1]!._id;
  chatId = (await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: yo, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 3 }))._id;
  await MessageModel.create([
    { chatId, seq: 1, senderId: ana, clientKey: 'k1', kind: 'text', body: 'Plano final en el drive', at: new Date('2026-10-20T10:00:00Z') },
    { chatId, seq: 2, senderId: yo, clientKey: 'k2', kind: 'system', body: 'aviso', at: new Date() },
    { chatId, seq: 3, senderId: ana, clientKey: 'k3', kind: 'text', body: 'Se borró', at: new Date(), deletedAt: new Date() },
  ]);
});

const ruta = (seq: number) => `/api/chats/${chatId}/destacados/${seq}`;

describe('destacar un mensaje', () => {
  it('se destaca, es idempotente, se lista en el chat y se quita', async () => {
    expect((await request(app).put(ruta(1)).set(conJwt(yo))).status).toBe(204);
    expect((await request(app).put(ruta(1)).set(conJwt(yo))).status).toBe(204);
    expect((await request(app).get(`/api/chats/${chatId}/destacados`).set(conJwt(yo))).body).toEqual({ seqs: [1] });
    // Es personal: Ana no ve la estrella de José.
    expect((await request(app).get(`/api/chats/${chatId}/destacados`).set(conJwt(ana))).body).toEqual({ seqs: [] });
    expect((await request(app).delete(ruta(1)).set(conJwt(yo))).status).toBe(204);
    expect((await request(app).get(`/api/chats/${chatId}/destacados`).set(conJwt(yo))).body).toEqual({ seqs: [] });
  });

  it('un aviso, uno borrado o uno que no existe no se destacan', async () => {
    expect((await request(app).put(ruta(2)).set(conJwt(yo))).status).toBe(400);
    expect((await request(app).put(ruta(3)).set(conJwt(yo))).status).toBe(400);
    expect((await request(app).put(ruta(99)).set(conJwt(yo))).status).toBe(400);
  });

  it('quien no es del chat no puede (404)', async () => {
    const otro = (await UserModel.create({ phone: '900000003' }))._id;
    expect((await request(app).put(ruta(1)).set(conJwt(otro))).status).toBe(404);
    expect((await request(app).get(`/api/chats/${chatId}/destacados`).set(conJwt(otro))).status).toBe(404);
  });

  it('en un chat secreto todavía no (el server no ve el texto)', async () => {
    await ChatModel.updateOne({ _id: chatId }, { $set: { encrypted: true } });
    expect((await request(app).put(ruta(1)).set(conJwt(yo))).status).toBe(400);
  });
});

describe('GET /api/destacados', () => {
  it('todos los míos, del más reciente: el mensaje, quién y en qué chat', async () => {
    await request(app).put(ruta(1)).set(conJwt(yo));
    const res = await request(app).get('/api/destacados').set(conJwt(yo));
    expect(res.status).toBe(200);
    expect(res.body.destacados).toHaveLength(1);
    expect(res.body.destacados[0]).toMatchObject({
      chatId: String(chatId),
      seq: 1,
      chat: { kind: 'group', name: 'Obra' },
      autor: { id: String(ana), name: 'Ana', phone: '900000002' },
      mensaje: { kind: 'text', body: 'Plano final en el drive' },
    });
  });

  it('si el mensaje se borró o salí del chat, ya no aparece', async () => {
    await request(app).put(ruta(1)).set(conJwt(yo));
    await MessageModel.updateOne({ chatId, seq: 1 }, { $set: { deletedAt: new Date() } });
    expect((await request(app).get('/api/destacados').set(conJwt(yo))).body.destacados).toEqual([]);
    await MessageModel.updateOne({ chatId, seq: 1 }, { $unset: { deletedAt: 1 } });
    await ChatModel.updateOne({ _id: chatId }, { $pull: { members: { userId: yo } } });
    expect((await request(app).get('/api/destacados').set(conJwt(yo))).body.destacados).toEqual([]);
  });
});
