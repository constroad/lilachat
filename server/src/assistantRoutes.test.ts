import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { resetAssistantLimits } from './assistantRoutes.js';
import { setAssistantClient } from './assistantService.js';
import { ChatModel, MessageModel, ReceiptModel } from './chatModels.js';
import { UserModel } from './models.js';
import { signSession } from './sessions.js';

/**
 * El asistente (F8).
 *
 * Lo que más se prueba acá no es la calidad de la respuesta —eso lo decide el
 * modelo— sino **qué sale de la casa**: a qué conversaciones puede mirar, cuánto
 * manda y qué NO manda. Un asistente con el permiso mal puesto es una forma
 * cómoda de leer chats ajenos.
 */
let mongo: MongoMemoryServer;
const app = buildApp();

const yo = new Types.ObjectId();
const mama = new Types.ObjectId();
const extraño = new Types.ObjectId();
const jwtDe = (userId: Types.ObjectId) =>
  signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' });

let chatId: Types.ObjectId;
let pedidos: { system: string; prompt: string }[] = [];

const clienteFalso = (respuesta = 'Resumen de prueba.') => ({
  ask: vi.fn(async (params: { system: string; prompt: string }) => {
    pedidos.push({ system: params.system, prompt: params.prompt });
    return { ok: true as const, text: respuesta };
  }),
});

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_assistant_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  pedidos = [];
  // Sin esto, el freno por usuario arrastra las llamadas de un test al
  // siguiente y el sexto da 429 sin que nadie entienda por qué.
  resetAssistantLimits();
  setAssistantClient(clienteFalso());
  await Promise.all([
    ChatModel.deleteMany({}),
    MessageModel.deleteMany({}),
    ReceiptModel.deleteMany({}),
    UserModel.deleteMany({}),
  ]);
  await UserModel.create([
    { _id: yo, phone: '902049935', name: 'José' },
    { _id: mama, phone: '999000777', name: 'Mamá' },
  ]);
  const chat = await ChatModel.create({
    kind: 'group',
    name: 'Familia',
    lastSeq: 3,
    members: [{ userId: yo }, { userId: mama }],
  });
  chatId = chat._id;
  await MessageModel.create([
    { chatId, seq: 1, senderId: mama, kind: 'text', body: 'Nos vemos el domingo', clientKey: 'a1' },
    { chatId, seq: 2, senderId: mama, kind: 'text', body: 'Llevo arroz con pato', clientKey: 'a2' },
    {
      chatId,
      seq: 3,
      senderId: mama,
      kind: 'image',
      clientKey: 'a3',
      media: { mediaId: 'm', url: '/files/companies/constroad/apps/lilachat/secreto.jpg' },
    },
  ]);
});

describe('POST /api/assistant/catch-up', () => {
  it('resume lo que no leí y dice cuántos mensajes miró', async () => {
    const respuesta = await request(app)
      .post('/api/assistant/catch-up')
      .set('Authorization', `Bearer ${jwtDe(yo)}`)
      .send({ chatId: String(chatId) });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.text).toBe('Resumen de prueba.');
    expect(respuesta.body.messageCount).toBe(2);
  });

  /**
   * LA prueba de la fase. Un extraño con sesión válida no puede pedir el
   * resumen de un chat ajeno — y sobre todo, **no se llama al modelo**: si se
   * llamara, la conversación ya habría salido de la casa aunque la respuesta
   * se descarte después.
   */
  it('un extraño no obtiene resumen y NO se llama al modelo', async () => {
    const respuesta = await request(app)
      .post('/api/assistant/catch-up')
      .set('Authorization', `Bearer ${jwtDe(extraño)}`)
      .send({ chatId: String(chatId) });

    expect(respuesta.status).toBe(403);
    expect(pedidos).toHaveLength(0);
  });

  /**
   * Las fotos NO viajan. Mandar la URL del storage a un tercero no aporta nada
   * al resumen y filtra un enlace a un archivo privado.
   */
  it('no manda media ni sus URLs al modelo', async () => {
    await request(app)
      .post('/api/assistant/catch-up')
      .set('Authorization', `Bearer ${jwtDe(yo)}`)
      .send({ chatId: String(chatId) });

    expect(pedidos[0]?.prompt).toContain('Llevo arroz con pato');
    expect(pedidos[0]?.prompt).not.toContain('secreto.jpg');
    expect(pedidos[0]?.prompt).not.toContain('/files/');
  });

  /** Sin mensajes nuevos no se paga una llamada para no decir nada. */
  it('sin nada nuevo contesta sin llamar al modelo', async () => {
    await ReceiptModel.create({ chatId, userId: yo, readSeq: 3, deliveredSeq: 3 });

    const respuesta = await request(app)
      .post('/api/assistant/catch-up')
      .set('Authorization', `Bearer ${jwtDe(yo)}`)
      .send({ chatId: String(chatId) });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.messageCount).toBe(0);
    expect(pedidos).toHaveLength(0);
  });

  it('sin sesión, 401', async () => {
    const respuesta = await request(app)
      .post('/api/assistant/catch-up')
      .send({ chatId: String(chatId) });

    expect(respuesta.status).toBe(401);
  });
});

describe('POST /api/assistant/event-draft', () => {
  it('devuelve un BORRADOR, no crea el evento', async () => {
    setAssistantClient(
      clienteFalso(JSON.stringify({ title: 'Cena', startsAt: '2026-08-30T23:00:00Z' }))
    );

    const respuesta = await request(app)
      .post('/api/assistant/event-draft')
      .set('Authorization', `Bearer ${jwtDe(yo)}`)
      .send({ chatId: String(chatId), text: 'cena el sábado a las 6' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.draft.title).toBe('Cena');
    // Nada creado: una frase mal entendida no puede invitar a toda la familia.
    const { EventModel } = await import('./eventModels.js');
    expect(await EventModel.countDocuments({})).toBe(0);
  });

  it('si el modelo no devuelve un evento usable, lo dice sin romperse', async () => {
    setAssistantClient(clienteFalso('no entendí'));

    const respuesta = await request(app)
      .post('/api/assistant/event-draft')
      .set('Authorization', `Bearer ${jwtDe(yo)}`)
      .send({ chatId: String(chatId), text: 'algo' });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.message).toMatch(/fecha/i);
  });

  it('un extraño tampoco puede', async () => {
    const respuesta = await request(app)
      .post('/api/assistant/event-draft')
      .set('Authorization', `Bearer ${jwtDe(extraño)}`)
      .send({ chatId: String(chatId), text: 'cena el sábado' });

    expect(respuesta.status).toBe(403);
    expect(pedidos).toHaveLength(0);
  });
});
