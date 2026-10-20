import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { sendMessage } from './chatService.js';
import { addMember } from './miembrosDelChat.js';
import { signSession } from './sessions.js';

/**
 * José, 19/10: «quiero chats conmigo mismo y chats con nombre para crear
 * borradores y guardar información; en otra categoría arriba, como Todos, No
 * leídos, Grupos y Borradores». Un borrador es un chat `notas`: solo yo, con
 * nombre, nunca cifrado.
 */
let mongo: MongoMemoryServer;
let yo: Types.ObjectId;
let otro: Types.ObjectId;
let jwt: string;
const app = buildApp();
const crear = (cuerpo: object) => request(app).post('/api/chats').set('Authorization', `Bearer ${jwt}`).send(cuerpo);

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_borradores_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  yo = (await UserModel.create({ phone: '900000001', name: 'José' }))._id;
  otro = (await UserModel.create({ phone: '900000002', name: 'Ana' }))._id;
  jwt = signSession({ userId: String(yo), deviceId: 'd1', email: 'x' });
});

describe('borradores (chats `notas`)', () => {
  it('se crea con nombre y SOLO conmigo, aunque mande otros miembros', async () => {
    const respuesta = await crear({ kind: 'notas', name: 'Ideas', memberIds: [String(otro)], encrypted: true });

    expect(respuesta.status).toBe(201);
    const chat = await ChatModel.findById(respuesta.body.chatId).lean();
    expect(chat?.kind).toBe('notas');
    expect(chat?.name).toBe('Ideas');
    expect(chat?.encrypted).toBe(false);
    expect(chat?.members.map((m) => String(m.userId))).toEqual([String(yo)]);
  });

  it('sin nombre no se crea', async () => {
    expect((await crear({ kind: 'notas', name: '  ' })).status).toBe(400);
  });

  it('se pueden tener varios, uno por tema', async () => {
    await crear({ kind: 'notas', name: 'Ideas' });
    await crear({ kind: 'notas', name: 'Compras' });
    expect(await ChatModel.countDocuments({ kind: 'notas' })).toBe(2);
  });

  it('se escribe en él y aparece en la lista con su nombre', async () => {
    const { body } = await crear({ kind: 'notas', name: 'Ideas' });
    await sendMessage({ chatId: body.chatId, senderId: yo, clientKey: 'k1', body: 'comprar cemento' });

    const lista = await request(app).get('/api/chats').set('Authorization', `Bearer ${jwt}`).expect(200);
    const borrador = (lista.body.chats as { id: string; kind: string; name?: string }[]).find((c) => c.id === body.chatId);
    expect(borrador).toMatchObject({ kind: 'notas', name: 'Ideas' });
  });

  it('se renombra, y no se le suma gente', async () => {
    const { body } = await crear({ kind: 'notas', name: 'Ideas' });

    await request(app).patch(`/api/chats/${body.chatId}`).set('Authorization', `Bearer ${jwt}`).send({ name: 'Ideas obra' }).expect(200);
    expect((await ChatModel.findById(body.chatId).lean())?.name).toBe('Ideas obra');

    const suma = await addMember({ chatId: body.chatId, quien: yo, aQuien: String(otro) });
    expect(suma.ok).toBe(false);
  });
});

/**
 * José, 20/10: «hasta ahora no me dices cómo creo un chat conmigo mismo».
 * Como WhatsApp: «Tú · Envíate un mensaje» abre SIEMPRE el mismo chat contigo
 * (un borrador marcado `propio`), y se crea la primera vez.
 */
describe('el chat contigo («Tú»)', () => {
  it('la primera vez se crea; las siguientes devuelve el MISMO', async () => {
    const primero = await crear({ kind: 'yo' });
    const segundo = await crear({ kind: 'yo' });

    expect(primero.status).toBe(201);
    expect(segundo.status).toBe(200);
    expect(segundo.body.chatId).toBe(primero.body.chatId);
    const chat = await ChatModel.findById(primero.body.chatId).lean();
    expect(chat).toMatchObject({ kind: 'notas', propio: true, name: 'Tú', encrypted: false });
    expect(chat?.members.map((m) => String(m.userId))).toEqual([String(yo)]);
  });

  it('la lista lo marca como propio y no es el de otra persona', async () => {
    const { body } = await crear({ kind: 'yo' });
    const jwtOtro = signSession({ userId: String(otro), deviceId: 'd2', email: 'y' });
    const delOtro = await request(app).post('/api/chats').set('Authorization', `Bearer ${jwtOtro}`).send({ kind: 'yo' });

    expect(delOtro.body.chatId).not.toBe(body.chatId);
    const lista = await request(app).get('/api/chats').set('Authorization', `Bearer ${jwt}`).expect(200);
    expect(lista.body.chats.find((c: { id: string }) => c.id === body.chatId)).toMatchObject({ propio: true, name: 'Tú', kind: 'notas' });
  });

  it('no se renombra (siempre es «Tú»), pero sí lleva descripción', async () => {
    const { body } = await crear({ kind: 'yo' });
    await request(app).patch(`/api/chats/${body.chatId}`).set('Authorization', `Bearer ${jwt}`).send({ name: 'Otro' }).expect(400);
    await request(app).patch(`/api/chats/${body.chatId}`).set('Authorization', `Bearer ${jwt}`).send({ descripcion: 'Pendientes de la semana' }).expect(200);
  });
});
