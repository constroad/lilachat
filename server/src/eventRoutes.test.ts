import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel } from './chatModels.js';
import { EventModel, ReminderModel } from './eventModels.js';
import { signSession } from './sessions.js';

/**
 * Editar y borrar avisos y eventos (17/10/2026). Hasta acá la agenda solo
 * sabía crear: un aviso con la hora equivocada había que dejarlo sonar o
 * apagarlo para siempre.
 *
 * Lo que fija: solo el DUEÑO edita o borra (otro miembro del chat recibe 403,
 * y uno ajeno también — sin diferencia que sondear), mover la hora rearma el
 * aviso del cron, y lo no editable no se toca.
 */
let mongo: MongoMemoryServer;
let yo: Types.ObjectId;
let otro: Types.ObjectId;
let chatId: Types.ObjectId;
let jwtYo: string;
let jwtOtro: string;

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
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), EventModel.deleteMany({}), ReminderModel.deleteMany({})]);
  yo = (await UserModel.create({ phone: '51902049935', name: 'José' }))._id;
  otro = (await UserModel.create({ phone: '51999999999', name: 'Ana' }))._id;
  chatId = (
    await ChatModel.create({ kind: 'group', name: 'Familia', members: [{ userId: yo, role: 'admin' }, { userId: otro, role: 'member' }], lastSeq: 0 })
  )._id;
  jwtYo = signSession({ userId: String(yo), deviceId: 'd1', email: '51902049935' });
  jwtOtro = signSession({ userId: String(otro), deviceId: 'd2', email: '51999999999' });
});

const conJwt = (jwt: string) => ({ Authorization: `Bearer ${jwt}` });

async function crearRecordatorio(): Promise<string> {
  const r = await request(app)
    .post('/api/agenda/reminders')
    .set(conJwt(jwtYo))
    .send({ title: 'Tomar agua', startsAt: '2026-10-20T15:00:00.000Z', recurrence: 'once' })
    .expect(201);
  return r.body.id as string;
}

/** Tomorrow, relative to the run: the list shows events up to 6 h old, and a fixed date expired at 21:00 UTC on 20/10. */
const TOMORROW = new Date(Date.now() + 24 * 3_600_000).toISOString();

async function crearEvento(): Promise<string> {
  const r = await request(app)
    .post('/api/agenda/events')
    .set(conJwt(jwtYo))
    .send({ chatId: String(chatId), title: 'Asado', startsAt: TOMORROW, location: 'Casa' })
    .expect(201);
  return r.body.id as string;
}

describe('PATCH /api/agenda/reminders/:id', () => {
  it('el dueño cambia título y hora; la hora nueva rearma el aviso', async () => {
    const id = await crearRecordatorio();
    await ReminderModel.updateOne({ _id: id }, { $set: { remindedAt: new Date(), active: false } });

    await request(app)
      .patch(`/api/agenda/reminders/${id}`)
      .set(conJwt(jwtYo))
      .send({ title: 'Tomar agua fría', startsAt: '2026-10-21T13:30:00.000Z' })
      .expect(200);

    const guardado = await ReminderModel.findById(id).lean();
    expect(guardado).toMatchObject({ title: 'Tomar agua fría', remindedAt: null, active: true });
    expect(guardado?.startsAt.toISOString()).toBe('2026-10-21T13:30:00.000Z');
  });

  it('borrar la nota la saca del documento', async () => {
    const id = await crearRecordatorio();
    await ReminderModel.updateOne({ _id: id }, { $set: { note: 'vieja' } });

    await request(app).patch(`/api/agenda/reminders/${id}`).set(conJwt(jwtYo)).send({ note: '' }).expect(200);

    expect((await ReminderModel.findById(id).lean())?.note).toBeUndefined();
  });

  it('otro usuario no puede editarlo: 404, igual que si no existiera', async () => {
    const id = await crearRecordatorio();

    await request(app).patch(`/api/agenda/reminders/${id}`).set(conJwt(jwtOtro)).send({ title: 'mío' }).expect(404);
    expect((await ReminderModel.findById(id).lean())?.title).toBe('Tomar agua');
  });

  it('un título vacío es 400 con el motivo', async () => {
    const id = await crearRecordatorio();

    const r = await request(app).patch(`/api/agenda/reminders/${id}`).set(conJwt(jwtYo)).send({ title: ' ' }).expect(400);
    expect(r.body.message).toBe('Escribe de qué es el recordatorio.');
  });
});

describe('DELETE /api/agenda/reminders/:id', () => {
  it('el dueño lo borra; otro recibe 404 y no borra nada', async () => {
    const id = await crearRecordatorio();

    await request(app).delete(`/api/agenda/reminders/${id}`).set(conJwt(jwtOtro)).expect(404);
    expect(await ReminderModel.countDocuments()).toBe(1);

    await request(app).delete(`/api/agenda/reminders/${id}`).set(conJwt(jwtYo)).expect(200);
    expect(await ReminderModel.countDocuments()).toBe(0);
  });

  it('un id inválido es 404, no 500', async () => {
    await request(app).delete('/api/agenda/reminders/no-es-un-id').set(conJwt(jwtYo)).expect(404);
  });
});

