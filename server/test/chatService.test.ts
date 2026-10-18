import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ChatModel, MessageModel, ReceiptModel } from '../src/chatModels.js';
import {
  ForbiddenChatError,
  listMessages,
  markRead,
  pullSince,
  sendMessage,
} from '../src/chatService.js';
import { listChats } from '../src/listaDeChats.js';
import { cambiarAjustesDeChat } from '../src/miembrosDelChat.js';
import { UserModel } from '../src/models.js';

let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let maria: Types.ObjectId;
let ajeno: Types.ObjectId;
let chatId: string;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_chat_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([
    ChatModel.deleteMany({}),
    MessageModel.deleteMany({}),
    ReceiptModel.deleteMany({}),
    UserModel.deleteMany({}),
  ]);
  const users = await UserModel.create([
    { phone: '900000001', email: 'jose@x.com', name: 'José' },
    { phone: '900000002', email: 'maria@x.com', name: 'María' },
    { phone: '900000003', email: 'ajeno@x.com', name: 'Ajeno' },
  ]);
  [jose, maria, ajeno] = users.map((user) => user._id) as [
    Types.ObjectId,
    Types.ObjectId,
    Types.ObjectId,
  ];
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

describe('sendMessage — seq', () => {
  it('el seq arranca en 1 y avanza de a uno por chat', async () => {
    const first = await sendMessage({ chatId, senderId: jose, clientKey: 'a', body: 'hola' });
    const second = await sendMessage({ chatId, senderId: maria, clientKey: 'b', body: 'qué tal' });

    expect(first.message.seq).toBe(1);
    expect(second.message.seq).toBe(2);
  });

  /**
   * El `seq` se asigna con `$inc` atómico. Sin eso, dos mensajes simultáneos
   * toman el mismo número y uno se pierde (o revienta el índice único).
   */
  it('bajo concurrencia, NINGÚN seq se repite', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_unused, index) =>
        sendMessage({ chatId, senderId: jose, clientKey: `k${index}`, body: `m${index}` })
      )
    );
    const seqs = results.map((result) => result.message.seq).sort((a, b) => a - b);

    expect(new Set(seqs).size).toBe(12);
    expect(seqs).toEqual(Array.from({ length: 12 }, (_unused, index) => index + 1));
  });

  it('cada chat lleva su propia numeración', async () => {
    const otro = await ChatModel.create({
      kind: 'group',
      name: 'Familia',
      members: [{ userId: jose, role: 'admin' }],
      lastSeq: 0,
    });
    await sendMessage({ chatId, senderId: jose, clientKey: 'a', body: 'x' });
    const enOtro = await sendMessage({
      chatId: String(otro._id),
      senderId: jose,
      clientKey: 'b',
      body: 'y',
    });

    expect(enOtro.message.seq).toBe(1);
  });
});

describe('sendMessage — idempotencia', () => {
  /** El reintento de la cola offline no puede duplicar el mensaje. */
  it('mismo clientKey reenviado: mismo seq, UNA sola fila', async () => {
    const first = await sendMessage({ chatId, senderId: jose, clientKey: 'ck', body: 'hola' });
    const retry = await sendMessage({ chatId, senderId: jose, clientKey: 'ck', body: 'hola' });

    expect(retry.duplicate).toBe(true);
    expect(retry.message.seq).toBe(first.message.seq);
    expect(await MessageModel.countDocuments({ chatId })).toBe(1);
  });

  it('dos personas pueden usar el mismo clientKey sin pisarse', async () => {
    await sendMessage({ chatId, senderId: jose, clientKey: 'ck', body: 'de josé' });
    const deMaria = await sendMessage({ chatId, senderId: maria, clientKey: 'ck', body: 'de maría' });

    expect(deMaria.duplicate).toBe(false);
    expect(await MessageModel.countDocuments({ chatId })).toBe(2);
  });
});

