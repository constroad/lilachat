import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ChatModel, MessageModel, type Message } from '../src/chatModels.js';
import { DeviceModel, UserModel } from '../src/models.js';
import { __resetPresence, markOnline } from '../src/presence.js';
import { buildPushText, type PushMessage } from '../src/pushSender.js';
import { notifyOffline, setPushSender } from '../src/pushService.js';

let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let maria: Types.ObjectId;
let chatId: Types.ObjectId;
let sent: PushMessage[];

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_push_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  __resetPresence();
  sent = [];
  setPushSender({
    send: async (message) => {
      sent.push(message);
    },
  });
  await Promise.all([
    ChatModel.deleteMany({}),
    MessageModel.deleteMany({}),
    UserModel.deleteMany({}),
    DeviceModel.deleteMany({}),
  ]);
  const users = await UserModel.create([
    { phone: '900000001', name: 'José' },
    { phone: '900000002', name: 'María' },
  ]);
  [jose, maria] = users.map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  const chat = await ChatModel.create({
    kind: 'direct',
    members: [
      { userId: jose, role: 'admin' },
      { userId: maria, role: 'member' },
    ],
    lastSeq: 0,
  });
  chatId = chat._id;
  await DeviceModel.create([
    { deviceId: 'd-jose', userId: jose, pushToken: 'tok-jose' },
    { deviceId: 'd-maria', userId: maria, pushToken: 'tok-maria' },
  ]);
});

const message = (overrides: Partial<Message> = {}): Message =>
  ({
    _id: new Types.ObjectId(),
    chatId,
    seq: 1,
    senderId: jose,
    clientKey: 'ck',
    kind: 'text',
    body: 'hola',
    at: new Date(),
    ...overrides,
  }) as Message;

const members = () => [String(jose), String(maria)];

describe('notifyOffline', () => {
  it('notifica a quien está fuera de línea', async () => {
    await notifyOffline({ message: message(), members: members(), senderId: String(jose) });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.tokens).toEqual(['tok-maria']);
    expect(sent[0]?.data).toMatchObject({ seq: 1 });
  });

  /** Empujarle una notificación a quien está mirando el chat es ruido. */
  it('NO notifica a quien tiene socket vivo', async () => {
    markOnline(String(maria));

    await notifyOffline({ message: message(), members: members(), senderId: String(jose) });

    expect(sent).toHaveLength(0);
  });

  /** Ni al autor ni a sus otros dispositivos: ya recibieron `msg.new`. */
  it('nunca notifica al autor', async () => {
    await notifyOffline({ message: message(), members: members(), senderId: String(jose) });

    expect(sent[0]?.tokens).not.toContain('tok-jose');
  });

  it('sin token registrado no se manda nada', async () => {
    await DeviceModel.deleteMany({ userId: maria });

    await notifyOffline({ message: message(), members: members(), senderId: String(jose) });

    expect(sent).toHaveLength(0);
  });
});

describe('buildPushText', () => {
  /**
   * Es lo ÚNICO que se ve con la pantalla bloqueada: dice quién y qué, no
   * «tienes un mensaje nuevo» —que obliga a abrir la app para saber si vale la
   * pena abrirla.
   */
  it('en 1:1 va el nombre de quien escribió', () => {
    expect(buildPushText({ senderName: 'María', body: 'nos vemos', kind: 'text' })).toEqual({
      title: 'María',
      body: 'nos vemos',
    });
  });

  it('en grupo van los dos: el grupo y quién habló', () => {
    const text = buildPushText({
      senderName: 'María',
      chatName: 'Familia',
      body: 'llego tarde',
      kind: 'text',
    });

    expect(text.title).toBe('Familia · María');
  });

  it('sin texto dice QUÉ llegó', () => {
    expect(buildPushText({ senderName: 'María', kind: 'image' }).body).toContain('Foto');
    expect(buildPushText({ senderName: 'María', kind: 'video' }).body).toContain('Video');
  });
});
