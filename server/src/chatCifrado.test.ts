import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from './testMongo.js';
import mongoose, { Types } from 'mongoose';
import { ChatModel, MessageModel } from './chatModels.js';
import { CifradoRequeridoError, ForbiddenChatError, sendMessage } from './chatService.js';

/**
 * Un chat secreto NO acepta nada en claro (auditoría 17/10/2026). El comentario
 * de `sendMessage` lo prometía («en un chat cifrado no se guarda `body`») y el
 * código solo miraba si llegaba un sobre: si la app mandaba texto mientras
 * cargaba la clave —o una foto, que nunca va cifrada—, quedaba en claro en la
 * base de un chat con candado.
 */
let mongo: MongoMemoryServer;
let yo: Types.ObjectId;
let secreto: Types.ObjectId;
let normal: Types.ObjectId;

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
  yo = new Types.ObjectId();
  const otro = new Types.ObjectId();
  const miembros = [{ userId: yo, role: 'member' as const }, { userId: otro, role: 'member' as const }];
  secreto = (await ChatModel.create({ kind: 'direct', members: miembros, lastSeq: 0, encrypted: true }))._id;
  normal = (await ChatModel.create({ kind: 'direct', members: miembros, lastSeq: 0 }))._id;
});

const sobre = { v: 1 as const, nonce: 'bm9uY2U=', ciphertext: 'Y2lmcmFkbw==' };

describe('sendMessage en un chat secreto', () => {
  it('texto en claro: se rechaza, no se guarda y no consume un seq', async () => {
    await expect(sendMessage({ chatId: String(secreto), senderId: yo, clientKey: 'k1', body: 'hola' })).rejects.toBeInstanceOf(
      CifradoRequeridoError
    );

    expect(await MessageModel.countDocuments({ chatId: secreto })).toBe(0);
    expect((await ChatModel.findById(secreto).lean())?.lastSeq).toBe(0);
  });

  it('una foto (sin sobre) también se rechaza', async () => {
    await expect(
      sendMessage({
        chatId: String(secreto),
        senderId: yo,
        clientKey: 'k2',
        kind: 'image',
        media: { url: 'https://x/y.jpg', mime: 'image/jpeg' } as never,
      })
    ).rejects.toBeInstanceOf(CifradoRequeridoError);
  });

  it('el rechazo es PERMANENTE para la cola (403), no un 500 que se reintenta', () => {
    expect(new CifradoRequeridoError()).toBeInstanceOf(ForbiddenChatError);
  });

  it('con sobre se guarda, sin body', async () => {
    const { message } = await sendMessage({ chatId: String(secreto), senderId: yo, clientKey: 'k3', envelope: sobre });

    expect(message.seq).toBe(1);
    expect((await MessageModel.findById(message._id).lean())?.body).toBeUndefined();
  });

  it('en un chat normal el texto en claro sigue andando', async () => {
    const { message } = await sendMessage({ chatId: String(normal), senderId: yo, clientKey: 'k4', body: 'hola' });

    expect(message.body).toBe('hola');
  });

  it('quien no es miembro sigue recibiendo el error de acceso, no el de cifrado', async () => {
    await expect(sendMessage({ chatId: String(secreto), senderId: new Types.ObjectId(), clientKey: 'k5', body: 'x' })).rejects.toThrow(
      'No tienes acceso a esa conversación.'
    );
  });
});
