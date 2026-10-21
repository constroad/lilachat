import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from './testMongo.js';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { EventModel, PollModel, ReminderModel } from './eventModels.js';
import { configurarAvisoDeTarjeta, type CambioDeTarjeta } from './avisoDeTarjeta.js';
import { signSession } from './sessions.js';

/**
 * José, 19/10: «no se editan; creé el recordatorio grupal y no hay cómo
 * editarlo», y un voto o un borrado se veía recién al reabrir el chat. Cada
 * cambio de una tarjeta avisa por el socket a TODOS los miembros del chat.
 */
let mongo: MongoMemoryServer;
let admin: Types.ObjectId;
let miembro: Types.ObjectId;
let grupoId: Types.ObjectId;
let avisos: { userId: string; cambio: CambioDeTarjeta }[];
const conJwt = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' })}` });
const app = buildApp({
  mediaUploader: { async upload(p) { return { ok: true, media: { url: `/files/${p.fileName}`, mediaId: 'm1', sizeBytes: p.bytes.length } as never }; } },
});
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a6a30000000049454e44ae426082', 'hex');

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_aviso_tarjeta'));
  configurarAvisoDeTarjeta((userId, cambio) => void avisos.push({ userId, cambio }));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({}), ReminderModel.deleteMany({}), PollModel.deleteMany({}), EventModel.deleteMany({})]);
  [admin, miembro] = (await UserModel.create([{ phone: '900000001', name: 'José' }, { phone: '900000002', name: 'Ana' }])).map((u) => u._id) as [Types.ObjectId, Types.ObjectId];
  grupoId = (await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: admin, role: 'admin' }, { userId: miembro, role: 'member' }], lastSeq: 0 }))._id;
  avisos = [];
});

/** Espera a que el aviso (que sale después de responder) llegue. */
const avisados = async (tipo: CambioDeTarjeta['tipo'], id: string) => {
  await new Promise((listo) => setTimeout(listo, 50));
  return avisos.filter((a) => a.cambio.tipo === tipo && a.cambio.id === id && a.cambio.chatId === String(grupoId)).map((a) => a.userId).sort();
};
const todos = () => [String(admin), String(miembro)].sort();

describe('el recordatorio del grupo avisa al cambiar', () => {
  const crear = async () => (await request(app).post('/api/agenda/reminders').set(conJwt(admin)).send({ chatId: String(grupoId), title: 'Tomar agua', startsAt: '2026-10-20T15:00:00.000Z' })).body.id as string;

  it('al editarlo', async () => {
    const id = await crear();
    avisos = [];
    await request(app).patch(`/api/agenda/reminders/${id}`).set(conJwt(admin)).send({ title: 'Tomar 2 litros de agua' }).expect(200);
    expect(await avisados('recordatorio', id)).toEqual(todos());
  });

  it('al cambiarle la imagen', async () => {
    const id = await crear();
    avisos = [];
    await request(app).post(`/api/agenda/reminders/${id}/imagen`).set(conJwt(admin)).attach('file', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(200);
    expect(await avisados('recordatorio', id)).toEqual(todos());
  });

  it('al borrarlo', async () => {
    const id = await crear();
    avisos = [];
    await request(app).delete(`/api/agenda/reminders/${id}`).set(conJwt(admin)).expect(200);
    expect(await avisados('recordatorio', id)).toEqual(todos());
  });

  it('un intento rechazado no avisa nada', async () => {
    const id = await crear();
    avisos = [];
    await request(app).patch(`/api/agenda/reminders/${id}`).set(conJwt(miembro)).send({ title: 'x' }).expect(403);
    expect(await avisados('recordatorio', id)).toEqual([]);
  });

  it('el personal no tiene chat: no avisa a nadie', async () => {
    const { body } = await request(app).post('/api/agenda/reminders').set(conJwt(admin)).send({ title: 'Mío', startsAt: '2026-10-20T15:00:00.000Z' });
    avisos = [];
    await request(app).patch(`/api/agenda/reminders/${body.id}`).set(conJwt(admin)).send({ title: 'Mío 2' }).expect(200);
    await new Promise((listo) => setTimeout(listo, 50));
    expect(avisos).toEqual([]);
  });
});

describe('la encuesta avisa al votar, cerrar y borrar', () => {
  const crear = async () => (await request(app).post('/api/agenda/polls').set(conJwt(admin)).send({ chatId: String(grupoId), question: '¿Almuerzo?', options: ['Sí', 'No'] })).body.id as string;

  it('al votar', async () => {
    const id = await crear();
    avisos = [];
    await request(app).post(`/api/agenda/polls/${id}/vote`).set(conJwt(miembro)).send({ optionIndex: 0 }).expect(200);
    expect(await avisados('encuesta', id)).toEqual(todos());
  });

  it('al cerrarla y al borrarla', async () => {
    const id = await crear();
    avisos = [];
    await request(app).post(`/api/agenda/polls/${id}/close`).set(conJwt(admin)).expect(200);
    expect(await avisados('encuesta', id)).toEqual(todos());
    avisos = [];
    await request(app).delete(`/api/agenda/polls/${id}`).set(conJwt(admin)).expect(200);
    expect(await avisados('encuesta', id)).toEqual(todos());
  });
});

describe('el evento avisa al responder, editar y cancelar', () => {
  const crear = async () => (await request(app).post('/api/agenda/events').set(conJwt(admin)).send({ chatId: String(grupoId), title: 'Vaciado', startsAt: '2026-10-21T15:00:00.000Z' })).body.id as string;

  it('al responder, al editar y al cancelar', async () => {
    const id = await crear();
    avisos = [];
    await request(app).post(`/api/agenda/events/${id}/rsvp`).set(conJwt(miembro)).send({ rsvp: 'yes' }).expect(200);
    expect(await avisados('evento', id)).toEqual(todos());
    avisos = [];
    await request(app).patch(`/api/agenda/events/${id}`).set(conJwt(admin)).send({ title: 'Vaciado de losa' }).expect(200);
    expect(await avisados('evento', id)).toEqual(todos());
    avisos = [];
    await request(app).delete(`/api/agenda/events/${id}`).set(conJwt(admin)).expect(200);
    expect(await avisados('evento', id)).toEqual(todos());
  });
});
