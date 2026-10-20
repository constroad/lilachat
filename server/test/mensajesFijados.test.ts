import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { deleteMessage, sendMessage } from '../src/chatService.js';
import { listChats } from '../src/listaDeChats.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';

/**
 * Fijar mensajes arriba del chat (José, 19/10: «hacer pin a mensajes»), como
 * WhatsApp: 24 h, 7 días o 30 días; hasta 3; en un grupo, solo los admins.
 */
let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let directo: string;
let grupo: string;
const app = buildApp();
const jwtDe = (id: Types.ObjectId) => signSession({ userId: String(id), deviceId: `d-${id}`, email: 'x' });
const fijar = (chatId: string, quien: Types.ObjectId, body: Record<string, unknown>) =>
  request(app).post(`/api/chats/${chatId}/fijados`).set('Authorization', `Bearer ${jwtDe(quien)}`).send(body);
const desfijar = (chatId: string, quien: Types.ObjectId, seq: number) =>
  request(app).delete(`/api/chats/${chatId}/fijados/${seq}`).set('Authorization', `Bearer ${jwtDe(quien)}`);
const escribir = async (chatId: string, quien: Types.ObjectId, body: string) =>
  (await sendMessage({ chatId, senderId: quien, clientKey: new Types.ObjectId().toHexString(), body })).message.seq;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_fijados'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  [jose, ana] = (await UserModel.create([{ phone: '900000001', name: 'José' }, { phone: '900000002', name: 'Ana' }])).map((u) => u._id);
  directo = String((await ChatModel.create({ kind: 'direct', members: [{ userId: jose }, { userId: ana }], lastSeq: 0 }))._id);
  grupo = String((await ChatModel.create({ kind: 'group', name: 'Familia', members: [{ userId: jose, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 0 }))._id);
});

describe('fijar un mensaje', () => {
  it('en un 1:1 cualquiera fija; la lista lo trae con su vista previa y queda la línea «fijó»', async () => {
    const seq = await escribir(directo, jose, 'Mañana a las 5 en la puerta del colegio');
    const respuesta = await fijar(directo, ana, { seq, duracion: '7d' });
    expect(respuesta.status).toBe(200);

    const [chat] = await listChats(jose);
    expect(chat?.fijados).toHaveLength(1);
    expect(chat?.fijados?.[0]).toMatchObject({ seq, por: String(ana), vista: { body: 'Mañana a las 5 en la puerta del colegio', senderId: String(jose) } });
    const linea = await MessageModel.findOne({ chatId: directo, kind: 'system' }).lean();
    expect(linea?.system).toMatchObject({ evento: 'fijo' });
  });

  it('en un grupo solo un admin', async () => {
    const seq = await escribir(grupo, ana, 'El sábado almorzamos en casa de la abuela');
    expect((await fijar(grupo, ana, { seq, duracion: '24h' })).status).toBe(403);
    expect((await fijar(grupo, jose, { seq, duracion: '24h' })).status).toBe(200);
    expect((await desfijar(grupo, ana, seq)).status).toBe(403);
  });

  it('duración inventada, mensaje que no existe o borrado: no', async () => {
    const seq = await escribir(directo, jose, 'hola');
    expect((await fijar(directo, jose, { seq, duracion: '1y' })).status).toBe(400);
    expect((await fijar(directo, jose, { seq: 99, duracion: '24h' })).status).toBe(404);
    await deleteMessage({ chatId: directo, seq, userId: jose });
    expect((await fijar(directo, jose, { seq, duracion: '24h' })).status).toBe(400);
  });

  it('alguien de afuera del chat: 403', async () => {
    const extraño = (await UserModel.create({ phone: '900000003' }))._id;
    const seq = await escribir(directo, jose, 'hola');
    expect((await fijar(directo, extraño, { seq, duracion: '24h' })).status).toBe(403);
  });

  it('hasta 3: el cuarto saca al fijado hace más tiempo', async () => {
    const seqs: number[] = [];
    for (const texto of ['uno', 'dos', 'tres', 'cuatro']) seqs.push(await escribir(directo, jose, texto));
    for (const seq of seqs) expect((await fijar(directo, jose, { seq, duracion: '24h' })).status).toBe(200);
    const [chat] = await listChats(jose);
    expect(chat?.fijados?.map((uno) => uno.seq)).toEqual([seqs[3], seqs[2], seqs[1]]);
  });

  it('desfijar lo saca de la lista', async () => {
    const seq = await escribir(directo, jose, 'hola');
    await fijar(directo, jose, { seq, duracion: '24h' });
    expect((await desfijar(directo, ana, seq)).status).toBe(200);
    expect((await listChats(jose))[0]?.fijados ?? []).toEqual([]);
  });

  it('vencido no aparece', async () => {
    const seq = await escribir(directo, jose, 'hola');
    await ChatModel.updateOne({ _id: directo }, { $set: { fijados: [{ seq, por: jose, en: new Date(Date.now() - 2e8), hasta: new Date(Date.now() - 1000) }] } });
    expect((await listChats(jose))[0]?.fijados ?? []).toEqual([]);
  });

  it('borrado para todos, se desfija solo', async () => {
    const seq = await escribir(directo, jose, 'me arrepentí');
    await fijar(directo, jose, { seq, duracion: '24h' });
    await deleteMessage({ chatId: directo, seq, userId: jose });
    expect((await ChatModel.findById(directo).lean())?.fijados ?? []).toEqual([]);
  });

  it('chat secreto: se fija, sin línea en claro y sin texto en la vista', async () => {
    await ChatModel.updateOne({ _id: directo }, { $set: { encrypted: true } });
    await MessageModel.create({ chatId: directo, seq: 1, senderId: jose, clientKey: 'k1', kind: 'text', envelope: { v: 1, nonce: 'n', ciphertext: 'c' }, at: new Date() });
    await ChatModel.updateOne({ _id: directo }, { $set: { lastSeq: 1 } });
    expect((await fijar(directo, jose, { seq: 1, duracion: '24h' })).status).toBe(200);
    expect(await MessageModel.countDocuments({ chatId: directo, kind: 'system' })).toBe(0);
    const vista = (await listChats(jose))[0]?.fijados?.[0]?.vista;
    expect(vista?.body).toBeUndefined();
  });

  it('lo que borré para mí no me aparece fijado', async () => {
    const seq = await escribir(directo, jose, 'viejo');
    await fijar(directo, ana, { seq, duracion: '24h' });
    await escribir(directo, ana, 'nuevo');
    await ChatModel.updateOne({ _id: directo, 'members.userId': jose }, { $set: { 'members.$.borradoHasta': seq + 1 } });
    expect((await listChats(jose))[0]?.fijados ?? []).toEqual([]);
    expect((await listChats(ana))[0]?.fijados).toHaveLength(1);
  });
});
