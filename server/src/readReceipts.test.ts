import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel, ReceiptModel } from './chatModels.js';
import { signSession } from './sessions.js';
import { listChats } from './listaDeChats.js';
import { infoDeMensaje } from './infoDeMensaje.js';
import { MessageModel } from './chatModels.js';
import { receiptAudience, receiptFor } from './readPrivacy.js';

/** «Confirmaciones de lectura», como WhatsApp (R31/10): off in a 1:1 = only «delivered», both ways; groups always. */
let mongo: MongoMemoryServer;
const app = buildApp();
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let beto: Types.ObjectId;
let directId: Types.ObjectId;
let groupId: Types.ObjectId;
const jwtOf = (userId: Types.ObjectId) => signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x@x.com' });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), ReceiptModel.deleteMany({}), MessageModel.deleteMany({})]);
  [jose, ana, beto] = (await UserModel.create([{ phone: '51900000901', name: 'José' }, { phone: '51900000902', name: 'Ana' }, { phone: '51900000903', name: 'Beto' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  directId = (await ChatModel.create({ kind: 'direct', members: [{ userId: jose }, { userId: ana }], lastSeq: 3 }))._id;
  groupId = (await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: jose }, { userId: ana }, { userId: beto }], lastSeq: 3 }))._id;
  await MessageModel.insertMany([1, 2, 3].map((seq) => ({ chatId: directId, seq, senderId: jose, clientKey: `k${seq}`, body: `m${seq}`, kind: 'text' as const })));
  await ReceiptModel.create([
    { chatId: directId, userId: ana, readSeq: 3, deliveredSeq: 3 },
    { chatId: groupId, userId: ana, readSeq: 3, deliveredSeq: 3 },
    { chatId: groupId, userId: beto, readSeq: 3, deliveredSeq: 3 },
  ]);
});

describe('GET/PUT /api/me/read-receipts', () => {
  it('on by default; turning it off is kept; anything but a yes/no is refused', async () => {
    const jwt = jwtOf(ana);
    expect((await request(app).get('/api/me/read-receipts').set('Authorization', `Bearer ${jwt}`).expect(200)).body).toEqual({ on: true });
    await request(app).put('/api/me/read-receipts').set('Authorization', `Bearer ${jwt}`).send({ on: false }).expect(200, { on: false });
    expect((await request(app).get('/api/me/read-receipts').set('Authorization', `Bearer ${jwt}`).expect(200)).body).toEqual({ on: false });
    await request(app).put('/api/me/read-receipts').set('Authorization', `Bearer ${jwt}`).send({ on: 'no' }).expect(400);
  });
});

describe('who learns «leído»', () => {
  it('Ana turned them off: in our 1:1 José sees «delivered», not «read»', async () => {
    // Arrange
    await UserModel.updateOne({ _id: ana }, { $set: { readReceiptsOff: true } });
    // Act
    const row = (await listChats(jose)).find((chat) => chat.id === String(directId))!;
    const info = await infoDeMensaje({ chatId: String(directId), seq: 3, quien: jose });
    // Assert
    expect(row.othersReadSeq).toBe(0);
    expect(row.othersDeliveredSeq).toBe(3);
    expect(info.ok && info.miembros[0]!.estado).toBe('delivered');
  });

  it('José turned them off: he does not see Ana\'s either (both ways, like WhatsApp)', async () => {
    await UserModel.updateOne({ _id: jose }, { $set: { readReceiptsOff: true } });
    const row = (await listChats(jose)).find((chat) => chat.id === String(directId))!;
    expect(row.othersReadSeq).toBe(0);
  });

  it('in a group they are always sent', async () => {
    await UserModel.updateOne({ _id: ana }, { $set: { readReceiptsOff: true } });
    const row = (await listChats(jose)).find((chat) => chat.id === String(groupId))!;
    expect(row.othersReadSeq).toBe(3);
    expect((await receiptAudience(String(groupId))).hideRead).toBe(false);
  });

  it('with both on nothing changes', async () => {
    const row = (await listChats(jose)).find((chat) => chat.id === String(directId))!;
    expect(row.othersReadSeq).toBe(3);
    expect((await receiptAudience(String(directId))).hideRead).toBe(false);
  });

  it('the live receipt: the reader\'s own devices keep «leído»; the other only learns «delivered»', async () => {
    // Arrange
    await UserModel.updateOne({ _id: ana }, { $set: { readReceiptsOff: true } });
    const frame = { chatId: String(directId), userId: String(ana), readSeq: 3, deliveredSeq: 3 };
    // Act
    const audience = await receiptAudience(String(directId));
    // Assert
    expect(audience).toEqual({ members: [String(jose), String(ana)], hideRead: true });
    expect(receiptFor(String(ana), String(ana), frame, true)).toEqual(frame);
    expect(receiptFor(String(jose), String(ana), frame, true)).toEqual({ chatId: String(directId), userId: String(ana), deliveredSeq: 3 });
    expect(receiptFor(String(jose), String(ana), { chatId: 'c', userId: 'u', readSeq: 5 }, true)).toEqual({ chatId: 'c', userId: 'u', deliveredSeq: 5 });
  });

  it('an id that is not a chat has no audience', async () => {
    expect(await receiptAudience('no-es-un-id')).toEqual({ members: [], hideRead: false });
  });
});