describe('sendMessage — membresía', () => {
  /** Sin este guard, cualquiera con un chatId escribe en el chat de otros. */
  it('quien no es miembro NO puede escribir', async () => {
    await expect(
      sendMessage({ chatId, senderId: ajeno, clientKey: 'x', body: 'hola' })
    ).rejects.toBeInstanceOf(ForbiddenChatError);
    expect(await MessageModel.countDocuments({ chatId })).toBe(0);
  });

  /**
   * FL4: el envío devuelve los miembros que leyó al reservar el `seq`, para que
   * el reparto no vuelva a buscarlos (de 5 viajes a la base a 3 antes del ack).
   */
  it('devuelve los miembros del chat junto con el mensaje', async () => {
    const result = await sendMessage({ chatId, senderId: jose, clientKey: 'm1', body: 'hola' });

    expect([...(result.members ?? [])].sort()).toEqual([String(jose), String(maria)].sort());
  });

  it('un no-miembro no consume seq: el chat sigue en el mismo número', async () => {
    await expect(sendMessage({ chatId, senderId: ajeno, clientKey: 'x', body: 'intruso' })).rejects.toThrow();

    expect((await ChatModel.findById(chatId).lean())?.lastSeq).toBe(0);
  });

  it('un chat inexistente se rechaza igual que uno ajeno', async () => {
    await expect(
      sendMessage({
        chatId: String(new Types.ObjectId()),
        senderId: jose,
        clientKey: 'x',
        body: 'hola',
      })
    ).rejects.toBeInstanceOf(ForbiddenChatError);
  });
});

describe('listMessages e historial', () => {
  it('devuelve la página más reciente, en orden ascendente', async () => {
    for (let index = 1; index <= 5; index += 1) {
      await sendMessage({ chatId, senderId: jose, clientKey: `k${index}`, body: `m${index}` });
    }
    const page = await listMessages({ chatId, userId: jose, limit: 3 });

    expect(page.map((message) => message.seq)).toEqual([3, 4, 5]);
  });

  it('pagina hacia atrás con beforeSeq', async () => {
    for (let index = 1; index <= 5; index += 1) {
      await sendMessage({ chatId, senderId: jose, clientKey: `k${index}`, body: `m${index}` });
    }
    const page = await listMessages({ chatId, userId: jose, limit: 2, beforeSeq: 3 });

    expect(page.map((message) => message.seq)).toEqual([1, 2]);
  });

  it('un no-miembro no lee el historial', async () => {
    await expect(listMessages({ chatId, userId: ajeno })).rejects.toBeInstanceOf(ForbiddenChatError);
  });
});

describe('pullSince — el delta del cursor', () => {
  it('trae SOLO lo posterior al cursor', async () => {
    for (let index = 1; index <= 4; index += 1) {
      await sendMessage({ chatId, senderId: jose, clientKey: `k${index}`, body: `m${index}` });
    }
    const batches = await pullSince({ userId: jose, cursors: { [chatId]: 2 } });

    expect(batches[0]?.messages.map((message) => message.seq)).toEqual([3, 4]);
  });

  it('sin cursor previo trae el chat desde el principio', async () => {
    await sendMessage({ chatId, senderId: jose, clientKey: 'a', body: 'x' });
    const batches = await pullSince({ userId: jose, cursors: {} });

    expect(batches[0]?.messages.map((message) => message.seq)).toEqual([1]);
  });

  /**
   * El bug de la auditoría del 16/10: la app pide el cursor de UN chat (el
   * abierto) y el server recorría TODOS con cursor 0 — los 200 mensajes más
   * viejos de cada chat, en cada apertura, para que el teléfono los tirara.
   */
  it('con cursores, trae SOLO los chats pedidos', async () => {
    const otro = await ChatModel.create({
      kind: 'group',
      name: 'Familia',
      members: [{ userId: jose, role: 'admin' }],
      lastSeq: 0,
    });
    await sendMessage({ chatId, senderId: jose, clientKey: 'a', body: 'x' });
    await sendMessage({ chatId: String(otro._id), senderId: jose, clientKey: 'b', body: 'y' });

    const batches = await pullSince({ userId: jose, cursors: { [chatId]: 0 } });

    expect(batches.map((batch) => batch.chatId)).toEqual([chatId]);
  });

  it('un chat ya al día no devuelve lote', async () => {
    await sendMessage({ chatId, senderId: jose, clientKey: 'a', body: 'x' });

    const batches = await pullSince({ userId: jose, cursors: { [chatId]: 1 } });

    expect(batches).toEqual([]);
  });

  /** Aislamiento: el cursor de un chat ajeno no puede filtrar nada. */
  it('nunca devuelve chats de los que no se es miembro', async () => {
    const ajenoChat = await ChatModel.create({
      kind: 'group',
      name: 'Otro',
      members: [{ userId: ajeno, role: 'admin' }],
      lastSeq: 0,
    });
    await sendMessage({
      chatId: String(ajenoChat._id),
      senderId: ajeno,
      clientKey: 'z',
      body: 'secreto',
    });

    const batches = await pullSince({ userId: jose, cursors: { [String(ajenoChat._id)]: 0 } });

    expect(batches.some((batch) => batch.chatId === String(ajenoChat._id))).toBe(false);
  });
});

