import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from './testMongo.js';
import mongoose, { Types } from 'mongoose';
import { VENTANA_DE_EDICION_MS } from '@lilachat/shared';
import { ChatModel, MessageModel } from './chatModels.js';
import { editMessage } from './chatService.js';

/**
 * Editar un mensaje (José, 17/10/2026). El server decide con el mismo motor
 * que la app (`shared/editarMensaje`): un cliente modificado se saltea la app.
 */
let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let chatId: string;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  jose = new Types.ObjectId();
  ana = new Types.ObjectId();
  chatId = String((await ChatModel.create({ kind: 'direct', members: [{ userId: jose }, { userId: ana }], lastSeq: 2 }))._id);
  await MessageModel.create([
    { chatId, seq: 1, senderId: jose, clientKey: 'k1', kind: 'text', body: 'hola', at: new Date() },
    { chatId, seq: 2, senderId: ana, clientKey: 'k2', kind: 'text', body: 'qué tal', at: new Date() },
  ]);
});

describe('editMessage', () => {
  it('lo propio y reciente: cambia el texto y marca editado', async () => {
    const resultado = await editMessage({ chatId, seq: 1, userId: jose, body: '  hola, José  ' });

    expect(resultado.ok).toBe(true);
    const guardado = await MessageModel.findOne({ chatId, seq: 1 }).lean();
    expect(guardado?.body).toBe('hola, José');
    expect(guardado?.editedAt).toBeInstanceOf(Date);
  });

  it('lo de otro: no, y no toca nada', async () => {
    expect(await editMessage({ chatId, seq: 2, userId: jose, body: 'otra cosa' })).toEqual({
      ok: false,
      motivo: 'Solo puedes editar tus propios mensajes.',
    });
    expect((await MessageModel.findOne({ chatId, seq: 2 }).lean())?.body).toBe('qué tal');
  });

  it('pasados los 15 minutos: no', async () => {
    await MessageModel.updateOne({ chatId, seq: 1 }, { $set: { at: new Date(Date.now() - VENTANA_DE_EDICION_MS - 5_000) } });

    expect((await editMessage({ chatId, seq: 1, userId: jose, body: 'tarde' })).ok).toBe(false);
  });

  it('vacío: no (para borrar está eliminar)', async () => {
    expect((await editMessage({ chatId, seq: 1, userId: jose, body: '   ' })).ok).toBe(false);
  });

  it('quien no es del chat: no encuentra la conversación', async () => {
    expect(await editMessage({ chatId, seq: 1, userId: new Types.ObjectId(), body: 'x' })).toEqual({
      ok: false,
      motivo: 'No encontramos esa conversación.',
    });
  });

  it('en un chat secreto: no', async () => {
    await ChatModel.updateOne({ _id: chatId }, { $set: { encrypted: true } });

    expect((await editMessage({ chatId, seq: 1, userId: jose, body: 'x' })).ok).toBe(false);
  });
});
