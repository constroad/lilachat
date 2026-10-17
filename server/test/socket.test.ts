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
import { programarMensaje, runScheduledTick } from '../src/scheduledMessages.js';
import { listChats } from '../src/chatService.js';

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

  // SE LE DA UN RESPIRO AL TRABAJO DE FONDO antes de cerrar la base.
  //
  // El handler de `msg.send` dispara push y la respuesta de Lila SIN esperarlas
  // —a propósito: la conversación no puede quedar esperando al modelo—, así que
  // al terminar el último test quedan consultas en vuelo. Desconectar ahí las
  // aborta con «Operation interrupted because client was closed», y ese rechazo
  // hace que vitest salga con 1 aunque los 161 tests pasen. En CI eso frena el
  // job de deploy, y el síntoma es «no se desplegó nada», no «falló un test».
  await new Promise((resolve) => setTimeout(resolve, 300));

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

/**
 * Mensajes que crea el server solo (programados, auto-respuestas) se publican
 * igual que los escritos: antes se guardaban y nadie los veía hasta reabrir el
 * chat (auditoría del 16/10).
 */
describe('mensajes creados por el server', () => {
  it('un programado vencido le llega en vivo al otro miembro', async () => {
    // Arrange
    const receptor = await connect(tokenFor(maria));
    const ahora = new Date();
    await programarMensaje({
      chatId: new Types.ObjectId(chatId),
      senderId: jose,
      body: 'feliz cumpleaños',
      sendAt: new Date(ahora.getTime() + 60_000),
      clientKey: 'prog-1',
    });
    const llegada = new Promise<{ body?: string }>((resolve) => receptor.once('msg.new', resolve));

    // Act
    await runScheduledTick(new Date(ahora.getTime() + 120_000));

    // Assert
    await expect(llegada).resolves.toMatchObject({ body: 'feliz cumpleaños' });
  });
});

/**
 * Lo que mando yo queda leído por mí, en TODOS mis dispositivos: antes un
 * mensaje propio mandado desde el teléfono contaba como «sin leer» en la web
 * (y Lila ofrecía ponerme al día con mi propio mensaje).
 */
describe('lo propio no queda sin leer', () => {
  it('después de enviar por socket, mi no leído del chat es 0', async () => {
    // Arrange
    const emisor = await connect(tokenFor(jose));

    // Act
    await emisor.timeout(10_000).emitWithAck('msg.send', { chatId, clientKey: 'propio-1', body: 'hola' });
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Assert
    const chats = await listChats(jose);
    expect(chats.find((chat) => chat.id === chatId)?.unread).toBe(0);
  });
});

/**
 * Editar (José, 17/10/2026): el autor edita y el OTRO lo ve cambiar en vivo,
 * con su marca de editado. Lo ajeno no se edita.
 */
describe('msg.edit', () => {
  it('el autor edita y al otro le llega msg.edited con el texto nuevo', async () => {
    const emisor = await connect(tokenFor(jose));
    const receptor = await connect(tokenFor(maria));
    await emisor.emitWithAck('msg.send', { chatId, clientKey: 'ck-e1', kind: 'text', body: 'hola Mria' });
    const editado = new Promise<Record<string, unknown>>((resolve) => receptor.on('msg.edited', resolve));

    const ack = await emisor.emitWithAck('msg.edit', { chatId, seq: 1, body: 'hola María' });

    expect(ack).toMatchObject({ ok: true });
    expect(await editado).toMatchObject({ chatId, seq: 1, body: 'hola María' });
    expect((await editado).editedAt).toBeTruthy();
  });

  it('lo de otro no se edita y el motivo vuelve en el ack', async () => {
    const emisor = await connect(tokenFor(jose));
    const otra = await connect(tokenFor(maria));
    await emisor.emitWithAck('msg.send', { chatId, clientKey: 'ck-e2', kind: 'text', body: 'mío' });

    const ack = await otra.emitWithAck('msg.edit', { chatId, seq: 1, body: 'te lo cambio' });

    expect(ack).toEqual({ ok: false, motivo: 'Solo puedes editar tus propios mensajes.' });
  });
});
