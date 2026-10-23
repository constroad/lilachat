import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from './testMongo.js';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { DestacadoModel } from './destacadoModel.js';
import { signSession } from './sessions.js';
import { reaccionar } from './reacciones.js';
import { HiloInvalidoError, validarRaiz } from './hilos.js';
import { escribirAviso } from './chatService.js';
import { fijarMensaje } from './mensajesFijados.js';

/**
 * The reminder that rings in the chat is answered like a message (José, 21/10:
 * he could not react, reply or send a sticker to it). The grey notices of the
 * group stay out.
 */
let mongo: MongoMemoryServer;
let me: Types.ObjectId;
let wilson: Types.ObjectId;
let chatId: Types.ObjectId;
const REMINDER_SEQ = 1;
const GREY_NOTICE_SEQ = 2;
const withJwt = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' })}` });
const app = buildApp({});

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_highlighted_notice'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({}), DestacadoModel.deleteMany({})]);
  const users = await UserModel.create([{ phone: '900000001', name: 'José' }, { phone: '900000002', name: 'Wilson' }]);
  me = users[0]!._id;
  wilson = users[1]!._id;
  chatId = (await ChatModel.create({ kind: 'direct', members: [{ userId: me, role: 'member' }, { userId: wilson, role: 'member' }], lastSeq: 2 }))._id;
  await MessageModel.create([
    { chatId, seq: REMINDER_SEQ, senderId: me, clientKey: 'sis-recordatorio-suena-1', kind: 'system', body: '⏰ Recordatorio: Llamar a Wilson', system: { evento: 'recordatorio-suena', valor: 'Llamar a Wilson' }, at: new Date() },
    { chatId, seq: GREY_NOTICE_SEQ, senderId: me, clientKey: 'sis-foto-2', kind: 'system', body: 'Cambiaste la foto', system: { evento: 'foto' }, at: new Date() },
  ]);
});

describe('the reminder that rang in the chat', () => {
  it('takes a reaction', async () => {
    const reaction = await reaccionar({ chatId: String(chatId), seq: REMINDER_SEQ, userId: String(wilson), emoji: '👍' });
    expect(reaction.ok).toBe(true);
  });

  it('opens a thread', async () => {
    await expect(validarRaiz(chatId, REMINDER_SEQ, false)).resolves.toBeUndefined();
  });

  it('can be pinned and starred', async () => {
    expect((await fijarMensaje({ chatId: String(chatId), quien: me, seq: REMINDER_SEQ, duracion: '24h' })).ok).toBe(true);
    expect((await request(app).put(`/api/chats/${chatId}/destacados/${REMINDER_SEQ}`).set(withJwt(me))).status).toBe(204);
  });
});

describe('a grey notice of the group', () => {
  it('takes no reaction, thread, pin or star', async () => {
    expect((await reaccionar({ chatId: String(chatId), seq: GREY_NOTICE_SEQ, userId: String(wilson), emoji: '👍' })).ok).toBe(false);
    await expect(validarRaiz(chatId, GREY_NOTICE_SEQ, false)).rejects.toBeInstanceOf(HiloInvalidoError);
    expect((await fijarMensaje({ chatId: String(chatId), quien: me, seq: GREY_NOTICE_SEQ, duracion: '24h' })).ok).toBe(false);
    expect((await request(app).put(`/api/chats/${chatId}/destacados/${GREY_NOTICE_SEQ}`).set(withJwt(me))).status).toBe(400);
  });
});

describe('the reminder that rang points to its reminder (pending 76)', () => {
  it('the notice carries the reminder, so a tap opens it with its note and links', async () => {
    // Act
    const notice = await escribirAviso({ chatId: String(chatId), quien: me, evento: 'recordatorio-suena', valor: 'Ver el video', body: '⏰ Recordatorio: Ver el video', ref: { tipo: 'recordatorio', id: 'rem-1' } });
    // Assert
    expect(notice?.ref).toEqual({ tipo: 'recordatorio', id: 'rem-1' });
    const saved = await MessageModel.findOne({ chatId, seq: notice!.seq }).lean();
    expect(saved?.ref).toEqual({ tipo: 'recordatorio', id: 'rem-1' });
  });
});