describe('listChats y no leídos', () => {
  it('el no leído sale de la resta lastSeq − readSeq', async () => {
    await sendMessage({ chatId, senderId: maria, clientKey: 'a', body: 'hola' });
    await sendMessage({ chatId, senderId: maria, clientKey: 'b', body: 'ahí?' });

    const before = await listChats(jose);
    expect(before[0]?.unread).toBe(2);

    await markRead({ chatId, userId: jose, seq: 2 });
    const after = await listChats(jose);
    expect(after[0]?.unread).toBe(0);
  });

  it('markRead nunca retrocede el cursor de lectura', async () => {
    await sendMessage({ chatId, senderId: maria, clientKey: 'a', body: 'hola' });
    await sendMessage({ chatId, senderId: maria, clientKey: 'b', body: 'ahí?' });
    await markRead({ chatId, userId: jose, seq: 2 });
    await markRead({ chatId, userId: jose, seq: 1 });

    const receipt = await ReceiptModel.findOne({ chatId, userId: jose }).lean();
    expect(receipt?.readSeq).toBe(2);
  });

  it('trae el último mensaje para la vista previa de la lista', async () => {
    await sendMessage({ chatId, senderId: maria, clientKey: 'a', body: 'nos vemos' });
    const chats = await listChats(jose);

    expect(chats[0]?.lastMessage?.body).toBe('nos vemos');
  });
});

/**
 * Archivar y «marcar como no leído» (FL9). Son de CADA miembro, como silenciar:
 * que José archive el chat no lo archiva para María. La marca de no leído se
 * va sola al leer, como en WhatsApp; el archivado no (un mensaje nuevo no lo
 * saca de «Archivados»).
 */
describe('archivar y marcar como no leído', () => {
  const miResumen = async (quien: Types.ObjectId) => (await listChats(quien)).find((chat) => chat.id === chatId);

  it('archivar es solo para quien lo pide', async () => {
    const r = await cambiarAjustesDeChat({ chatId, quien: jose, archived: true });

    expect(r.ok).toBe(true);
    expect((await miResumen(jose))?.archived).toBe(true);
    expect((await miResumen(maria))?.archived).toBe(false);
  });

  it('un mensaje nuevo no desarchiva', async () => {
    await cambiarAjustesDeChat({ chatId, quien: jose, archived: true });

    await sendMessage({ chatId, senderId: maria, clientKey: 'k-arch', body: 'hola' });

    expect((await miResumen(jose))?.archived).toBe(true);
  });

  it('marcar como no leído se ve en la lista y se va al leer', async () => {
    await sendMessage({ chatId, senderId: maria, clientKey: 'k-nl', body: 'hola' });
    await markRead({ chatId, userId: jose, seq: 1 });
    await cambiarAjustesDeChat({ chatId, quien: jose, markedUnread: true });
    expect((await miResumen(jose))?.markedUnread).toBe(true);

    await markRead({ chatId, userId: jose, seq: 1 });

    expect((await miResumen(jose))?.markedUnread).toBe(false);
  });

  it('quien no es miembro no puede marcar nada', async () => {
    const r = await cambiarAjustesDeChat({ chatId, quien: ajeno, markedUnread: true });

    expect(r.ok).toBe(false);
  });
});