describe('PATCH /api/agenda/events/:id', () => {
  it('quien lo creó cambia nombre, lugar y fecha; las respuestas de los invitados se conservan', async () => {
    const id = await crearEvento();
    await request(app).post(`/api/agenda/events/${id}/rsvp`).set(conJwt(jwtOtro)).send({ rsvp: 'maybe' }).expect(200);
    await EventModel.updateOne({ _id: id }, { $set: { remindedAt: new Date() } });

    await request(app)
      .patch(`/api/agenda/events/${id}`)
      .set(conJwt(jwtYo))
      .send({ title: 'Asado del domingo', location: '', startsAt: '2026-10-26T18:00:00.000Z' })
      .expect(200);

    const guardado = await EventModel.findById(id).lean();
    expect(guardado).toMatchObject({ title: 'Asado del domingo', remindedAt: null });
    expect(guardado?.location).toBeUndefined();
    expect(guardado?.attendees.find((a) => String(a.userId) === String(otro))?.rsvp).toBe('maybe');
  });

  it('un invitado que no lo creó no puede editarlo: 403', async () => {
    const id = await crearEvento();

    await request(app).patch(`/api/agenda/events/${id}`).set(conJwt(jwtOtro)).send({ title: 'mío' }).expect(403);
  });

  it('el fin antes del inicio es 400', async () => {
    const id = await crearEvento();

    await request(app)
      .patch(`/api/agenda/events/${id}`)
      .set(conJwt(jwtYo))
      .send({ endsAt: '2026-10-20T10:00:00.000Z' })
      .expect(400);
  });
});

describe('avisar a los invitados', () => {
  /** El interruptor «Avisar 1 hora antes» se mandaba y el server lo ignoraba: avisaba igual. */
  it('crear con el aviso apagado lo guarda apagado', async () => {
    const r = await request(app)
      .post('/api/agenda/events')
      .set(conJwt(jwtYo))
      .send({ chatId: String(chatId), title: 'Sin aviso', startsAt: '2026-10-20T15:00:00.000Z', remindGuests: false })
      .expect(201);

    expect((await EventModel.findById(r.body.id).lean())?.remindGuests).toBe(false);
  });
});

describe('DELETE /api/agenda/events/:id', () => {
  it('quien lo creó lo cancela; un invitado no', async () => {
    const id = await crearEvento();

    await request(app).delete(`/api/agenda/events/${id}`).set(conJwt(jwtOtro)).expect(403);
    expect(await EventModel.countDocuments()).toBe(1);

    await request(app).delete(`/api/agenda/events/${id}`).set(conJwt(jwtYo)).expect(200);
    expect(await EventModel.countDocuments()).toBe(0);
  });
});

describe('GET /api/agenda/events', () => {
  it('dice si el evento es mío, para que la app ofrezca editarlo', async () => {
    await crearEvento();

    const mio = await request(app).get('/api/agenda/events').set(conJwt(jwtYo)).expect(200);
    const ajeno = await request(app).get('/api/agenda/events').set(conJwt(jwtOtro)).expect(200);

    expect(mio.body.events[0].mio).toBe(true);
    expect(ajeno.body.events[0].mio).toBe(false);
  });
});

describe('RSVP de quien entró al chat después (FL8)', () => {
  /** Los invitados son una foto de los miembros al crear: el que entró después veía el evento y su «Voy» daba 403. */
  it('un miembro nuevo puede responder y queda en la lista de invitados', async () => {
    const id = await crearEvento();
    const nuevo = (await UserModel.create({ phone: '51988888888', name: 'Nuevo' }))._id;
    await ChatModel.updateOne({ _id: chatId }, { $push: { members: { userId: nuevo, role: 'member' } } });
    const jwtNuevo = signSession({ userId: String(nuevo), deviceId: 'd3', email: '51988888888' });

    await request(app).post(`/api/agenda/events/${id}/rsvp`).set(conJwt(jwtNuevo)).send({ rsvp: 'yes' }).expect(200);

    const guardado = await EventModel.findById(id).lean();
    expect(guardado?.attendees.find((a) => String(a.userId) === String(nuevo))?.rsvp).toBe('yes');
  });

  it('alguien fuera del chat sigue sin poder responder', async () => {
    const id = await crearEvento();
    const ajeno = (await UserModel.create({ phone: '51977777777', name: 'Ajeno' }))._id;
    const jwtAjeno = signSession({ userId: String(ajeno), deviceId: 'd4', email: '51977777777' });

    await request(app).post(`/api/agenda/events/${id}/rsvp`).set(conJwt(jwtAjeno)).send({ rsvp: 'yes' }).expect(403);
  });
});

describe('chat secreto: sin eventos ni encuestas (FL8)', () => {
  /** El server no puede guardarlos cifrados: aceptarlos dejaba en claro lo que el candado promete esconder. */
  it('crear un evento o una encuesta en un chat secreto es 403 con el motivo', async () => {
    await ChatModel.updateOne({ _id: chatId }, { $set: { encrypted: true } });

    const evento = await request(app)
      .post('/api/agenda/events')
      .set(conJwt(jwtYo))
      .send({ chatId: String(chatId), title: 'Secreto', startsAt: '2026-10-20T15:00:00.000Z' })
      .expect(403);
    await request(app)
      .post('/api/agenda/polls')
      .set(conJwt(jwtYo))
      .send({ chatId: String(chatId), question: '¿Sí?', options: ['Sí', 'No'] })
      .expect(403);

    expect(evento.body.message).toMatch(/secreto/i);
    expect(await EventModel.countDocuments()).toBe(0);
  });
});
