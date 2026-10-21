import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from '../src/testMongo.js';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { sendMessage } from '../src/chatService.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';

/** Auditoría (19/10): las fotos y archivos no se podían reenviar. */
let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let beto: Types.ObjectId;
let origen: string;
let destino: string;
let ajeno: string;
const app = buildApp();
const jwtDe = (id: Types.ObjectId) => signSession({ userId: String(id), deviceId: `d-${id}`, email: 'x' });
const reenviar = (hacia: string, quien: Types.ObjectId, body: Record<string, unknown>) =>
  request(app).post(`/api/chats/${hacia}/reenviar`).set('Authorization', `Bearer ${jwtDe(quien)}`).send(body);
const foto = { mediaId: 'image-1.jpg', url: '/files/x/image-1.jpg', thumbUrl: '/files/x/.thumb/image-1.jpg', mime: 'image/jpeg', fileName: 'foto.jpg', sizeBytes: 1200, width: 1600, height: 1200 };

beforeAll(async () => {
  process.env.LILA_PUBLIC_URL = 'https://lila.constroad.com';
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_reenvio'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  [jose, ana, beto] = (await UserModel.create([{ phone: '900000001', name: 'José' }, { phone: '900000002', name: 'Ana' }, { phone: '900000003', name: 'Beto' }])).map((u) => u._id);
  origen = String((await ChatModel.create({ kind: 'direct', members: [{ userId: jose }, { userId: ana }], lastSeq: 0 }))._id);
  destino = String((await ChatModel.create({ kind: 'direct', members: [{ userId: jose }, { userId: beto }], lastSeq: 0 }))._id);
  ajeno = String((await ChatModel.create({ kind: 'direct', members: [{ userId: ana }, { userId: beto }], lastSeq: 0 }))._id);
});

describe('reenviar una foto', () => {
  it('copia el archivo y su pie al otro chat, como mensaje mío', async () => {
    const { message } = await sendMessage({ chatId: origen, senderId: ana, clientKey: 'f-1', kind: 'image', body: 'la obra', media: foto });

    const respuesta = await reenviar(destino, jose, { desde: origen, seq: message.seq, clientKey: 'r-1' });

    expect(respuesta.status).toBe(201);
    const copia = await MessageModel.findOne({ chatId: destino }).lean();
    expect(copia).toMatchObject({ kind: 'image', body: 'la obra', senderId: jose, media: { mediaId: 'image-1.jpg', url: '/files/x/image-1.jpg', width: 1600 } });
    expect(respuesta.body.message.media.url).toMatch(/^https:\/\/lila\.constroad\.com\//);
  });

  it('el mismo clientKey no duplica', async () => {
    const { message } = await sendMessage({ chatId: origen, senderId: ana, clientKey: 'f-2', kind: 'image', media: foto });
    await reenviar(destino, jose, { desde: origen, seq: message.seq, clientKey: 'r-2' });
    await reenviar(destino, jose, { desde: origen, seq: message.seq, clientKey: 'r-2' });
    expect(await MessageModel.countDocuments({ chatId: destino })).toBe(1);
  });

  it('no se reenvía desde un chat ajeno, ni hacia uno ajeno, ni lo borrado', async () => {
    const enAjeno = await sendMessage({ chatId: ajeno, senderId: ana, clientKey: 'f-3', kind: 'image', media: foto });
    expect((await reenviar(destino, jose, { desde: ajeno, seq: enAjeno.message.seq, clientKey: 'r-3' })).status).toBe(404);

    const mio = await sendMessage({ chatId: origen, senderId: jose, clientKey: 'f-4', kind: 'image', media: foto });
    expect((await reenviar(ajeno, jose, { desde: origen, seq: mio.message.seq, clientKey: 'r-4' })).status).toBe(403);

    await MessageModel.updateOne({ chatId: origen, seq: mio.message.seq }, { $set: { deletedAt: new Date() }, $unset: { media: '' } });
    expect((await reenviar(destino, jose, { desde: origen, seq: mio.message.seq, clientKey: 'r-5' })).status).toBe(404);
  });

  it('desde o hacia un chat secreto, no', async () => {
    const { message } = await sendMessage({ chatId: origen, senderId: ana, clientKey: 'f-6', kind: 'image', media: foto });
    await ChatModel.updateOne({ _id: destino }, { $set: { encrypted: true } });
    expect((await reenviar(destino, jose, { desde: origen, seq: message.seq, clientKey: 'r-6' })).status).toBe(403);
  });
});
