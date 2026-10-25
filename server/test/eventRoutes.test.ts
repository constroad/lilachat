import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from '../src/testMongo.js';
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
  mongo = await startTestMongo();
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

describe('nota del recordatorio', () => {
  /**
   * El diseño («My Reminders») muestra TRES líneas por tarjeta: título,
   * descripción y el chip de recurrencia con el próximo aviso. La descripción
   * no existía en el esquema, así que la pantalla la dibujaba con dos líneas y
   * no se parecía al diseño. Es dato, no adorno: «Cada 2 horas» o «Llamada
   * semanal» es lo que distingue dos recordatorios con títulos parecidos.
   */
  it('guarda y devuelve la nota', async () => {
    const creado = await request(app())
      .post('/api/agenda/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Tomar agua',
        note: 'Cada 2 horas',
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        recurrence: 'daily',
      });

    expect(creado.status).toBe(201);

    const lista = await request(app())
      .get('/api/agenda/reminders')
      .set('Authorization', `Bearer ${token}`);

    expect(lista.body.mine[0].note).toBe('Cada 2 horas');
  });

  it('sin nota se guarda igual: es opcional', async () => {
    const creado = await request(app())
      .post('/api/agenda/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Sin nota', startsAt: new Date(Date.now() + 3_600_000).toISOString() });

    expect(creado.status).toBe(201);
  });
});

describe('reminders that repeat on some days (pending 65)', () => {
  it('stores the weekdays and anchors a monthly «same day» to its day', async () => {
    // Arrange: the 31st of a month, 9:00 in Lima
    const startsAt = new Date(Date.UTC(2027, 0, 31, 14, 0));
    // Act
    const weekly = await request(app()).post('/api/agenda/reminders').set('Authorization', `Bearer ${token}`).send({ title: 'Gimnasio', startsAt: startsAt.toISOString(), recurrence: 'weekly', repeat: { weekdays: [4, 2] } });
    const monthly = await request(app()).post('/api/agenda/reminders').set('Authorization', `Bearer ${token}`).send({ title: 'Alquiler', startsAt: startsAt.toISOString(), recurrence: 'monthly', repeat: { monthDay: 'same' } });
    // Assert
    expect(weekly.status).toBe(201);
    expect((await ReminderModel.findById(weekly.body.id).lean())?.repeat).toEqual({ weekdays: [2, 4] });
    expect((await ReminderModel.findById(monthly.body.id).lean())?.repeat).toEqual({ monthDay: 'same', day: 31 });
  });

  it('after ringing, a Tuesday-and-Thursday reminder moves to the next of those days', async () => {
    // Arrange: rang a second ago; Lima weekday of «now» decides the next one
    const startsAt = new Date(Date.now() - 1000);
    const reminder = await ReminderModel.create({ userId: jose, title: 'Gimnasio', startsAt, recurrence: 'weekly', repeat: { weekdays: [2, 4] } });
    // Act
    await runReminderTick();
    // Assert
    const after = await ReminderModel.findById(reminder._id).lean();
    const limaWeekday = new Date(after!.startsAt.getTime() - 5 * 3_600_000).getUTCDay();
    expect([2, 4]).toContain(limaWeekday);
    expect(after!.startsAt.getTime()).toBeGreaterThan(Date.now());
    expect(after!.startsAt.getTime() - startsAt.getTime()).toBeLessThanOrEqual(6 * 86_400_000);
  });
});

