import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { maybeAnswerMention, resetAssistantUser } from './assistantReply.js';
import { setAssistantClient } from './assistantService.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { UserModel } from './models.js';

/**
 * `@lila` en la conversación.
 *
 * Lo que se fija: que solo responda cuando la llaman, que su respuesta quede
 * como UN MENSAJE MÁS del chat —con `seq`, para que se sincronice, se respalde
 * y se exporte como todo lo demás— y que un fallo del modelo no la deje muda.
 */
let mongo: MongoMemoryServer;
const yo = new Types.ObjectId();
let chatId: Types.ObjectId;
let llamadas = 0;

const clienteFalso = (respuesta = 'Dijeron que el domingo a la una.') => ({
  ask: vi.fn(async () => {
    llamadas += 1;
    return { ok: true as const, text: respuesta };
  }),
});

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_mention_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  llamadas = 0;
  resetAssistantUser();
  setAssistantClient(clienteFalso());
  await Promise.all([
    ChatModel.deleteMany({}),
    MessageModel.deleteMany({}),
    UserModel.deleteMany({}),
  ]);
  await UserModel.create({ _id: yo, phone: '902049935', name: 'José' });
  const chat = await ChatModel.create({
    kind: 'group',
    name: 'Familia',
    lastSeq: 1,
    members: [{ userId: yo }],
  });
  chatId = chat._id;
  await MessageModel.create({
    chatId,
    seq: 1,
    senderId: yo,
    kind: 'text',
    body: 'Nos vemos el domingo a la una',
    clientKey: 'm1',
  });
});

describe('maybeAnswerMention', () => {
  it('responde y deja su respuesta como un mensaje del chat', async () => {
    const repartidos: string[] = [];

    await maybeAnswerMention({
      chatId,
      askedBy: yo,
      body: '@lila ¿a qué hora quedamos?',
      onReply: async (message) => void repartidos.push(message.body ?? ''),
    });

    const guardado = await MessageModel.findOne({ seq: 2 }).lean();
    expect(guardado?.body).toBe('Dijeron que el domingo a la una.');
    // Con `seq`: así se sincroniza por cursor, se respalda y se exporta igual
    // que cualquier mensaje. Un canal aparte habría necesitado su propia
    // versión de cada una de esas cosas.
    expect(guardado?.seq).toBe(2);
    expect(repartidos).toEqual(['Dijeron que el domingo a la una.']);
  });

  /** Sin mención NO se llama al modelo, ni se escribe nada. */
  it('un mensaje normal no la invoca', async () => {
    await maybeAnswerMention({
      chatId,
      askedBy: yo,
      body: 'mañana llevo el postre',
      onReply: async () => undefined,
    });

    expect(llamadas).toBe(0);
    expect(await MessageModel.countDocuments({})).toBe(1);
  });

  /**
   * Si el modelo falla, Lila lo DICE en el chat. Quedarse muda se lee como la
   * app rota, y quien preguntó se queda esperando una respuesta que no viene.
   */
  it('cuando el modelo falla, lo dice en vez de callarse', async () => {
    setAssistantClient({
      ask: async () => ({ ok: false, code: 'sin_configurar', message: 'Falta la clave.' }),
    });

    await maybeAnswerMention({
      chatId,
      askedBy: yo,
      body: '@lila hola',
      onReply: async () => undefined,
    });

    const guardado = await MessageModel.findOne({ seq: 2 }).lean();
    expect(guardado?.body).toContain('No pude responder');
    expect(guardado?.body).toContain('Falta la clave.');
  });

  /**
   * Lila firma con SU usuario, no con el de quien preguntó: si firmara con el
   * del usuario, la respuesta se vería como propia y el chat quedaría lleno de
   * cosas que nadie escribió.
   */
  it('firma con su propio usuario', async () => {
    await maybeAnswerMention({
      chatId,
      askedBy: yo,
      body: '@lila hola',
      onReply: async () => undefined,
    });

    const guardado = await MessageModel.findOne({ seq: 2 }).lean();
    expect(String(guardado?.senderId)).not.toBe(String(yo));
    const lila = await UserModel.findById(guardado?.senderId).lean();
    expect(lila?.name).toBe('Lila');
  });
});
