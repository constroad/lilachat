import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ChatModel } from '../src/chatModels.js';
import { EventModel, PollModel, ReminderModel } from '../src/eventModels.js';
import { UserModel } from '../src/models.js';
import { __resetPresence } from '../src/presence.js';
import type { PushMessage } from '../src/pushSender.js';
import { runReminderTick, setReminderPushSender } from '../src/reminderCron.js';
import { signSession } from '../src/sessions.js';

let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let maria: Types.ObjectId;
let ajeno: Types.ObjectId;
let chatId: string;
let token: string;
let ajenoToken: string;
let pushes: PushMessage[];

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_event_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  __resetPresence();
  pushes = [];
  setReminderPushSender({ send: async (message) => void pushes.push(message) });
  await Promise.all([
    ChatModel.deleteMany({}),
    EventModel.deleteMany({}),
    ReminderModel.deleteMany({}),
    PollModel.deleteMany({}),
    UserModel.deleteMany({}),
  ]);
  const users = await UserModel.create([
    { phone: '900000001', name: 'José' },
    { phone: '900000002', name: 'María' },
    { phone: '900000003', name: 'Ajeno' },
  ]);
  [jose, maria, ajeno] = users.map((user) => user._id) as [
    Types.ObjectId,
    Types.ObjectId,
    Types.ObjectId,
  ];
  const chat = await ChatModel.create({
    kind: 'group',
    name: 'Familia',
    members: [
      { userId: jose, role: 'admin' },
      { userId: maria, role: 'member' },
    ],
    lastSeq: 0,
  });
  chatId = String(chat._id);
  token = signSession({ userId: String(jose), deviceId: 'd1', email: 'x' });
  ajenoToken = signSession({ userId: String(ajeno), deviceId: 'd2', email: 'y' });
});

const app = () => buildApp();
const inOneHour = () => new Date(Date.now() + 3_600_000).toISOString();