/** José 25/10: advance alerts (several) and a location, from which the person navigates. */
describe('reminders with advance alerts and a location', () => {
  const MINUTE = 60_000;
  const startsInMinutes = (minutes: number) => new Date(Date.now() + minutes * MINUTE);
  // `deviceId` is unique: every test registers its own phones.
  beforeEach(async () => {
    await mongoose.connection.collection('devices').deleteMany({});
  });

  it('stores the location and the advances clean (the longest first, each once)', async () => {
    // Act
    const created = await request(app()).post('/api/agenda/reminders').set('Authorization', `Bearer ${token}`).send({ title: 'Reunión', startsAt: startsInMinutes(120).toISOString(), location: ' Av. Javier Prado 123 ', advance: [5, 15, 15, 0] });
    // Assert
    expect(created.status).toBe(201);
    const stored = await ReminderModel.findById(created.body.id).lean();
    expect(stored).toMatchObject({ location: 'Av. Javier Prado 123', advance: [15, 5] });
  });

  it('a location that is a paragraph is refused', async () => {
    const created = await request(app()).post('/api/agenda/reminders').set('Authorization', `Bearer ${token}`).send({ title: 'Reunión', startsAt: startsInMinutes(120).toISOString(), location: 'x'.repeat(201) });
    expect(created.status).toBe(400);
  });

  it('editing the advances replaces them and clears the ones that already rang', async () => {
    // Arrange
    const reminder = await ReminderModel.create({ userId: jose, title: 'Reunión', startsAt: startsInMinutes(120), advance: [15], advanceSent: [15] });
    // Act
    const patch = await request(app()).patch(`/api/agenda/reminders/${reminder._id}`).set('Authorization', `Bearer ${token}`).send({ advance: [60, 10], location: 'Planta Lurín' });
    // Assert
    expect(patch.status).toBe(200);
    expect(await ReminderModel.findById(reminder._id).lean()).toMatchObject({ advance: [60, 10], advanceSent: [], location: 'Planta Lurín' });
  });

  it('removing every advance and the location clears both', async () => {
    const reminder = await ReminderModel.create({ userId: jose, title: 'Reunión', startsAt: startsInMinutes(120), advance: [15], location: 'Planta Lurín' });
    await request(app()).patch(`/api/agenda/reminders/${reminder._id}`).set('Authorization', `Bearer ${token}`).send({ advance: [], location: '' });
    const stored = await ReminderModel.findById(reminder._id).lean();
    expect(stored?.advance).toBeUndefined();
    expect(stored?.location).toBeUndefined();
  });

  it('rings the advance when its time arrives, with how long is left, and only once', async () => {
    // Arrange: starts in 14 minutes, 15 before: the advance time just passed
    const reminder = await ReminderModel.create({ userId: jose, title: 'Reunión con el cliente', startsAt: startsInMinutes(14), advance: [15] });
    await mongoose.connection.collection('devices').insertOne({ deviceId: 'd-jose', userId: jose, pushToken: 'tok-jose' });
    // Act
    const first = await runReminderTick();
    const second = await runReminderTick();
    // Assert
    expect(first.reminders).toBe(0);
    expect(pushes).toHaveLength(1);
    expect(pushes[0]).toMatchObject({ tokens: ['tok-jose'], title: 'Reunión con el cliente', body: 'Empieza en 15 min' });
    expect(second.reminders).toBe(0);
    expect(await ReminderModel.findById(reminder._id).lean()).toMatchObject({ advanceSent: [15], active: true });
  });

  it('the full-screen phones get the advance as data, with the line that says how long is left', async () => {
    // Arrange
    const dataPushes: { tokens: string[]; data: Record<string, string> }[] = [];
    setReminderPushSender({ send: async (message) => void pushes.push(message), sendDatos: async (message) => void dataPushes.push(message) });
    await ReminderModel.create({ userId: jose, title: 'Reunión', note: 'Llevar planos', startsAt: startsInMinutes(14), advance: [15] });
    await mongoose.connection.collection('devices').insertOne({ deviceId: 'd-full', userId: jose, pushToken: 'tok-full', capacidades: ['recordatorio-nativo'] });
    // Act
    await runReminderTick();
    // Assert
    expect(dataPushes).toHaveLength(1);
    expect(dataPushes[0]?.data).toMatchObject({ tipo: 'recordatorio', titulo: 'Reunión', nota: 'Empieza en 15 min · Llevar planos' });
  });

  it('several advances ring one after the other, never together', async () => {
    // Arrange: 15 and 5 before; the 15 is the one that arrived
    const reminder = await ReminderModel.create({ userId: jose, title: 'Reunión', startsAt: startsInMinutes(14), advance: [15, 5] });
    await mongoose.connection.collection('devices').insertOne({ deviceId: 'd-jose', userId: jose, pushToken: 'tok-jose' });
    await runReminderTick();
    expect(pushes).toHaveLength(1);
    // Act: 9 minutes later the second one arrives
    await ReminderModel.updateOne({ _id: reminder._id }, { $set: { startsAt: startsInMinutes(4) } });
    await runReminderTick();
    // Assert
    expect(pushes).toHaveLength(2);
    expect(pushes[1]?.body).toBe('Empieza en 5 min');
    expect((await ReminderModel.findById(reminder._id).lean())?.advanceSent).toEqual([15, 5]);
  });

  it('a late advance (the cron was down) is stamped without ringing', async () => {
    const reminder = await ReminderModel.create({ userId: jose, title: 'Reunión', startsAt: startsInMinutes(30), advance: [60] });
    await mongoose.connection.collection('devices').insertOne({ deviceId: 'd-jose', userId: jose, pushToken: 'tok-jose' });
    await runReminderTick();
    expect(pushes).toHaveLength(0);
    expect((await ReminderModel.findById(reminder._id).lean())?.advanceSent).toEqual([60]);
  });

  it('one without advances is not touched by that pass', async () => {
    const reminder = await ReminderModel.create({ userId: jose, title: 'Sin aviso previo', startsAt: startsInMinutes(14) });
    await runReminderTick();
    expect(pushes).toHaveLength(0);
    expect((await ReminderModel.findById(reminder._id).lean())?.advanceSent ?? []).toEqual([]);
  });

  it('a group reminder rings its advance to every member of the chat', async () => {
    // Arrange
    await ReminderModel.create({ userId: jose, chatId: new Types.ObjectId(chatId), title: 'Reunión del grupo', startsAt: startsInMinutes(14), advance: [15] });
    await mongoose.connection.collection('devices').insertMany([
      { deviceId: 'd-jose', userId: jose, pushToken: 'tok-jose' },
      { deviceId: 'd-maria', userId: maria, pushToken: 'tok-maria' },
    ]);
    // Act
    await runReminderTick();
    // Assert
    expect(pushes).toHaveLength(1);
    expect([...(pushes[0]?.tokens ?? [])].sort()).toEqual(['tok-jose', 'tok-maria']);
  });

  it('when it starts it rings itself and re-arms the advances for the next time', async () => {
    // Arrange: daily, starts now, the advance already rang
    const reminder = await ReminderModel.create({ userId: jose, title: 'Tomar agua', startsAt: new Date(Date.now() - 1000), recurrence: 'daily', advance: [15], advanceSent: [15] });
    // Act
    await runReminderTick();
    // Assert
    const after = await ReminderModel.findById(reminder._id).lean();
    expect(after?.startsAt.getTime()).toBeGreaterThan(Date.now());
    expect(after?.advanceSent).toEqual([]);
  });

  it('reactivating it re-arms the advances', async () => {
    const reminder = await ReminderModel.create({ userId: jose, title: 'Reunión', startsAt: startsInMinutes(120), advance: [15], advanceSent: [15], active: false });
    await request(app()).post(`/api/agenda/reminders/${reminder._id}/toggle`).set('Authorization', `Bearer ${token}`).send({ active: true });
    expect(await ReminderModel.findById(reminder._id).lean()).toMatchObject({ active: true, advanceSent: [] });
  });
});

