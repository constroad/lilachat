import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from './testMongo.js';
import mongoose, { Types } from 'mongoose';
import { alContestar, alOfrecer, alTerminar, configurarCiclo, rechazarDesdeAviso } from './cicloDeLlamada.js';
import { __reiniciarLlamadas, firmarRechazo, sigueSonando } from './llamadas.js';
import { ChatModel, MessageModel, type Message } from './chatModels.js';
import { UserModel } from './models.js';

/**
 * El ciclo de una llamada en el server (FL8.1): suena, vence o la contestan,
 * termina, y deja su línea en el chat UNA vez. También el rechazo desde la
 * notificación, con la app cerrada.
 */
let mongo: MongoMemoryServer;
let ana: string;
let jose: string;
let chatId: string;
const emitidos: { a: string; evento: string; frame: object }[] = [];
const publicados: Message[] = [];
const sinPush: Message[] = [];
const fines: { chatId: string; from: string }[] = [];
const timbres: string[] = [];
let pendiente: (() => Promise<void>) | null = null;
let reloj = 1_000_000;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  __reiniciarLlamadas();
  emitidos.length = 0;
  publicados.length = 0;
  sinPush.length = 0;
  fines.length = 0;
  timbres.length = 0;
  pendiente = null;
  reloj = 1_000_000;
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  ana = String((await UserModel.create({ phone: '999999999', name: 'Ana' }))._id);
  jose = String((await UserModel.create({ phone: '902049935', name: 'José' }))._id);
  chatId = String(
    (await ChatModel.create({ kind: 'direct', members: [{ userId: ana }, { userId: jose }], lastSeq: 0 }))._id
  );
  configurarCiclo({
    emitirA: (a, evento, frame) => void emitidos.push({ a, evento, frame }),
    publicar: async (mensaje) => void publicados.push(mensaje),
    avisarSinPush: async (mensaje) => void sinPush.push(mensaje),
    avisarFin: async (params) => void fines.push({ chatId: params.chatId, from: params.from }),
    avisarLlamada: async (params) => void timbres.push(params.chatId),
    ahora: () => reloj,
    programar: (tarea) => void (pendiente = tarea),
  });
});

const ofrecer = (video = false) => alOfrecer({ chatId, from: ana, members: [ana, jose], video, frame: { chatId } });
const lineas = () => MessageModel.find({ chatId, kind: 'system' }).lean();

describe('cicloDeLlamada', () => {
  it('nadie contesta: al vencer el timbre deja «perdida» con push y apaga los teléfonos', async () => {
    ofrecer();
    expect(timbres).toEqual([chatId]);

    reloj += 31_000;
    await pendiente!();

    const [linea] = await lineas();
    expect(linea?.system).toMatchObject({ evento: 'llamada', valor: 'voz:perdida' });
    expect(linea?.body).toBe('Llamada perdida de Ana');
    expect(String(linea?.senderId)).toBe(ana);
    expect(publicados).toHaveLength(1);
    expect(fines).toEqual([{ chatId, from: ana }]);
  });

  it('contestada: apaga los demás teléfonos al contestar y al colgar deja la duración, sin push', async () => {
    ofrecer(true);
    reloj += 4_000;
    await alContestar(chatId);
    expect(fines).toHaveLength(1);

    reloj += 133_000;
    await alTerminar(chatId);

    const [linea] = await lineas();
    expect(linea?.system?.valor).toBe('video:133');
    expect(sinPush).toHaveLength(1);
    expect(publicados).toHaveLength(0);
  });

  it('los dos cuelgan: una sola línea', async () => {
    ofrecer();
    await alTerminar(chatId);
    await alTerminar(chatId);

    expect(await lineas()).toHaveLength(1);
  });

  it('el timbre que vence después de contestada no hace nada', async () => {
    ofrecer();
    await alContestar(chatId);
    reloj += 31_000;
    await pendiente!();

    expect(await lineas()).toHaveLength(0);
  });

  it('rechazar desde la notificación: le corta a quien llamó y queda perdida', async () => {
    ofrecer();

    const resultado = await rechazarDesdeAviso(firmarRechazo({ chatId, userId: jose }));

    expect(resultado).toBe(true);
    expect(emitidos).toEqual([{ a: ana, evento: 'call.end', frame: { chatId, motivo: 'rechazada', from: jose } }]);
    expect(sigueSonando(chatId, reloj)).toBe(false);
    expect((await lineas())[0]?.system?.valor).toBe('voz:perdida');
  });

  it('un token roto o de alguien que no es del chat no hace nada', async () => {
    ofrecer();
    const extraño = String(new Types.ObjectId());

    expect(await rechazarDesdeAviso('basura')).toBe(false);
    expect(await rechazarDesdeAviso(firmarRechazo({ chatId, userId: extraño }))).toBe(false);
    expect(emitidos).toHaveLength(0);
    expect(sigueSonando(chatId, reloj)).toBe(true);
  });

  it('en un chat secreto no se escribe la línea, pero igual se apagan los teléfonos', async () => {
    await ChatModel.updateOne({ _id: chatId }, { $set: { encrypted: true } });
    ofrecer();

    await alTerminar(chatId);

    expect(await lineas()).toHaveLength(0);
    expect(fines).toHaveLength(1);
  });
});
