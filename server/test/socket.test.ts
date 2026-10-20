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
import { listChats } from '../src/listaDeChats.js';
import { sendMessage } from '../src/chatService.js';

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

  /**
   * José, 19/10: «mando un mensaje, salgo y en la lista aparece el círculo de
   * no leído en MI mensaje». El acuse propio se escribía después de repartir el
   * mensaje y del ack: una lista pedida en ese hueco contaba lo propio.
   */
  it('mi otro dispositivo pide la lista apenas le llega mi mensaje y no cuenta como sin leer', async () => {
    // Arrange
    const emisor = await connect(tokenFor(jose));
    const otroDispositivo = await connect(tokenFor(jose));
    const noLeidosAlLlegar = new Promise<number | undefined>((resolve) =>
      otroDispositivo.once('msg.new', () => void listChats(jose).then((chats) => resolve(chats.find((chat) => chat.id === chatId)?.unread)))
    );

    // Act
    await emisor.timeout(10_000).emitWithAck('msg.send', { chatId, clientKey: 'propio-2', body: 'hola' });

    // Assert
    await expect(noLeidosAlLlegar).resolves.toBe(0);
  });

  /**
   * Auditoría (19/10): un programado sale solo, de madrugada; no es que su
   * autor haya leído el chat. Antes daba por leídos los mensajes ajenos y el
   * otro veía azul sin que nadie los abriera.
   */
  it('un mensaje programado no da por leídos los mensajes ajenos', async () => {
    // Arrange
    await sendMessage({ chatId, senderId: maria, clientKey: 'm-1', body: 'uno' });
    await sendMessage({ chatId, senderId: maria, clientKey: 'm-2', body: 'dos' });
    const ahora = new Date();
    await programarMensaje({ chatId: new Types.ObjectId(chatId), senderId: jose, body: 'buen día', sendAt: new Date(ahora.getTime() + 60_000), clientKey: 'prog-2' });

    // Act
    await runScheduledTick(new Date(ahora.getTime() + 120_000));

    // Assert
    const deJose = (await listChats(jose)).find((chat) => chat.id === chatId);
    const deMaria = (await listChats(maria)).find((chat) => chat.id === chatId);
    expect(deJose?.unread).toBeGreaterThanOrEqual(2);
    expect(deMaria?.othersReadSeq).toBe(0);
  });

  it('con el ack en la mano, la lista ya no cuenta lo propio', async () => {
    // Arrange
    const emisor = await connect(tokenFor(jose));

    // Act
    await emisor.timeout(10_000).emitWithAck('msg.send', { chatId, clientKey: 'propio-3', body: 'hola' });
    const chats = await listChats(jose);

    // Assert
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

/**
 * Sacado de un grupo (FL9d): al que sacaron le llega `chat.changed` —para que
 * su app lo sepa— y también la línea «X te sacó del grupo», como WhatsApp.
 * Antes la línea solo iba a los que quedaban.
 */
describe('sacar a alguien del grupo', () => {
  it('el sacado recibe el cambio y el aviso en el chat', async () => {
    const grupo = await ChatModel.create({
      kind: 'group',
      name: 'QA',
      members: [
        { userId: maria, role: 'admin' },
        { userId: jose, role: 'member' },
      ],
      lastSeq: 0,
    });
    const sacado = await connect(tokenFor(jose));
    const cambio = new Promise((resolve) => sacado.on('chat.changed', resolve));
    const aviso = new Promise<Record<string, unknown>>((resolve) => sacado.on('msg.new', resolve));

    const respuesta = await fetch(`http://127.0.0.1:${port}/api/chats/${grupo._id}/members/${jose}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenFor(maria)}` },
    });

    expect(respuesta.status).toBe(200);
    expect(await cambio).toMatchObject({ chatId: String(grupo._id) });
    expect(await aviso).toMatchObject({ kind: 'system', chatId: String(grupo._id) });
  });
});

/**
 * W3a (19/10): lo que hago con MIS chats desde la web (archivar, silenciar,
 * eliminar para mí) le llega a mi teléfono como `chat.changed`. Antes no se
 * avisaba: con un solo dispositivo no hacía falta.
 */
