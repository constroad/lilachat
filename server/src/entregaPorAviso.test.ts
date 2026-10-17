import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { ChatModel, ReceiptModel } from './chatModels.js';
import { UserModel } from './models.js';
import { verifySession } from './sessions.js';
import { configurarEntrega, confirmarEntregaDesdeAviso, firmarEntrega, verificarEntrega } from './entregaPorAviso.js';

/**
 * El teléfono confirma la entrega desde el servicio de push, con la app
 * cerrada (FL8.2): no tiene el JWT a mano, así que usa el token que trajo el
 * push. Con eso aparece el doble check gris del otro lado.
 */
let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let wilson: Types.ObjectId;
let chatId: string;
const emitidos: { a: string; frame: object }[] = [];

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  emitidos.length = 0;
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), ReceiptModel.deleteMany({})]);
  jose = (await UserModel.create({ phone: '902049935', name: 'José' }))._id;
  wilson = (await UserModel.create({ phone: '999999999', name: 'Wilson' }))._id;
  chatId = String((await ChatModel.create({ kind: 'direct', members: [{ userId: jose }, { userId: wilson }], lastSeq: 5 }))._id);
  configurarEntrega((a, frame) => void emitidos.push({ a, frame }));
});

describe('token de entrega', () => {
  it('ida y vuelta, y no sirve como sesión', () => {
    const token = firmarEntrega({ chatId, userId: String(wilson), seq: 5 });

    expect(verificarEntrega(token)).toEqual({ chatId, userId: String(wilson), seq: 5 });
    expect(verifySession(token)).toBeNull();
    expect(verificarEntrega('basura')).toBeNull();
  });
});

describe('confirmarEntregaDesdeAviso', () => {
  it('marca entregado y le avisa a todos los del chat (el doble check gris)', async () => {
    expect(await confirmarEntregaDesdeAviso(firmarEntrega({ chatId, userId: String(wilson), seq: 5 }))).toBe(true);

    const acuse = await ReceiptModel.findOne({ chatId, userId: wilson }).lean();
    expect(acuse?.deliveredSeq).toBe(5);
    expect(acuse?.readSeq ?? 0).toBe(0);
    expect(emitidos.map((e) => e.a).sort()).toEqual([String(jose), String(wilson)].sort());
    expect(emitidos[0]?.frame).toEqual({ chatId, userId: String(wilson), deliveredSeq: 5 });
  });

  it('un push viejo que llega tarde no baja el acuse', async () => {
    await ReceiptModel.create({ chatId, userId: wilson, deliveredSeq: 9, readSeq: 0 });

    await confirmarEntregaDesdeAviso(firmarEntrega({ chatId, userId: String(wilson), seq: 5 }));

    expect((await ReceiptModel.findOne({ chatId, userId: wilson }).lean())?.deliveredSeq).toBe(9);
  });

  it('de alguien que ya no es del chat: no hace nada', async () => {
    const extraño = String(new Types.ObjectId());

    expect(await confirmarEntregaDesdeAviso(firmarEntrega({ chatId, userId: extraño, seq: 5 }))).toBe(false);
    expect(emitidos).toHaveLength(0);
  });
});

describe('POST /api/push/entregado', () => {
  it('sin sesión, con el token del push: 204; con uno roto: 400', async () => {
    const app = buildApp();

    await request(app).post('/api/push/entregado').send({ token: firmarEntrega({ chatId, userId: String(wilson), seq: 5 }) }).expect(204);
    await request(app).post('/api/push/entregado').send({ token: 'x' }).expect(400);
  });
});