describe('a reminder rings full screen on phones that can (pending 63)', () => {
  it('a phone that declared it gets a data push; an older one, the usual notice', async () => {
    // Arrange
    const dataPushes: { tokens: string[]; data: Record<string, string> }[] = [];
    setReminderPushSender({ send: async (message) => void pushes.push(message), sendDatos: async (message) => void dataPushes.push(message) });
    await ReminderModel.create({ userId: jose, title: 'Tomar la pastilla', note: 'Con agua', startsAt: new Date(Date.now() - 1000) });
    await mongoose.connection.collection('devices').insertMany([
      { deviceId: 'd-full-screen', userId: jose, pushToken: 'tok-nuevo', capacidades: ['llamada-nativa', 'mensaje-nativo', 'recordatorio-nativo'] },
      { deviceId: 'd-plain-notice', userId: jose, pushToken: 'tok-viejo', capacidades: ['llamada-nativa', 'mensaje-nativo'] },
    ]);
    // Act
    await runReminderTick();
    // Assert
    expect(dataPushes).toHaveLength(1);
    expect(dataPushes[0]).toMatchObject({ tokens: ['tok-nuevo'], data: { tipo: 'recordatorio', titulo: 'Tomar la pastilla', nota: 'Con agua' } });
    expect(pushes).toHaveLength(1);
    expect(pushes[0]?.tokens).toEqual(['tok-viejo']);
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
   * José, 18/10: «Hacer ejercicios» llegó DOS veces a la misma hora. El mismo
   * teléfono figuraba en dos devices (reinstalar deja el viejo con el mismo
   * token) y el aviso salía una vez por device. Un token, un envío.
   */
  it('un recordatorio suena una vez por teléfono aunque el token esté en dos devices', async () => {
    await ReminderModel.create({ userId: jose, title: 'Hacer ejercicios', startsAt: new Date(Date.now() - 1000) });
    await mongoose.connection.collection('devices').insertMany([
      { deviceId: 'd-viejo', userId: jose, pushToken: 'tok-mismo' },
      { deviceId: 'd-nuevo', userId: jose, pushToken: 'tok-mismo' },
    ]);

    await runReminderTick();

    expect(pushes).toHaveLength(1);
    expect(pushes[0]?.tokens).toEqual(['tok-mismo']);
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
