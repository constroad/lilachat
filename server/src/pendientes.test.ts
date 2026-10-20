import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel } from './chatModels.js';
import { ReminderModel } from './eventModels.js';
import { signSession } from './sessions.js';

/**
 * «Pendientes» (José aprobó el 20/10): lo que me suena, junto. Mis
 * recordatorios y los de TODOS mis chats (grupo, 1:1, borradores), más los de
 * una vez que sonaron en las últimas 24 h («Vencidos»).
 */
let mongo: MongoMemoryServer;
let yo: Types.ObjectId;
let wilson: Types.ObjectId;
let ajeno: Types.ObjectId;
const conJwt = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' })}` });
const app = buildApp({});
const HORA = 3_600_000;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_pendientes'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), ReminderModel.deleteMany({})]);
  const usuarios = await UserModel.create([{ phone: '900000001', name: 'José' }, { phone: '900000002', name: 'Wilson' }, { phone: '900000003', name: 'Otro' }]);
  yo = usuarios[0]!._id;
  wilson = usuarios[1]!._id;
  ajeno = usuarios[2]!._id;
});

describe('GET /api/agenda/linea', () => {
  it('junta mis recordatorios con los de mis chats, con el chat de cada uno', async () => {
    const grupo = await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: yo, role: 'member' }, { userId: wilson, role: 'admin' }], lastSeq: 0 });
    const directo = await ChatModel.create({ kind: 'direct', members: [{ userId: yo }, { userId: wilson }], lastSeq: 0 });
    const ajenoChat = await ChatModel.create({ kind: 'group', name: 'Ajeno', members: [{ userId: ajeno, role: 'admin' }], lastSeq: 0 });
    const futuro = new Date(Date.now() + 5 * HORA);
    await ReminderModel.create([
      { userId: yo, title: 'Tomar agua', startsAt: futuro, recurrence: 'daily', active: true },
      { userId: wilson, chatId: grupo._id, title: 'Vaciado', startsAt: futuro, recurrence: 'once', active: true },
      { userId: wilson, chatId: directo._id, title: 'Ejercicios', startsAt: futuro, recurrence: 'weekly', active: true },
      { userId: ajeno, chatId: ajenoChat._id, title: 'No es mío', startsAt: futuro, recurrence: 'once', active: true },
      { userId: wilson, title: 'Personal de Wilson', startsAt: futuro, recurrence: 'once', active: true },
    ]);

    const res = await request(app).get('/api/agenda/linea').set(conJwt(yo));

    expect(res.status).toBe(200);
    const porTitulo = new Map(res.body.recordatorios.map((r: { title: string }) => [r.title, r]));
    expect([...porTitulo.keys()].sort()).toEqual(['Ejercicios', 'Tomar agua', 'Vaciado']);
    expect(porTitulo.get('Vaciado')).toMatchObject({ chatId: String(grupo._id), chat: { kind: 'group', name: 'Obra' } });
    expect(porTitulo.get('Ejercicios')).toMatchObject({ chat: { kind: 'direct', name: 'Wilson', phone: '900000002' } });
    expect((porTitulo.get('Tomar agua') as { chat?: unknown }).chat).toBeUndefined();
    expect(res.body.vencidos).toEqual([]);
  });

  it('«Vencidos»: los de una vez que ya sonaron en las últimas 24 h; los más viejos no', async () => {
    await ReminderModel.create([
      { userId: yo, title: 'Sonó hace 2 h', startsAt: new Date(Date.now() - 2 * HORA), recurrence: 'once', active: false },
      { userId: yo, title: 'Sonó hace 3 días', startsAt: new Date(Date.now() - 72 * HORA), recurrence: 'once', active: false },
      { userId: yo, title: 'Apagado a mano, futuro', startsAt: new Date(Date.now() + 2 * HORA), recurrence: 'once', active: false },
    ]);
    const res = await request(app).get('/api/agenda/linea').set(conJwt(yo));
    expect(res.body.vencidos.map((r: { title: string }) => r.title)).toEqual(['Sonó hace 2 h']);
    expect(res.body.recordatorios).toEqual([]);
    // Los míos apagados (no los vencidos de hoy) se listan para prenderlos de nuevo.
    expect(res.body.apagados.map((r: { title: string }) => r.title).sort()).toEqual(['Apagado a mano, futuro', 'Sonó hace 3 días']);
  });

  it('sin sesión, 401', async () => {
    expect((await request(app).get('/api/agenda/linea')).status).toBe(401);
  });
});