describe('eventos', () => {
  it('crear invita a TODOS los miembros del chat, y el autor va confirmado', async () => {
    const response = await request(app())
      .post('/api/agenda/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ chatId, title: 'Almuerzo', startsAt: inOneHour() });

    expect(response.status).toBe(201);
    const event = await EventModel.findOne({}).lean();
    expect(event?.attendees).toHaveLength(2);
    expect(event?.attendees.find((a) => String(a.userId) === String(jose))?.rsvp).toBe('yes');
    expect(event?.attendees.find((a) => String(a.userId) === String(maria))?.rsvp).toBeUndefined();
  });

  /** Los invitados salen de los MIEMBROS, no de una lista del cliente. */
  it('no se puede invitar a alguien ajeno al chat', async () => {
    await request(app())
      .post('/api/agenda/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ chatId, title: 'Almuerzo', startsAt: inOneHour(), memberIds: [String(ajeno)] });

    const event = await EventModel.findOne({}).lean();
    expect(event?.attendees.map((a) => String(a.userId))).not.toContain(String(ajeno));
  });

  it('un no-miembro no crea eventos en ese chat', async () => {
    const response = await request(app())
      .post('/api/agenda/events')
      .set('Authorization', `Bearer ${ajenoToken}`)
      .send({ chatId, title: 'Me colé', startsAt: inOneHour() });

    expect(response.status).toBe(403);
    expect(await EventModel.countDocuments({})).toBe(0);
  });

  it('el RSVP se guarda y el resumen lo refleja', async () => {
    const created = await request(app())
      .post('/api/agenda/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ chatId, title: 'Almuerzo', startsAt: inOneHour() });
    const mariaToken = signSession({ userId: String(maria), deviceId: 'd3', email: 'z' });

    const rsvp = await request(app())
      .post(`/api/agenda/events/${created.body.id}/rsvp`)
      .set('Authorization', `Bearer ${mariaToken}`)
      .send({ rsvp: 'no' });
    expect(rsvp.status).toBe(200);

    const list = await request(app()).get('/api/agenda/events').set('Authorization', `Bearer ${token}`);
    expect(list.body.events[0].rsvpSummary).toMatchObject({ yes: 1, no: 1 });
    expect(list.body.events[0].myRsvp).toBe('yes');
  });

  /** Responder por otro es imposible: el filtro está en la misma consulta. */
  it('quien no está invitado no puede responder', async () => {
    const created = await request(app())
      .post('/api/agenda/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ chatId, title: 'Almuerzo', startsAt: inOneHour() });

    const response = await request(app())
      .post(`/api/agenda/events/${created.body.id}/rsvp`)
      .set('Authorization', `Bearer ${ajenoToken}`)
      .send({ rsvp: 'yes' });

    expect(response.status).toBe(403);
  });
});

describe('encuestas', () => {
  const crear = (body: Record<string, unknown>) =>
    request(app()).post('/api/agenda/polls').set('Authorization', `Bearer ${token}`).send(body);

  it('crea con pregunta y opciones', async () => {
    const response = await crear({ chatId, question: '¿Playa o cine?', options: ['Playa', 'Cine'] });

    expect(response.status).toBe(201);
    expect(await PollModel.countDocuments({})).toBe(1);
  });

  /** La MISMA validación del cliente: no se llena un formulario para que
   *  muera al enviar. */
  it('con una sola opción se rechaza diciendo por qué', async () => {
    const response = await crear({ chatId, question: '¿?', options: ['Playa'] });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/dos opciones/i);
  });

  it('votar cambia el voto, no lo duplica (respuesta única)', async () => {
    const created = await crear({ chatId, question: '¿?', options: ['Playa', 'Cine'] });
    const vote = (optionIndex: number) =>
      request(app())
        .post(`/api/agenda/polls/${created.body.id}/vote`)
        .set('Authorization', `Bearer ${token}`)
        .send({ optionIndex });

    await vote(0);
    await vote(1);

    const poll = await PollModel.findById(created.body.id).lean();
    expect(poll?.options[0]?.votes).toHaveLength(0);
    expect(poll?.options[1]?.votes).toHaveLength(1);
  });

  it('un no-miembro no vota', async () => {
    const created = await crear({ chatId, question: '¿?', options: ['A', 'B'] });

    const response = await request(app())
      .post(`/api/agenda/polls/${created.body.id}/vote`)
      .set('Authorization', `Bearer ${ajenoToken}`)
      .send({ optionIndex: 0 });

    expect(response.status).toBe(403);
  });
});

describe('cron de recordatorios', () => {
  it('avisa del evento al llegar su antelación, y UNA sola vez', async () => {
    await EventModel.create({
      chatId: new Types.ObjectId(chatId),
      title: 'Cena',
      startsAt: new Date(Date.now() + 30 * 60_000),
      createdBy: jose,
      attendees: [{ userId: maria }],
      remindMinutesBefore: 60,
    });
    await mongoose.connection
      .collection('devices')
      .insertOne({ deviceId: 'd-maria', userId: maria, pushToken: 'tok' });

    const first = await runReminderTick();
    const second = await runReminderTick();

    expect(first.events).toBe(1);
    expect(second.events).toBe(0);
    expect(pushes).toHaveLength(1);
  });

  /**
   * Un «cada día» que suena una sola vez en su vida es el bug clásico: hay que
   * REPROGRAMAR y limpiar el sello.
   */
  it('un recordatorio diario se reprograma para mañana', async () => {
    const reminder = await ReminderModel.create({
      userId: jose,
      title: 'Tomar agua',
      startsAt: new Date(Date.now() - 1000),
      recurrence: 'daily',
    });

    await runReminderTick();

    const after = await ReminderModel.findById(reminder._id).lean();
    expect(after?.remindedAt).toBeNull();
    expect(after?.startsAt.getTime()).toBeGreaterThan(Date.now());
    expect(after?.active).toBe(true);
  });

  it('uno de «una vez» se apaga solo después de sonar', async () => {
    const reminder = await ReminderModel.create({
      userId: jose,
      title: 'Pagar la luz',
      startsAt: new Date(Date.now() - 1000),
      recurrence: 'once',
    });

    await runReminderTick();

    expect((await ReminderModel.findById(reminder._id).lean())?.active).toBe(false);
  });

  it('uno apagado no suena', async () => {
    await ReminderModel.create({
      userId: jose,
      title: 'Apagado',
      startsAt: new Date(Date.now() - 1000),
      recurrence: 'daily',
      active: false,
    });

    expect((await runReminderTick()).reminders).toBe(0);
  });
});
