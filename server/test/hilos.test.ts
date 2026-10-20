import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { deleteMessage, sendMessage } from '../src/chatService.js';
import { HiloInvalidoError } from '../src/hilos.js';
import { listChats } from '../src/listaDeChats.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';

/** E3 (20/10): responder en hilo, como Slack, dentro de un chat de Lilachat. */
let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let beto: Types.ObjectId;
let carla: Types.ObjectId;
let grupo: string;
const app = buildApp();
const jwtDe = (id: Types.ObjectId) => signSession({ userId: String(id), deviceId: `d-${id}`, email: 'x' });
let n = 0;
const escribir = (quien: Types.ObjectId, body: string, extra: { hiloDe?: number; enElChat?: boolean } = {}) =>
  sendMessage({ chatId: grupo, senderId: quien, clientKey: `k-${++n}`, body, ...extra });

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_hilos'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  [jose, ana, beto, carla] = (await UserModel.create(['José', 'Ana', 'Beto', 'Carla'].map((name, i) => ({ phone: `90000000${i + 1}`, name })))).map((u) => u._id);
  grupo = String((await ChatModel.create({ kind: 'group', name: 'Obra', members: [jose, ana, beto, carla].map((userId) => ({ userId })), lastSeq: 0 }))._id);
});

describe('responder en un hilo', () => {
  it('la respuesta lleva su raíz y la raíz guarda cuántas, cuándo y quiénes', async () => {
    const raiz = (await escribir(ana, '¿Quién confirma el vaciado?')).message;
    const respuesta = (await escribir(beto, 'Yo llamo a la planta', { hiloDe: raiz.seq })).message;

    expect(respuesta).toMatchObject({ hiloDe: raiz.seq });
    const guardada = await MessageModel.findOne({ chatId: grupo, seq: raiz.seq }).lean();
    expect(guardada?.hilo).toMatchObject({ respuestas: 1, ultimaSeq: respuesta.seq, autores: [String(beto)] });
    expect(guardada?.hilo?.ultimaEn).toBeTruthy();
  });

  it('los autores son los 3 últimos, sin repetir, el más reciente al final', async () => {
    const raiz = (await escribir(ana, 'Raíz')).message;
    for (const quien of [beto, carla, jose, beto]) await escribir(quien, 'r', { hiloDe: raiz.seq });

    const guardada = await MessageModel.findOne({ chatId: grupo, seq: raiz.seq }).lean();
    expect(guardada?.hilo).toMatchObject({ respuestas: 4, autores: [String(carla), String(jose), String(beto)] });
  });

  it('no hay hilo de un hilo, ni de un aviso, ni de lo borrado, ni de lo que no existe; y no gasta un seq', async () => {
    const raiz = (await escribir(ana, 'Raíz')).message;
    const respuesta = (await escribir(beto, 'r', { hiloDe: raiz.seq })).message;
    const antes = (await ChatModel.findById(grupo).lean())?.lastSeq;

    await expect(escribir(jose, 'x', { hiloDe: respuesta.seq })).rejects.toBeInstanceOf(HiloInvalidoError);
    await expect(escribir(jose, 'x', { hiloDe: 999 })).rejects.toBeInstanceOf(HiloInvalidoError);
    await deleteMessage({ chatId: grupo, seq: raiz.seq, userId: ana });
    await expect(escribir(jose, 'x', { hiloDe: raiz.seq })).rejects.toBeInstanceOf(HiloInvalidoError);
    expect((await ChatModel.findById(grupo).lean())?.lastSeq).toBe(antes);
  });

  it('borrar una respuesta la descuenta de la raíz', async () => {
    const raiz = (await escribir(ana, 'Raíz')).message;
    const respuesta = (await escribir(beto, 'r', { hiloDe: raiz.seq })).message;
    await deleteMessage({ chatId: grupo, seq: respuesta.seq, userId: beto });
    expect((await MessageModel.findOne({ chatId: grupo, seq: raiz.seq }).lean())?.hilo?.respuestas).toBe(0);
  });

  it('la lista sabe que el último fue en un hilo', async () => {
    const raiz = (await escribir(ana, 'Raíz')).message;
    await escribir(beto, 'en el hilo', { hiloDe: raiz.seq });
    const [chat] = await listChats(jose);
    expect(chat?.lastMessage).toMatchObject({ body: 'en el hilo', hiloDe: raiz.seq });
  });
});

describe('las rutas del hilo', () => {
  it('GET /hilos da el resumen de cada raíz y GET /hilos/:raiz la raíz con sus respuestas', async () => {
    const raiz = (await escribir(ana, 'Raíz')).message;
    await escribir(beto, 'uno', { hiloDe: raiz.seq });
    await escribir(carla, 'dos', { hiloDe: raiz.seq, enElChat: true });

    const resumen = await request(app).get(`/api/chats/${grupo}/hilos`).set('Authorization', `Bearer ${jwtDe(jose)}`);
    expect(resumen.status).toBe(200);
    expect(resumen.body.hilos).toEqual([expect.objectContaining({ raiz: raiz.seq, hilo: expect.objectContaining({ respuestas: 2 }) })]);

    const hilo = await request(app).get(`/api/chats/${grupo}/hilos/${raiz.seq}`).set('Authorization', `Bearer ${jwtDe(jose)}`);
    expect(hilo.status).toBe(200);
    expect(hilo.body.raiz.body).toBe('Raíz');
    expect(hilo.body.respuestas.map((m: { body: string }) => m.body)).toEqual(['uno', 'dos']);
    expect(hilo.body.respuestas[1].enElChat).toBe(true);
  });

  it('alguien de afuera no ve el hilo', async () => {
    const raiz = (await escribir(ana, 'Raíz')).message;
    const ajeno = (await UserModel.create({ phone: '900000099', name: 'Ajeno' }))._id;
    const respuesta = await request(app).get(`/api/chats/${grupo}/hilos/${raiz.seq}`).set('Authorization', `Bearer ${jwtDe(ajeno)}`);
    expect(respuesta.status).toBe(404);
  });
});
