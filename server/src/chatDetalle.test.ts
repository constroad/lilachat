import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel, ReceiptModel } from './chatModels.js';
import { TELEFONO_DE_LILA } from '@lilachat/shared';
import { signSession } from './sessions.js';

/**
 * «Silenciar notificaciones» del detalle no se guardaba (auditoría 17/10/2026):
 * era un estado local que volvía a «apagado» al reabrir. El detalle tiene que
 * decir cómo está, y el PATCH de ajustes guardarlo — por persona.
 */
let mongo: MongoMemoryServer;
let yo: Types.ObjectId;
let chatId: Types.ObjectId;
let jwt: string;
const app = buildApp();

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), ReceiptModel.deleteMany({})]);
  yo = (await UserModel.create({ phone: '51902049935', name: 'José' }))._id;
  const otro = (await UserModel.create({ phone: '51999999999', name: 'Ana' }))._id;
  chatId = (
    await ChatModel.create({
      kind: 'group',
      name: 'Familia',
      members: [
        { userId: yo, role: 'admin' },
        { userId: otro, role: 'member', muted: true },
      ],
      lastSeq: 0,
    })
  )._id;
  jwt = signSession({ userId: String(yo), deviceId: 'd1', email: '51902049935' });
});

describe('GET /api/chats/:id/detail — silenciado', () => {
  it('dice MI estado (no el de otro miembro) y cambia al silenciar', async () => {
    const antes = await request(app).get(`/api/chats/${chatId}/detail`).set('Authorization', `Bearer ${jwt}`).expect(200);
    expect(antes.body.muted).toBe(false);

    await request(app).patch(`/api/chats/${chatId}/ajustes`).set('Authorization', `Bearer ${jwt}`).send({ muted: true }).expect(200);

    const despues = await request(app).get(`/api/chats/${chatId}/detail`).set('Authorization', `Bearer ${jwt}`).expect(200);
    expect(despues.body.muted).toBe(true);
  });
});

describe('GET /api/chats — check azul en grupos (FL8)', () => {
  it('leído solo cuando lo leyeron TODOS; quien nunca abrió cuenta como 0; Lila no cuenta', async () => {
    const [ana, luis] = await UserModel.find({ phone: { $in: ['51999999999'] } }).lean();
    const otro2 = (await UserModel.create({ phone: '51988888888', name: 'Luis' }))._id;
    const lila = (await UserModel.create({ phone: TELEFONO_DE_LILA, name: 'Lila' }))._id;
    void luis;
    await ChatModel.updateOne({ _id: chatId }, { $push: { members: { $each: [{ userId: otro2 }, { userId: lila }] } }, $set: { lastSeq: 10 } });
    await ReceiptModel.create({ chatId, userId: ana!._id, readSeq: 10, deliveredSeq: 10 });

    const soloAna = await request(app).get('/api/chats').set('Authorization', `Bearer ${jwt}`).expect(200);
    const fila = soloAna.body.chats.find((c: { id: string }) => c.id === String(chatId));
    expect(fila.othersReadSeq).toBe(0);
    expect(fila.acuseDe).toHaveLength(2);

    await ReceiptModel.create({ chatId, userId: otro2, readSeq: 8, deliveredSeq: 9 });
    const ambos = await request(app).get('/api/chats').set('Authorization', `Bearer ${jwt}`).expect(200);
    const fila2 = ambos.body.chats.find((c: { id: string }) => c.id === String(chatId));
    expect(fila2.othersReadSeq).toBe(8);
    expect(fila2.othersDeliveredSeq).toBe(9);
  });
});