describe('mis ajustes de un chat, en mis otros dispositivos', () => {
  const pedir = (ruta: string, method: string, body?: unknown) =>
    fetch(`http://127.0.0.1:${port}/api/chats/${chatId}${ruta}`, {
      method,
      headers: { Authorization: `Bearer ${tokenFor(jose)}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });

  it('archivar avisa a mis sockets y NO al otro miembro', async () => {
    const miTelefono = await connect(tokenFor(jose));
    const otra = await connect(tokenFor(maria));
    const cambio = new Promise((resolve) => miTelefono.on('chat.changed', resolve));
    let alOtro = false;
    otra.on('chat.changed', () => (alOtro = true));

    expect((await pedir('/ajustes', 'PATCH', { archived: true })).status).toBe(200);
    expect(await cambio).toEqual({ chatId });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(alOtro).toBe(false);
  });

  /**
   * Auditoría (19/10): abrir un chat marcado como «no leído» lo desmarca, pero
   * si no había nada nuevo que leer no salía ningún aviso y mis otros equipos
   * seguían con el punto.
   */
  it('abrir un chat marcado «no leído» sin nada nuevo avisa a mis otros sockets', async () => {
    const { message } = await sendMessage({ chatId, senderId: maria, clientKey: 'mu-1', body: 'hola' });
    const miTelefono = await connect(tokenFor(jose));
    const miWeb = await connect(tokenFor(jose));
    await miTelefono.timeout(5000).emitWithAck('msg.send', { chatId, clientKey: 'mu-2', body: 'leído' });
    expect((await pedir('/ajustes', 'PATCH', { markedUnread: true })).status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const cambio = new Promise((resolve) => miWeb.on('chat.changed', resolve));

    miTelefono.emit('read.set', { chatId, seq: message.seq });

    expect(await cambio).toEqual({ chatId });
  });

  it('eliminar para mí también avisa a mis sockets', async () => {
    const miTelefono = await connect(tokenFor(jose));
    const cambio = new Promise((resolve) => miTelefono.on('chat.changed', resolve));
    expect((await pedir('/borrar-para-mi', 'POST')).status).toBe(200);
    expect(await cambio).toEqual({ chatId });
  });
});

/**
 * Auditoría (19/10): sin push (o con el push perdido), lo que llegó mientras
 * estaba desconectado quedaba en UN check hasta que abriera ese chat. Al
 * conectar, el server lo da por entregado y se lo avisa a quien lo mandó.
 */
describe('entregado al conectar', () => {
  it('lo que me mandaron offline pasa a entregado apenas conecto, y el remitente lo ve', async () => {
    // Arrange
    await sendMessage({ chatId, senderId: maria, clientKey: 'off-1', body: 'uno' });
    await sendMessage({ chatId, senderId: maria, clientKey: 'off-2', body: 'dos' });
    const remitente = await connect(tokenFor(maria));
    const acuse = new Promise<{ userId: string; deliveredSeq?: number }>((resolve) => remitente.on('receipt', (frame) => frame.userId === String(jose) && resolve(frame)));

    // Act
    await connect(tokenFor(jose));

    // Assert
    await expect(acuse).resolves.toMatchObject({ deliveredSeq: 2 });
    const deMaria = (await listChats(maria)).find((chat) => chat.id === chatId);
    expect(deMaria?.othersDeliveredSeq).toBe(2);
    expect(deMaria?.othersReadSeq).toBe(0);
  });
});


/** E3 (20/10): responder en un hilo por el socket. */
describe('hilos por el socket', () => {
  it('la respuesta llega con su raíz y todos reciben el resumen nuevo de la raíz', async () => {
    const emisor = await connect(tokenFor(jose));
    const otra = await connect(tokenFor(maria));
    const raiz = await emisor.timeout(5000).emitWithAck('msg.send', { chatId, clientKey: 'h-raiz', body: '¿Quién confirma?' });
    const llegada = new Promise<{ hiloDe?: number }>((resolve) => otra.on('msg.new', (m: { hiloDe?: number }) => m.hiloDe && resolve(m)));
    const resumen = new Promise<{ raiz: number; hilo: { respuestas: number } }>((resolve) => otra.once('msg.hilo', resolve));

    const respuesta = await otra.timeout(5000).emitWithAck('msg.send', { chatId, clientKey: 'h-1', body: 'Yo', hiloDe: raiz.seq });

    expect(respuesta).toMatchObject({ ok: true });
    await expect(llegada).resolves.toMatchObject({ hiloDe: raiz.seq });
    await expect(resumen).resolves.toMatchObject({ raiz: raiz.seq, hilo: { respuestas: 1 } });
  });

  it('una raíz inválida se rechaza con su motivo', async () => {
    const emisor = await connect(tokenFor(jose));
    const r = await emisor.timeout(5000).emitWithAck('msg.send', { chatId, clientKey: 'h-mal', body: 'x', hiloDe: 999 });
    expect(r).toMatchObject({ ok: false, motivo: 'Ese mensaje no admite respuestas en hilo.' });
  });
});
