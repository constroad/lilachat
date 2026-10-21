import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from '../src/testMongo.js';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { EventModel, PollModel } from '../src/eventModels.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';

/**
 * José, 18/10: «creé una encuesta desde el chat de Wilson y nunca se envió al
 * chat como lo hace WhatsApp. Solo se creó en Encuestas; Wilson nunca se
 * enteró». Una encuesta o un evento creados DESDE un chat publican un mensaje
 * en ese chat: llega por el socket, con push, y se dibuja como tarjeta.
 */
let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let wilson: Types.ObjectId;
let ajeno: Types.ObjectId;
let chatId: string;
let token: string;
let ajenoToken: string;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_publicar_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([ChatModel.deleteMany({}), MessageModel.deleteMany({}), EventModel.deleteMany({}), PollModel.deleteMany({}), UserModel.deleteMany({})]);
  const users = await UserModel.create([
    { phone: '900000001', name: 'José' },
    { phone: '900000002', name: 'Wilson' },
    { phone: '900000003', name: 'Ajeno' },
  ]);
  [jose, wilson, ajeno] = users.map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  const chat = await ChatModel.create({ kind: 'direct', members: [{ userId: jose }, { userId: wilson }], lastSeq: 0 });
  chatId = String(chat._id);
  token = signSession({ userId: String(jose), deviceId: 'd1', email: 'x' });
  ajenoToken = signSession({ userId: String(ajeno), deviceId: 'd2', email: 'y' });
});

const app = () => buildApp();
const crearEncuesta = () =>
  request(app())
    .post('/api/agenda/polls')
    .set('Authorization', `Bearer ${token}`)
    .send({ chatId, question: '¿Pizza o pollo?', options: ['Pizza', 'Pollo'] });

describe('una encuesta creada en un chat llega al chat', () => {
  it('publica un mensaje de encuesta con la referencia y la pregunta', async () => {
    const respuesta = await crearEncuesta();
    expect(respuesta.status).toBe(201);

    const mensajes = await MessageModel.find({ chatId }).lean();
    expect(mensajes).toHaveLength(1);
    expect(mensajes[0]?.kind).toBe('poll');
    expect(mensajes[0]?.ref).toEqual({ tipo: 'encuesta', id: respuesta.body.id });
    expect(mensajes[0]?.body).toContain('¿Pizza o pollo?');
    expect(String(mensajes[0]?.senderId)).toBe(String(jose));
  });

  it('cada encuesta es su propio mensaje', async () => {
    await crearEncuesta();
    await crearEncuesta();
    expect(await MessageModel.countDocuments({ chatId, kind: 'poll' })).toBe(2);
  });

  it('el miembro la lee por su id; un ajeno no', async () => {
    const { body } = await crearEncuesta();

    const mia = await request(app()).get(`/api/agenda/polls/${body.id}`).set('Authorization', `Bearer ${token}`);
    expect(mia.status).toBe(200);
    expect(mia.body.poll.question).toBe('¿Pizza o pollo?');

    const ajena = await request(app()).get(`/api/agenda/polls/${body.id}`).set('Authorization', `Bearer ${ajenoToken}`);
    expect(ajena.status).toBe(404);
  });
});

describe('un evento creado en un chat llega al chat', () => {
  const crearEvento = () =>
    request(app())
      .post('/api/agenda/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ chatId, title: 'Almuerzo', startsAt: new Date(Date.now() + 3_600_000).toISOString() });

  it('publica un mensaje de evento con la referencia y el título', async () => {
    const respuesta = await crearEvento();
    expect(respuesta.status).toBe(201);

    const mensaje = await MessageModel.findOne({ chatId }).lean();
    expect(mensaje?.kind).toBe('event');
    expect(mensaje?.ref).toEqual({ tipo: 'evento', id: respuesta.body.id });
    expect(mensaje?.body).toContain('Almuerzo');
  });

  it('el invitado lo lee por su id; un ajeno no', async () => {
    const { body } = await crearEvento();

    const mio = await request(app()).get(`/api/agenda/events/${body.id}`).set('Authorization', `Bearer ${token}`);
    expect(mio.status).toBe(200);
    expect(mio.body.event.title).toBe('Almuerzo');

    const ajeno_ = await request(app()).get(`/api/agenda/events/${body.id}`).set('Authorization', `Bearer ${ajenoToken}`);
    expect(ajeno_.status).toBe(404);
  });
});

/**
 * José, 18/10: «tanto avisos como eventos: no hay un contador en los tabs».
 * Lo que me espera: eventos que vienen y no respondí, y encuestas abiertas en
 * las que no voté. Lo propio no cuenta: no me espero a mí mismo.
 */
describe('GET /api/agenda/pendientes', () => {
  const pendientes = (quien = token) => request(app()).get('/api/agenda/pendientes').set('Authorization', `Bearer ${quien}`);
  const wilsonToken = () => signSession({ userId: String(wilson), deviceId: 'd3', email: 'w' });

  it('una encuesta ajena abierta sin mi voto cuenta, y deja de contar al votar', async () => {
    const { body } = await request(app())
      .post('/api/agenda/polls')
      .set('Authorization', `Bearer ${wilsonToken()}`)
      .send({ chatId, question: '¿Vamos?', options: ['Sí', 'No'] });

    expect((await pendientes()).body).toEqual({ encuestas: 1, eventos: 0 });
    // La mía no me la cuento.
    expect((await pendientes(wilsonToken())).body.encuestas).toBe(0);

    await request(app()).post(`/api/agenda/polls/${body.id}/vote`).set('Authorization', `Bearer ${token}`).send({ optionIndex: 0 });
    expect((await pendientes()).body.encuestas).toBe(0);
  });

  it('una encuesta cerrada no cuenta', async () => {
    const { body } = await request(app())
      .post('/api/agenda/polls')
      .set('Authorization', `Bearer ${wilsonToken()}`)
      .send({ chatId, question: '¿Vamos?', options: ['Sí', 'No'] });
    await request(app()).post(`/api/agenda/polls/${body.id}/close`).set('Authorization', `Bearer ${wilsonToken()}`).send({});
    expect((await pendientes()).body.encuestas).toBe(0);
  });

  it('un evento que viene y no respondí cuenta, y deja de contar al responder', async () => {
    const { body } = await request(app())
      .post('/api/agenda/events')
      .set('Authorization', `Bearer ${wilsonToken()}`)
      .send({ chatId, title: 'Almuerzo', startsAt: new Date(Date.now() + 3_600_000).toISOString() });

    expect((await pendientes()).body).toEqual({ encuestas: 0, eventos: 1 });
    // Quien lo creó ya va.
    expect((await pendientes(wilsonToken())).body.eventos).toBe(0);

    await request(app()).post(`/api/agenda/events/${body.id}/rsvp`).set('Authorization', `Bearer ${token}`).send({ rsvp: 'no' });
    expect((await pendientes()).body.eventos).toBe(0);
  });

  it('un evento que ya pasó no cuenta', async () => {
    await EventModel.create({
      chatId,
      title: 'Ayer',
      startsAt: new Date(Date.now() - 86_400_000),
      createdBy: wilson,
      attendees: [{ userId: jose }, { userId: wilson, rsvp: 'yes' }],
    });
    expect((await pendientes()).body.eventos).toBe(0);
  });
});
