import { createServer, type Server as HttpServer } from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';
import { attachSocket } from '../src/socket.js';

/**
 * El socket de verdad, sobre un puerto real. Lo que NINGÚN test unitario ve:
 * que el JWT se exija en el handshake, que el mensaje llegue al OTRO
 * dispositivo, y que el ack traiga el `seq`.
 */

let mongo: MongoMemoryServer;
let httpServer: HttpServer;
let port: number;
let jose: Types.ObjectId;
let maria: Types.ObjectId;
let chatId: string;
const clients: ClientSocket[] = [];

const connect = (token: string): Promise<ClientSocket> =>
  new Promise((resolve, reject) => {
    const socket = createClient(`http://127.0.0.1:${port}`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    clients.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_socket_test'));
  httpServer = createServer(buildApp());
  attachSocket(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as { port: number }).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(() => {
  while (clients.length > 0) clients.pop()?.disconnect();
});

beforeEach(async () => {
  await Promise.all([ChatModel.deleteMany({}), MessageModel.deleteMany({}), UserModel.deleteMany({})]);
  const users = await UserModel.create([
    { phone: '900000001', email: 'jose@x.com', name: 'José' },
    { phone: '900000002', email: 'maria@x.com', name: 'María' },
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
  chatId = String(chat._id);
});

const tokenFor = (userId: Types.ObjectId) =>
  signSession({ userId: String(userId), deviceId: `dev-${userId}`, email: 'x@x.com' });

describe('handshake', () => {
  it('sin token no se conecta', async () => {
    await expect(connect('')).rejects.toThrow();
  });

  it('con un token inventado tampoco', async () => {
    await expect(connect('no-es-un-jwt')).rejects.toThrow();
  });
});

describe('msg.send', () => {
  it('el ack trae el seq y el OTRO dispositivo recibe el mensaje', async () => {
    const emisor = await connect(tokenFor(jose));
    const receptor = await connect(tokenFor(maria));

    const recibido = new Promise<Record<string, unknown>>((resolve) => {
      receptor.on('msg.new', resolve);
    });
    const ack = await emisor.emitWithAck('msg.send', {
      chatId,
      clientKey: 'ck-1',
      kind: 'text',
      body: 'hola María',
    });

    expect(ack).toMatchObject({ ok: true, seq: 1, duplicate: false });
    expect(await recibido).toMatchObject({ body: 'hola María', seq: 1 });
  });

  /** El reintento de la cola offline sobre el socket: mismo seq, una fila. */
  it('reenviar el mismo clientKey devuelve duplicate y NO crea otra fila', async () => {
    const emisor = await connect(tokenFor(jose));
    await emisor.emitWithAck('msg.send', { chatId, clientKey: 'ck-1', body: 'hola' });
    const retry = await emisor.emitWithAck('msg.send', { chatId, clientKey: 'ck-1', body: 'hola' });

    expect(retry).toMatchObject({ ok: true, seq: 1, duplicate: true });
    expect(await MessageModel.countDocuments({})).toBe(1);
  });

  /**
   * 403 es PERMANENTE para el outbox del cliente: descarta con motivo en vez de
   * reintentar para siempre. Que el server lo diga es lo que evita el wedge.
   */
  it('escribir en un chat ajeno da 403, no 500', async () => {
    const ajeno = await ChatModel.create({
      kind: 'group',
      name: 'Otro',
      members: [{ userId: maria, role: 'admin' }],
      lastSeq: 0,
    });
    const emisor = await connect(tokenFor(jose));

    const ack = await emisor.emitWithAck('msg.send', {
      chatId: String(ajeno._id),
      clientKey: 'x',
      body: 'me colé',
    });

    expect(ack).toMatchObject({ ok: false, status: 403 });
    expect(await MessageModel.countDocuments({})).toBe(0);
  });
});

describe('sync.pull', () => {
  it('devuelve solo el delta posterior al cursor', async () => {
    const emisor = await connect(tokenFor(jose));
    for (const key of ['a', 'b', 'c']) {
      await emisor.emitWithAck('msg.send', { chatId, clientKey: key, body: key });
    }

    const respuesta = (await emisor.emitWithAck('sync.pull', { cursors: { [chatId]: 2 } })) as {
      ok: boolean;
      batches: { chatId: string; messages: { seq: number }[] }[];
    };

    expect(respuesta.ok).toBe(true);
    expect(respuesta.batches[0]?.messages.map((message) => message.seq)).toEqual([3]);
  });
});
