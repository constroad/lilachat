import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from '../src/testMongo.js';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { deleteMessage, sendMessage } from '../src/chatService.js';
import { reaccionar } from '../src/reacciones.js';
import { UserModel } from '../src/models.js';

/** Reacciones (20/10): una por persona, en chats y en hilos. */
let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let ajeno: Types.ObjectId;
let grupo: string;
let n = 0;
const escribir = (quien: Types.ObjectId, body: string, extra: { hiloDe?: number } = {}) =>
  sendMessage({ chatId: grupo, senderId: quien, clientKey: `k-${++n}`, body, ...extra });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_reacciones'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  [jose, ana, ajeno] = (await UserModel.create(['José', 'Ana', 'Ajeno'].map((name, i) => ({ phone: `90000001${i}`, name })))).map((u) => u._id);
  grupo = String((await ChatModel.create({ kind: 'group', name: 'Obra', members: [jose, ana].map((userId) => ({ userId })), lastSeq: 0 }))._id);
});

describe('reaccionar', () => {
  it('suma la reacción y devuelve la lista con el autor del mensaje', async () => {
    const { message } = await escribir(ana, 'Ya llegó la tolva');

    const r = await reaccionar({ chatId: grupo, seq: message.seq, userId: String(jose), emoji: '👍' });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reacciones.map(({ userId, emoji }) => ({ userId, emoji }))).toEqual([{ userId: String(jose), emoji: '👍' }]);
    expect(r.autor).toBe(String(ana));
    expect(r.cuerpo).toBe('Ya llegó la tolva');
  });

  it('una por persona: otra la reemplaza y null la quita', async () => {
    const { message } = await escribir(ana, 'Hola');
    await reaccionar({ chatId: grupo, seq: message.seq, userId: String(jose), emoji: '👍' });
    await reaccionar({ chatId: grupo, seq: message.seq, userId: String(ana), emoji: '❤️' });

    const cambio = await reaccionar({ chatId: grupo, seq: message.seq, userId: String(jose), emoji: '😂' });
    expect(cambio.ok && cambio.reacciones.map((una) => una.emoji)).toEqual(['❤️', '😂']);

    const quitada = await reaccionar({ chatId: grupo, seq: message.seq, userId: String(jose), emoji: null });
    expect(quitada.ok && quitada.reacciones.map((una) => una.emoji)).toEqual(['❤️']);
  });

  it('en una respuesta de hilo también', async () => {
    const raiz = await escribir(ana, '¿Quién confirma?');
    const respuesta = await escribir(jose, 'Yo', { hiloDe: raiz.message.seq });

    const r = await reaccionar({ chatId: grupo, seq: respuesta.message.seq, userId: String(ana), emoji: '🙏' });

    expect(r.ok).toBe(true);
    expect((await MessageModel.findOne({ chatId: grupo, seq: respuesta.message.seq }).lean())?.reacciones).toHaveLength(1);
  });

  it('rechaza un emoji inválido sin tocar la base', async () => {
    const { message } = await escribir(ana, 'Hola');

    const r = await reaccionar({ chatId: grupo, seq: message.seq, userId: String(jose), emoji: 'jaja' });

    expect(r).toEqual({ ok: false, status: 400, motivo: 'Esa reacción no es un emoji.' });
    expect((await MessageModel.findOne({ chatId: grupo, seq: message.seq }).lean())?.reacciones).toBeUndefined();
  });

  it('quien no es miembro no reacciona (403) y lo que no existe da 404', async () => {
    const { message } = await escribir(ana, 'Hola');

    expect(await reaccionar({ chatId: grupo, seq: message.seq, userId: String(ajeno), emoji: '👍' })).toMatchObject({ ok: false, status: 403 });
    expect(await reaccionar({ chatId: grupo, seq: 999, userId: String(jose), emoji: '👍' })).toMatchObject({ ok: false, status: 404 });
    expect(await reaccionar({ chatId: 'no-es-un-id', seq: 1, userId: String(jose), emoji: '👍' })).toMatchObject({ ok: false, status: 404 });
  });

  it('no a lo borrado ni a los avisos', async () => {
    const { message } = await escribir(ana, 'Hola');
    await deleteMessage({ chatId: grupo, seq: message.seq, userId: ana });
    const aviso = await MessageModel.create({ chatId: grupo, seq: 50, senderId: jose, clientKey: 'aviso', kind: 'system', body: 'Ana se unió', at: new Date() });

    expect(await reaccionar({ chatId: grupo, seq: message.seq, userId: String(jose), emoji: '👍' })).toMatchObject({ ok: false, status: 400 });
    expect(await reaccionar({ chatId: grupo, seq: aviso.seq, userId: String(jose), emoji: '👍' })).toMatchObject({ ok: false, status: 400 });
  });

  it('en un chat secreto todavía no', async () => {
    await ChatModel.updateOne({ _id: grupo }, { $set: { encrypted: true } });
    await MessageModel.create({ chatId: grupo, seq: 1, senderId: ana, clientKey: 's1', kind: 'text', envelope: { v: 1, nonce: 'n', ciphertext: 'c' }, at: new Date() });

    expect(await reaccionar({ chatId: grupo, seq: 1, userId: String(jose), emoji: '👍' })).toMatchObject({ ok: false, status: 400 });
  });
});
