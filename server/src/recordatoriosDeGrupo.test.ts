import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from './testMongo.js';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { DeviceModel, UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { ReminderModel } from './eventModels.js';
import { runReminderTick, setReminderPushSender } from './reminderCron.js';
import type { PushMessage } from './pushSender.js';
import { signSession } from './sessions.js';

/**
 * José, 19/10: «recordatorios grupales que solo existan y vivan en el grupo;
 * solo los admins, y que puedan llevar descripción, imagen, etc.». Cuando
 * llega la hora le suena a TODO el grupo; no aparecen en la agenda personal.
 */
let mongo: MongoMemoryServer;
let admin: Types.ObjectId;
let miembro: Types.ObjectId;
let ajeno: Types.ObjectId;
let grupoId: Types.ObjectId;
let enviados: PushMessage[];
const jwt = (userId: Types.ObjectId) => signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' });
const conJwt = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${jwt(userId)}` });
const subidas: string[] = [];
const app = buildApp({
  mediaUploader: {
    async upload(p) {
      subidas.push(p.fileName);
      return { ok: true, media: { url: `/files/${p.fileName}`, mediaId: 'm1', sizeBytes: p.bytes.length } as never };
    },
  },
});

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_recordatorios_grupo'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({}), ReminderModel.deleteMany({}), DeviceModel.deleteMany({})]);
  [admin, miembro, ajeno] = (
    await UserModel.create([
      { phone: '900000001', name: 'José' },
      { phone: '900000002', name: 'Ana' },
      { phone: '900000003', name: 'Ajeno' },
    ])
  ).map((u) => u._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  grupoId = (await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: admin, role: 'admin' }, { userId: miembro, role: 'member' }], lastSeq: 0 }))._id;
  await DeviceModel.create([
    { deviceId: 'da', userId: admin, pushToken: 'tok-admin' },
    { deviceId: 'dm', userId: miembro, pushToken: 'tok-miembro' },
  ]);
  enviados = [];
  setReminderPushSender({ send: async (m) => void enviados.push(m) });
});

const crear = (quien: Types.ObjectId, extra: object = {}) =>
  request(app)
    .post('/api/agenda/reminders')
    .set(conJwt(quien))
    .send({ chatId: String(grupoId), title: 'Vaciado de losa', note: 'Llevar casco', startsAt: '2026-10-20T15:00:00.000Z', ...extra });

describe('recordatorios del grupo', () => {
  it('lo crea un admin, con descripción, y se publica en el chat', async () => {
    const r = await crear(admin);

    expect(r.status).toBe(201);
    const mensaje = await MessageModel.findOne({ chatId: grupoId }).lean();
    expect(mensaje?.ref).toEqual({ tipo: 'recordatorio', id: r.body.id });
    expect(mensaje?.body).toContain('Vaciado de losa');
  });

  it('un miembro que no es admin no puede', async () => {
    expect((await crear(miembro)).status).toBe(403);
  });

  it('no aparece en la agenda personal de nadie: vive en el grupo', async () => {
    await crear(admin);
    const { body } = await request(app).get('/api/agenda/reminders').set(conJwt(miembro)).expect(200);
    expect([...body.mine, ...body.shared]).toHaveLength(0);
  });

  it('los miembros lo ven en el grupo y por su id; un ajeno no', async () => {
    const { body: creado } = await crear(admin);

    const lista = await request(app).get(`/api/agenda/reminders/del-chat/${grupoId}`).set(conJwt(miembro)).expect(200);
    expect(lista.body.reminders.map((r: { title: string }) => r.title)).toEqual(['Vaciado de losa']);
    await request(app).get(`/api/agenda/reminders/${creado.id}`).set(conJwt(miembro)).expect(200);

    await request(app).get(`/api/agenda/reminders/del-chat/${grupoId}`).set(conJwt(ajeno)).expect(404);
    await request(app).get(`/api/agenda/reminders/${creado.id}`).set(conJwt(ajeno)).expect(404);
  });

  it('a la hora le suena a TODO el grupo, con el nombre del grupo', async () => {
    await crear(admin);

    await runReminderTick(new Date('2026-10-20T15:00:10.000Z'));

    expect(enviados).toHaveLength(1);
    expect(new Set(enviados[0]!.tokens)).toEqual(new Set(['tok-admin', 'tok-miembro']));
    expect(enviados[0]!.title).toBe('Obra · Vaciado de losa');
    expect(enviados[0]!.body).toBe('Llevar casco');
  });

  it('lo borra un admin; un miembro no', async () => {
    const { body } = await crear(admin);
    await request(app).delete(`/api/agenda/reminders/${body.id}`).set(conJwt(miembro)).expect(403);
    await request(app).delete(`/api/agenda/reminders/${body.id}`).set(conJwt(admin)).expect(200);
    expect(await ReminderModel.countDocuments({})).toBe(0);
  });

  it('un admin le pone una imagen', async () => {
    const { body } = await crear(admin);
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a6a30000000049454e44ae426082', 'hex');

    const r = await request(app).post(`/api/agenda/reminders/${body.id}/imagen`).set(conJwt(admin)).attach('file', png, { filename: 'losa.png', contentType: 'image/png' });

    expect(r.status).toBe(200);
    expect((await ReminderModel.findById(body.id).lean())?.imageUrl).toContain('/files/');
  });
});

describe('editar el recordatorio del grupo (José, 19/10: «no hay cómo editarlo»)', () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a6a30000000049454e44ae426082', 'hex');

  it('un admin le cambia título, descripción y hora', async () => {
    const { body } = await crear(admin);

    await request(app).patch(`/api/agenda/reminders/${body.id}`).set(conJwt(admin)).send({ title: 'Tomar 2 litros', note: 'Cada hora', startsAt: '2026-10-21T15:00:00.000Z' }).expect(200);

    const r = await ReminderModel.findById(body.id).lean();
    expect([r?.title, r?.note, r?.startsAt.toISOString()]).toEqual(['Tomar 2 litros', 'Cada hora', '2026-10-21T15:00:00.000Z']);
  });

  it('un admin le quita la imagen; un miembro no', async () => {
    const { body } = await crear(admin);
    await request(app).post(`/api/agenda/reminders/${body.id}/imagen`).set(conJwt(admin)).attach('file', png, { filename: 'a.png', contentType: 'image/png' }).expect(200);

    await request(app).delete(`/api/agenda/reminders/${body.id}/imagen`).set(conJwt(miembro)).expect(403);
    await request(app).delete(`/api/agenda/reminders/${body.id}/imagen`).set(conJwt(admin)).expect(204);

    const r = await ReminderModel.findById(body.id).lean();
    expect(r?.imageUrl).toBeUndefined();
    expect(r?.imageMediaId).toBeUndefined();
  });
});

/**
 * E2E del 19/10: la tarjeta salió SIN la imagen. El chat se publicaba al crear,
 * la tarjeta se pedía en ese instante y la imagen llegaba un request después.
 * Con imagen, el recordatorio se crea sin publicar y se publica al final.
 */
describe('recordatorio del grupo con imagen: se publica cuando está completo', () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a6a30000000049454e44ae426082', 'hex');
  const publicar = (id: string, quien = admin) => request(app).post(`/api/agenda/reminders/${id}/publicar`).set(conJwt(quien));

  it('con publicar: false no sale en el chat hasta que se pide', async () => {
    const { body } = await crear(admin, { publicar: false });
    expect(await MessageModel.countDocuments({ chatId: grupoId })).toBe(0);

    await request(app).post(`/api/agenda/reminders/${body.id}/imagen`).set(conJwt(admin)).attach('file', png, { filename: 'losa.png', contentType: 'image/png' }).expect(200);
    await publicar(body.id).expect(204);

    const mensaje = await MessageModel.findOne({ chatId: grupoId }).lean();
    expect(mensaje?.ref).toEqual({ tipo: 'recordatorio', id: body.id });
  });

  it('publicar dos veces deja UNA sola tarjeta', async () => {
    const { body } = await crear(admin, { publicar: false });

    await Promise.all([publicar(body.id), publicar(body.id)]);

    expect(await MessageModel.countDocuments({ chatId: grupoId })).toBe(1);
  });

  it('el que se publicó al crear no se vuelve a publicar', async () => {
    const { body } = await crear(admin);

    await publicar(body.id).expect(204);

    expect(await MessageModel.countDocuments({ chatId: grupoId })).toBe(1);
  });

  it('un miembro que no es admin no lo publica', async () => {
    const { body } = await crear(admin, { publicar: false });

    await publicar(body.id, miembro).expect(403);
    expect(await MessageModel.countDocuments({ chatId: grupoId })).toBe(0);
  });
});

/**
 * José, 20/10: «los recordatorios no deberían ser solo grupales: también en
 * los chats individuales, los borradores y el chat conmigo mismo».
 */
describe('recordatorios en un 1:1 y en un borrador', () => {
  const chat = async (kind: 'direct' | 'notas') =>
    (await ChatModel.create({ kind, ...(kind === 'notas' ? { name: 'Notas' } : {}), members: kind === 'notas' ? [{ userId: admin, role: 'admin' }] : [{ userId: admin }, { userId: miembro }], lastSeq: 0 }))._id;
  const crearEn = (quien: Types.ObjectId, chatId: Types.ObjectId) =>
    request(app).post('/api/agenda/reminders').set(conJwt(quien)).send({ chatId: String(chatId), title: 'Llamar al laboratorio', startsAt: '2026-10-20T15:00:00.000Z' });

  it('en un 1:1 lo crea cualquiera de los dos, sale en el chat y les suena a los dos', async () => {
    const directo = await chat('direct');
    const r = await crearEn(miembro, directo);

    expect(r.status).toBe(201);
    expect((await MessageModel.findOne({ chatId: directo }).lean())?.ref).toEqual({ tipo: 'recordatorio', id: r.body.id });
    await runReminderTick(new Date('2026-10-20T15:00:10.000Z'));
    expect(new Set(enviados[0]!.tokens)).toEqual(new Set(['tok-admin', 'tok-miembro']));
    expect(enviados[0]!.title).toBe('Llamar al laboratorio');
  });

  it('en un 1:1 cualquiera de los dos lo edita o lo borra; un ajeno no lo ve', async () => {
    const directo = await chat('direct');
    const { body } = await crearEn(admin, directo);

    await request(app).patch(`/api/agenda/reminders/${body.id}`).set(conJwt(miembro)).send({ title: 'Llamar a las 4' }).expect(200);
    await request(app).delete(`/api/agenda/reminders/${body.id}`).set(conJwt(ajeno)).expect(404);
    await request(app).delete(`/api/agenda/reminders/${body.id}`).set(conJwt(miembro)).expect(200);
  });

  it('en un borrador (chat contigo) sale en el chat y te suena solo a ti', async () => {
    const notas = await chat('notas');
    const r = await crearEn(admin, notas);

    expect(r.status).toBe(201);
    expect((await MessageModel.findOne({ chatId: notas }).lean())?.ref?.tipo).toBe('recordatorio');
    await runReminderTick(new Date('2026-10-20T15:00:10.000Z'));
    expect(enviados[0]!.tokens).toEqual(['tok-admin']);
  });
});

/** José, 20/10: cuando suena, también queda en el chat (no solo en la barra del teléfono). */
describe('el recordatorio que suena queda en el chat', () => {
  it('a la hora, el chat recibe «⏰ Recordatorio: …»', async () => {
    await crear(admin);

    await runReminderTick(new Date('2026-10-20T15:00:10.000Z'));

    const aviso = await MessageModel.findOne({ chatId: grupoId, kind: 'system', 'system.evento': 'recordatorio-suena' }).lean();
    expect(aviso?.body).toBe('⏰ Recordatorio: Vaciado de losa');
    expect(aviso?.system?.valor).toBe('Vaciado de losa');
  });

  it('un recordatorio personal (sin chat) no escribe en ningún chat', async () => {
    await request(app).post('/api/agenda/reminders').set(conJwt(admin)).send({ title: 'Tomar agua', startsAt: '2026-10-20T15:00:00.000Z' }).expect(201);

    await runReminderTick(new Date('2026-10-20T15:00:10.000Z'));

    expect(await MessageModel.countDocuments({ kind: 'system' })).toBe(0);
  });
});
