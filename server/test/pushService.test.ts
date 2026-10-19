import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ChatModel, MessageModel, type Message } from '../src/chatModels.js';
import { DeviceModel, UserModel } from '../src/models.js';
import { __resetPresence, markOnline } from '../src/presence.js';
import { buildPushText, type PushDeDatos, type PushMessage } from '../src/pushSender.js';
import { CAPACIDAD_MENSAJE_NATIVO } from '@lilachat/shared';
import { verificarEntrega } from '../src/entregaPorAviso.js';
import { notifyOffline, setPushSender } from '../src/pushService.js';

let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let maria: Types.ObjectId;
let chatId: Types.ObjectId;
let sent: PushMessage[];
let datos: PushDeDatos[];

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
  datos = [];
  setPushSender({
    send: async (message) => {
      sent.push(message);
    },
    sendDatos: async (message) => {
      datos.push(message);
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

/**
 * EL DOBLE CHECK SIN ABRIR LA APP (FL8.2; José, 17/10: «en el chat de Wilson
 * solo hay 1 check, deberían ser 2: Wilson tiene internet, solo que no abrió la
 * app»). La notificación común la dibuja Android sin ejecutar nada de la app,
 * así que el server nunca se enteraba de que el mensaje llegó. Al teléfono que
 * sabe dibujarla le llega SOLO-DATOS, con un token corto para confirmar la
 * entrega sin el JWT.
 */
describe('notifyOffline — doble check sin abrir la app (FL8.2)', () => {
  it('con la capacidad: solo-datos con lo que hace falta para dibujarla y el token de entrega', async () => {
    await DeviceModel.updateOne({ deviceId: 'd-maria' }, { $set: { platform: 'android', capacidades: [CAPACIDAD_MENSAJE_NATIVO] } });

    await notifyOffline({ message: message(), members: members(), senderId: String(jose) });

    expect(sent).toHaveLength(0);
    expect(datos).toHaveLength(1);
    expect(datos[0]).toMatchObject({ tokens: ['tok-maria'] });
    expect(datos[0]!.data).toMatchObject({ tipo: 'mensaje', chatId: String(chatId), seq: '1', autor: 'José', chat: '', cuerpo: 'hola', silencioso: '0' });
    expect(verificarEntrega(String(datos[0]!.data.entrega))).toEqual({ chatId: String(chatId), userId: String(maria), seq: 1 });
  });

  /**
   * Silenciado NO es «no le llegó»: WhatsApp pone el doble check igual. Le va
   * el push solo para confirmar la entrega, marcado silencioso (no se dibuja).
   * El teléfono viejo silenciado sigue sin recibir nada.
   */
  it('silenciado: al nativo le llega silencioso; al viejo, nada', async () => {
    await ChatModel.updateOne({ _id: chatId, 'members.userId': maria }, { $set: { 'members.$.muted': true } });
    await DeviceModel.create({ deviceId: 'd-maria-2', userId: maria, platform: 'android', pushToken: 'tok-maria-2', capacidades: [CAPACIDAD_MENSAJE_NATIVO] });

    await notifyOffline({ message: message(), members: members(), senderId: String(jose) });

    expect(sent).toHaveLength(0);
    expect(datos.map((d) => [d.tokens, d.data.silencioso])).toEqual([[['tok-maria-2'], '1']]);
  });

  /**
   * José, 18/10: «taggear con @». Como WhatsApp, a quien MENCIONAN le suena
   * aunque haya silenciado el grupo: es justo para lo que sirve mencionar.
   */
  it('mencionado en un chat silenciado: le suena igual', async () => {
    await ChatModel.updateOne({ _id: chatId, 'members.userId': maria }, { $set: { 'members.$.muted': true } });
    await DeviceModel.create({ deviceId: 'd-maria-2', userId: maria, platform: 'android', pushToken: 'tok-maria-2', capacidades: [CAPACIDAD_MENSAJE_NATIVO] });

    await notifyOffline({
      message: message({ body: '@María ven', menciones: [{ userId: String(maria), desde: 0, largo: 6 }] }),
      members: members(),
      senderId: String(jose),
    });

    expect(sent.map((s) => s.tokens)).toEqual([['tok-maria']]);
    expect(datos.map((d) => [d.tokens, d.data.silencioso])).toEqual([[['tok-maria-2'], '0']]);
  });

  it('en un grupo dice de qué grupo', async () => {
    await ChatModel.updateOne({ _id: chatId }, { $set: { kind: 'group', name: 'Los originales' } });
    await DeviceModel.updateOne({ deviceId: 'd-maria' }, { $set: { platform: 'android', capacidades: [CAPACIDAD_MENSAJE_NATIVO] } });

    await notifyOffline({ message: message(), members: members(), senderId: String(jose) });

    expect(datos[0]!.data).toMatchObject({ chat: 'Los originales', autor: 'José' });
  });
});

/**
 * FL11 (José, 18/10, teléfono real): avisos duplicados en dos formatos. Su
 * teléfono figuraba en dos devices con el MISMO token: uno nativo y uno viejo.
 */
describe('notifyOffline — un token, un envío (FL11)', () => {
  it('el mismo teléfono en un device nativo y en uno viejo recibe SOLO el push de datos', async () => {
    await DeviceModel.updateOne({ deviceId: 'd-maria' }, { $set: { platform: 'android', capacidades: [CAPACIDAD_MENSAJE_NATIVO] } });
    await DeviceModel.create({ deviceId: 'd-maria-viejo', userId: maria, pushToken: 'tok-maria' });

    await notifyOffline({ message: message(), members: members(), senderId: String(jose) });

    expect(sent).toHaveLength(0);
    expect(datos.map((d) => d.tokens)).toEqual([['tok-maria']]);
  });

  it('un token repetido en varios devices viejos recibe un solo push común', async () => {
    await DeviceModel.create([
      { deviceId: 'd-maria-b', userId: maria, pushToken: 'tok-maria' },
      { deviceId: 'd-maria-c', userId: maria, pushToken: 'tok-maria' },
    ]);

    await notifyOffline({ message: message(), members: members(), senderId: String(jose) });

    expect(sent.flatMap((m) => m.tokens)).toEqual(['tok-maria']);
  });

  it('el push de datos lleva el teléfono de quien escribe, para buscarlo en la agenda', async () => {
    await DeviceModel.updateOne({ deviceId: 'd-maria' }, { $set: { platform: 'android', capacidades: [CAPACIDAD_MENSAJE_NATIVO] } });

    await notifyOffline({ message: message(), members: members(), senderId: String(jose) });

    expect(datos[0]!.data).toMatchObject({ telefono: '900000001' });
  });
});

describe('notifyOffline — responder desde el aviso (FL11)', () => {
  it('trae el token para responder; en un chat secreto, no', async () => {
    await DeviceModel.updateOne({ deviceId: 'd-maria' }, { $set: { platform: 'android', capacidades: [CAPACIDAD_MENSAJE_NATIVO] } });

    await notifyOffline({ message: message(), members: members(), senderId: String(jose) });
    await ChatModel.updateOne({ _id: chatId }, { $set: { encrypted: true } });
    await notifyOffline({ message: message({ seq: 2 }), members: members(), senderId: String(jose) });

    expect(typeof datos[0]!.data.respuesta).toBe('string');
    expect(datos[0]!.data.respuesta).not.toBe('');
    expect(datos[1]!.data.respuesta).toBe('');
  });
});
