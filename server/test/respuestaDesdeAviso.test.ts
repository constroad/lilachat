import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from '../src/testMongo.js';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel, ReceiptModel } from '../src/chatModels.js';
import { firmarEntrega } from '../src/entregaPorAviso.js';
import { UserModel } from '../src/models.js';
import { setPushSender } from '../src/pushService.js';
import { firmarRespuesta, verificarRespuesta } from '../src/respuestaDesdeAviso.js';
import { signSession } from '../src/sessions.js';

/**
 * «Responder» y «Marcar como leído» desde el aviso (FL11, José 18/10: «no hay
 * botón responder directamente»), como WhatsApp, con la app cerrada. La
 * credencial es un token corto del push, de esa persona y ese chat.
 */
let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let wilson: Types.ObjectId;
let ajeno: Types.ObjectId;
let chatId: string;
const app = () => buildApp();

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_respuesta_aviso_test'));
  setPushSender({ send: async () => undefined, sendDatos: async () => undefined });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([ChatModel.deleteMany({}), MessageModel.deleteMany({}), ReceiptModel.deleteMany({}), UserModel.deleteMany({})]);
  const usuarios = await UserModel.create([{ phone: '900000001' }, { phone: '900000002' }, { phone: '900000003' }]);
  [jose, wilson, ajeno] = usuarios.map((u) => u._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  const chat = await ChatModel.create({ kind: 'direct', members: [{ userId: jose }, { userId: wilson }], lastSeq: 3 });
  chatId = String(chat._id);
});

const responder = (cuerpo: Record<string, unknown>) => request(app()).post('/api/push/responder').send(cuerpo);

describe('responder desde el aviso', () => {
  it('crea el mensaje de esa persona en ese chat, y un reintento no lo duplica', async () => {
    const token = firmarRespuesta({ chatId, userId: String(jose) });

    const primera = await responder({ token, texto: '  ya voy  ', clientKey: 'aviso-0001-abcd' });
    const reintento = await responder({ token, texto: 'ya voy', clientKey: 'aviso-0001-abcd' });

    expect(primera.status).toBe(201);
    expect(reintento.status).toBe(201);
    const mensajes = await MessageModel.find({ chatId }).lean();
    expect(mensajes.map((m) => [String(m.senderId), m.body])).toEqual([[String(jose), 'ya voy']]);
  });

  it('un token de otra cosa (entrega) o una sesión no sirven', async () => {
    const entrega = firmarEntrega({ chatId, userId: String(jose), seq: 1 });
    const sesion = signSession({ userId: String(jose), deviceId: 'd', email: 'x' });

    expect((await responder({ token: entrega, texto: 'hola', clientKey: 'aviso-0002-abcd' })).status).toBe(400);
    expect((await responder({ token: sesion, texto: 'hola', clientKey: 'aviso-0003-abcd' })).status).toBe(400);
    expect(verificarRespuesta(entrega)).toBeNull();
  });

  it('sin texto, o sin clave del cliente, no se manda', async () => {
    const token = firmarRespuesta({ chatId, userId: String(jose) });

    expect((await responder({ token, texto: '   ', clientKey: 'aviso-0004-abcd' })).status).toBe(400);
    expect((await responder({ token, texto: 'hola' })).status).toBe(400);
  });

  it('en un chat secreto no: la respuesta saldría sin cifrar', async () => {
    await ChatModel.updateOne({ _id: chatId }, { $set: { encrypted: true } });
    const token = firmarRespuesta({ chatId, userId: String(jose) });

    expect((await responder({ token, texto: 'hola', clientKey: 'aviso-0006-abcd' })).status).toBe(403);
    expect(await MessageModel.countDocuments({ chatId })).toBe(0);
  });

  it('quien ya no es del chat no puede responder', async () => {
    const token = firmarRespuesta({ chatId, userId: String(ajeno) });

    expect((await responder({ token, texto: 'hola', clientKey: 'aviso-0005-abcd' })).status).toBe(403);
  });
});

describe('marcar como leído desde el aviso', () => {
  it('lee el chat hasta el último mensaje', async () => {
    const token = firmarRespuesta({ chatId, userId: String(jose) });

    const respuesta = await request(app()).post('/api/push/leido').send({ token });

    expect(respuesta.status).toBe(204);
    const acuse = await ReceiptModel.findOne({ chatId, userId: jose }).lean();
    expect(acuse?.readSeq).toBe(3);
  });

  it('con un token inválido, 400', async () => {
    expect((await request(app()).post('/api/push/leido').send({ token: 'x' })).status).toBe(400);
  });
});
