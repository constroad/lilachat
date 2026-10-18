import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TELEFONO_DE_LILA } from '@lilachat/shared';
import { ChatModel, MessageModel, ReceiptModel } from '../src/chatModels.js';
import { sendMessage } from '../src/chatService.js';
import { infoDeMensaje } from '../src/infoDeMensaje.js';
import { UserModel } from '../src/models.js';

/**
 * «Info» de un mensaje propio (FL9), como WhatsApp: quién lo leyó, a quién le
 * llegó y a quién todavía no. Los acuses son un cursor por persona, así que se
 * dice el estado de cada uno, no la hora.
 */
let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let beto: Types.ObjectId;
let lila: Types.ObjectId;
let chatId: string;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_info_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([ChatModel.deleteMany({}), MessageModel.deleteMany({}), ReceiptModel.deleteMany({}), UserModel.deleteMany({})]);
  const users = await UserModel.create([
    { phone: '900000001', name: 'José' },
    { phone: '900000002', name: 'Ana' },
    { phone: '900000003', name: 'Beto' },
    { phone: TELEFONO_DE_LILA, name: 'Lila' },
  ]);
  [jose, ana, beto, lila] = users.map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId, Types.ObjectId];
  const chat = await ChatModel.create({
    kind: 'group',
    name: 'QA',
    members: [{ userId: jose }, { userId: ana }, { userId: beto }, { userId: lila }],
    lastSeq: 0,
  });
  chatId = String(chat._id);
});

describe('infoDeMensaje', () => {
  it('cada miembro con su estado, sin mí ni Lila', async () => {
    await sendMessage({ chatId, senderId: jose, clientKey: 'k1', body: 'hola' });
    await ReceiptModel.create([
      { chatId, userId: ana, readSeq: 1, deliveredSeq: 1 },
      { chatId, userId: beto, readSeq: 0, deliveredSeq: 1 },
    ]);

    const r = await infoDeMensaje({ chatId, seq: 1, quien: jose });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.miembros.map((m) => [m.name, m.estado])).toEqual([
      ['Ana', 'read'],
      ['Beto', 'delivered'],
    ]);
  });

  it('quien nunca abrió el chat figura como enviado', async () => {
    await sendMessage({ chatId, senderId: jose, clientKey: 'k1', body: 'hola' });

    const r = await infoDeMensaje({ chatId, seq: 1, quien: jose });

    expect(r.ok && r.miembros.every((m) => m.estado === 'sent')).toBe(true);
  });

  it('solo de mensajes propios', async () => {
    await sendMessage({ chatId, senderId: ana, clientKey: 'k1', body: 'de Ana' });

    expect((await infoDeMensaje({ chatId, seq: 1, quien: jose })).ok).toBe(false);
  });

  it('quien no es miembro no ve nada', async () => {
    await sendMessage({ chatId, senderId: jose, clientKey: 'k1', body: 'hola' });

    expect((await infoDeMensaje({ chatId, seq: 1, quien: new Types.ObjectId() })).ok).toBe(false);
  });
});
