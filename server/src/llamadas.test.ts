import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { CALL_TIMEOUT_MS } from '@lilachat/shared';
import { __reiniciarLlamadas, frameConAutor, guardarOferta, limpiarOferta, ofertasVigentes } from './llamadas.js';
import { avisarLlamada, setPushSender } from './pushService.js';
import { DeviceModel, UserModel } from './models.js';
import { __resetPresence, markOnline } from './presence.js';
import type { PushMessage } from './pushSender.js';

/**
 * La llamada suena fuera del chat (FL8; auditoría 17/10/2026: solo sonaba si el
 * otro tenía ESE chat abierto — la señal se reenviaba a los sockets de ese
 * instante y nada más).
 */
describe('ofertas pendientes', () => {
  beforeEach(() => __reiniciarLlamadas());
  const chatA = '6a90cf90d2dbc98541f59dd0';
  const ahora = 1_000_000;

  it('quien conecta mientras suena recibe la oferta', () => {
    guardarOferta(chatA, { chatId: chatA, video: false, from: 'ana' }, 'ana', ahora);

    expect(ofertasVigentes([chatA], 'jose', ahora + 5_000)).toEqual([{ chatId: chatA, video: false, from: 'ana' }]);
  });

  it('a quien llama no se le devuelve su propia oferta', () => {
    guardarOferta(chatA, { chatId: chatA, from: 'ana' }, 'ana', ahora);

    expect(ofertasVigentes([chatA], 'ana', ahora)).toEqual([]);
  });

  it('pasado el tiempo de timbre ya no se entrega', () => {
    guardarOferta(chatA, { chatId: chatA, from: 'ana' }, 'ana', ahora);

    expect(ofertasVigentes([chatA], 'jose', ahora + CALL_TIMEOUT_MS + 1)).toEqual([]);
  });

  it('contestar, colgar o rechazar la borran', () => {
    guardarOferta(chatA, { chatId: chatA, from: 'ana' }, 'ana', ahora);
    limpiarOferta(chatA);

    expect(ofertasVigentes([chatA], 'jose', ahora)).toEqual([]);
  });

  it('solo las de MIS chats', () => {
    guardarOferta(chatA, { chatId: chatA, from: 'ana' }, 'ana', ahora);

    expect(ofertasVigentes(['otro-chat'], 'jose', ahora)).toEqual([]);
  });
});

describe('avisarLlamada', () => {
  let mongo: MongoMemoryServer;
  const enviados: PushMessage[] = [];

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    enviados.length = 0;
    __resetPresence();
    setPushSender({ send: async (mensaje) => void enviados.push(mensaje) });
    await Promise.all([UserModel.deleteMany({}), DeviceModel.deleteMany({})]);
  });

  it('push «Llamada de …» a los miembros DESCONECTADOS, con tipo llamada', async () => {
    const ana = (await UserModel.create({ phone: '51999999999', name: 'Ana' }))._id;
    const jose = (await UserModel.create({ phone: '51902049935', name: 'José' }))._id;
    const luis = (await UserModel.create({ phone: '51988888888', name: 'Luis' }))._id;
    await DeviceModel.create([
      { deviceId: 'dj', userId: jose, platform: 'android', pushToken: 'tok-jose' },
      { deviceId: 'dl', userId: luis, platform: 'android', pushToken: 'tok-luis' },
      { deviceId: 'da', userId: ana, platform: 'android', pushToken: 'tok-ana' },
    ]);
    markOnline(String(luis));
    const chatId = String(new Types.ObjectId());

    await avisarLlamada({ chatId, from: String(ana), members: [String(ana), String(jose), String(luis)], video: true });

    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toMatchObject({ tokens: ['tok-jose'], title: 'Videollamada de Ana', data: { chatId, seq: 0, tipo: 'llamada' } });
  });

  it('la oferta lleva nombre y teléfono de quien llama (la app puede no tener el chat cargado)', async () => {
    const ana = (await UserModel.create({ phone: '999999999', name: 'Ana' }))._id;

    const frame = await frameConAutor('call.offer', { chatId: 'c1', video: false }, String(ana));

    expect(frame).toEqual({ chatId: 'c1', video: false, from: String(ana), fromName: 'Ana', fromPhone: '999999999' });
  });

  it('el resto de las señales solo lleva el autor, sin consultar la base', async () => {
    const frame = await frameConAutor('call.ice', { chatId: 'c1' }, String(new Types.ObjectId()));

    expect(Object.keys(frame).sort()).toEqual(['chatId', 'from']);
  });

  it('sin nadie desconectado no manda nada', async () => {
    const ana = (await UserModel.create({ phone: '51999999999', name: 'Ana' }))._id;

    await avisarLlamada({ chatId: String(new Types.ObjectId()), from: String(ana), members: [String(ana)], video: false });

    expect(enviados).toHaveLength(0);
  });
});
