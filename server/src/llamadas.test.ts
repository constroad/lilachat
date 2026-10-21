import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from './testMongo.js';
import mongoose, { Types } from 'mongoose';
import { CALL_TIMEOUT_MS, CAPACIDAD_LLAMADA_NATIVA } from '@lilachat/shared';
import {
  __reiniciarLlamadas,
  candidatosDeLaOferta,
  firmarRechazo,
  frameConAutor,
  guardarCandidato,
  guardarOferta,
  limpiarOferta,
  marcarContestada,
  ofertasVigentes,
  sigueSonando,
  terminarLlamada,
  verificarRechazo,
} from './llamadas.js';
import { verifySession } from './sessions.js';
import { avisarFinDeLlamada, avisarLlamada, setPushSender } from './pushService.js';
import { DeviceModel, UserModel } from './models.js';
import { __resetPresence, markOnline } from './presence.js';
import type { PushDeDatos, PushMessage } from './pushSender.js';

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

    // Con lo que le QUEDA de timbre: el teléfono que conecta tarde no arranca
    // otros 30 s (el server ya la habría dado por perdida mientras contestan).
    expect(ofertasVigentes([chatA], 'jose', ahora + 5_000)).toEqual([{ chatId: chatA, video: false, from: 'ana', quedaMs: CALL_TIMEOUT_MS - 5_000 }]);
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

/**
 * Lo que la llamada deja en el chat (FL8.1): el server sabe cuándo sonó, si la
 * contestaron y cuándo terminó, así que la línea la escribe él una sola vez.
 */
/**
 * FL11 (José y Wilson, 18/10, teléfonos reales): contestar desde la
 * notificación quedaba en «Conectando…» para siempre. La oferta se repetía al
 * conectar, pero los candidatos ICE de quien llama no: los mandó cuando el
 * otro teléfono no tenía socket y se perdieron. Sin ellos el audio no cruza
 * los NAT del celular.
 */
describe('candidatos de la oferta', () => {
  beforeEach(() => __reiniciarLlamadas());
  const chatA = '6a90cf90d2dbc98541f59dd0';
  const hielo = (n: number) => ({ chatId: chatA, from: 'ana', candidate: { candidate: `c${n}`, sdpMid: '0', sdpMLineIndex: 0 } });

  it('los de quien llama se guardan con la oferta, en orden', () => {
    guardarOferta(chatA, { chatId: chatA, from: 'ana' }, 'ana');
    guardarCandidato(chatA, hielo(1), 'ana');
    guardarCandidato(chatA, hielo(2), 'ana');

    expect(candidatosDeLaOferta(chatA)).toEqual([hielo(1), hielo(2)]);
  });

  it('los del otro lado no: quien llama está conectado y le llegan en vivo', () => {
    guardarOferta(chatA, { chatId: chatA, from: 'ana' }, 'ana');
    guardarCandidato(chatA, hielo(1), 'jose');

    expect(candidatosDeLaOferta(chatA)).toEqual([]);
  });

  it('sin oferta sonando no se guarda nada, y al terminar se van con ella', () => {
    guardarCandidato(chatA, hielo(1), 'ana');
    expect(candidatosDeLaOferta(chatA)).toEqual([]);

    guardarOferta(chatA, { chatId: chatA, from: 'ana' }, 'ana');
    guardarCandidato(chatA, hielo(2), 'ana');
    limpiarOferta(chatA);
    expect(candidatosDeLaOferta(chatA)).toEqual([]);
  });

  it('con un tope: una oferta no junta candidatos sin fin', () => {
    guardarOferta(chatA, { chatId: chatA, from: 'ana' }, 'ana');
    for (let n = 0; n < 100; n += 1) guardarCandidato(chatA, hielo(n), 'ana');

    expect(candidatosDeLaOferta(chatA).length).toBeLessThanOrEqual(40);
  });
});

describe('ciclo de la llamada', () => {
  beforeEach(() => __reiniciarLlamadas());
  const chat = '6a90cf90d2dbc98541f59dd1';
  const ahora = 2_000_000;
  const oferta = { video: false, members: ['ana', 'jose'] };

  it('sin contestar: termina como perdida, una sola vez', () => {
    guardarOferta(chat, {}, 'ana', ahora, oferta);

    expect(terminarLlamada(chat, ahora + 10_000)).toEqual({ from: 'ana', video: false, members: ['ana', 'jose'], segundos: null });
    expect(terminarLlamada(chat, ahora + 11_000)).toBeNull();
  });

  it('contestada: deja de sonar y termina con su duración desde que se contestó', () => {
    guardarOferta(chat, {}, 'ana', ahora, { ...oferta, video: true });
    expect(marcarContestada(chat, ahora + 4_000)).toEqual({ from: 'ana', members: ['ana', 'jose'] });

    expect(sigueSonando(chat, ahora + 5_000)).toBe(false);
    expect(ofertasVigentes([chat], 'jose', ahora + 5_000)).toEqual([]);
    expect(terminarLlamada(chat, ahora + 137_900)).toMatchObject({ video: true, segundos: 133 });
  });

  it('contestar algo que ya no suena no hace nada', () => {
    expect(marcarContestada(chat, ahora)).toBeNull();
  });

  it('sigue sonando solo dentro del tiempo de timbre', () => {
    guardarOferta(chat, {}, 'ana', ahora, oferta);

    expect(sigueSonando(chat, ahora + CALL_TIMEOUT_MS - 1)).toBe(true);
    expect(sigueSonando(chat, ahora + CALL_TIMEOUT_MS + 1)).toBe(false);
  });
});

/**
 * Rechazar desde la notificación, con la app cerrada (FL8.1): el teléfono no
 * tiene el JWT a mano, así que el push trae un token corto que solo sirve para
 * rechazar ESA llamada.
 */
describe('token de rechazo', () => {
  it('ida y vuelta: dice qué chat y quién', () => {
    const token = firmarRechazo({ chatId: 'c1', userId: 'jose' });

    expect(verificarRechazo(token)).toEqual({ chatId: 'c1', userId: 'jose' });
  });

  it('NO sirve como sesión, ni una sesión como rechazo', () => {
    const token = firmarRechazo({ chatId: 'c1', userId: 'jose' });

    expect(verifySession(token)).toBeNull();
    expect(verificarRechazo('basura')).toBeNull();
  });

  it('vencido no sirve', () => {
    const token = firmarRechazo({ chatId: 'c1', userId: 'jose' }, -10);

    expect(verificarRechazo(token)).toBeNull();
  });
});

describe('avisarLlamada', () => {
  let mongo: MongoMemoryServer;
  const enviados: PushMessage[] = [];
  const datos: PushDeDatos[] = [];

  beforeAll(async () => {
    mongo = await startTestMongo();
    await mongoose.connect(mongo.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    enviados.length = 0;
    datos.length = 0;
    __resetPresence();
    setPushSender({ send: async (mensaje) => void enviados.push(mensaje), sendDatos: async (mensaje) => void datos.push(mensaje) });
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

  /**
   * FL8.1: el teléfono que sabe dibujar la llamada a pantalla completa recibe
   * un push SOLO-DATOS (lo atiende el servicio nativo con la app cerrada), con
   * vida de 30 s y el token para rechazar sin abrir. El viejo, el de siempre.
   */
  it('con la capacidad nativa: solo-datos, prioridad de llamada, con rechazo; sin ella, el de siempre', async () => {
    const ana = (await UserModel.create({ phone: '999999999', name: 'Ana' }))._id;
    const jose = (await UserModel.create({ phone: '902049935', name: 'José' }))._id;
    await DeviceModel.create([
      { deviceId: 'nuevo', userId: jose, platform: 'android', pushToken: 'tok-nuevo', capacidades: [CAPACIDAD_LLAMADA_NATIVA] },
      { deviceId: 'viejo', userId: jose, platform: 'android', pushToken: 'tok-viejo' },
    ]);
    const chatId = String(new Types.ObjectId());

    await avisarLlamada({ chatId, from: String(ana), members: [String(ana), String(jose)], video: false });

    expect(enviados.map((m) => m.tokens)).toEqual([['tok-viejo']]);
    expect(datos).toHaveLength(1);
    expect(datos[0]).toMatchObject({ tokens: ['tok-nuevo'], ttlSegundos: CALL_TIMEOUT_MS / 1000 });
    expect(datos[0]!.data).toMatchObject({ tipo: 'llamada', chatId, de: String(ana), nombre: 'Ana', telefono: '999999999', video: '0' });
    expect(verificarRechazo(String(datos[0]!.data.rechazo))).toEqual({ chatId, userId: String(jose) });
    // Relativo y no una hora: el reloj del teléfono puede no coincidir.
    expect(datos[0]!.data.queda).toBe(String(CALL_TIMEOUT_MS));
  });

  /**
   * José, 20/10: «al llamar a Wilson con la pantalla apagada no vibró ni sonó;
   * se enteró al desbloquear». «Conectado» es por persona: con la web abierta,
   * o con la app dormida y su socket todavía colgado, NO le llegaba push. Al
   * teléfono nativo le va SIEMPRE (con la app adelante no la dibuja: la trae el
   * socket); a la web o a un teléfono viejo, solo si está desconectado.
   */
  it('al teléfono nativo le suena aunque la persona figure conectada; al viejo, no', async () => {
    const ana = (await UserModel.create({ phone: '999999999', name: 'Ana' }))._id;
    const wilson = (await UserModel.create({ phone: '960397018', name: 'Wilson' }))._id;
    await DeviceModel.create([
      { deviceId: 'w-tel', userId: wilson, platform: 'android', pushToken: 'tok-tel', capacidades: [CAPACIDAD_LLAMADA_NATIVA] },
      { deviceId: 'w-viejo', userId: wilson, platform: 'android', pushToken: 'tok-viejo' },
    ]);
    markOnline(String(wilson));
    const chatId = String(new Types.ObjectId());

    await avisarLlamada({ chatId, from: String(ana), members: [String(ana), String(wilson)], video: false });

    expect(datos.map((d) => d.tokens)).toEqual([['tok-tel']]);
    expect(enviados).toHaveLength(0);
  });

  it('el fin le llega a los teléfonos nativos de todos menos de quien llamó, conectados o no', async () => {
    const ana = (await UserModel.create({ phone: '999999999', name: 'Ana' }))._id;
    const jose = (await UserModel.create({ phone: '902049935', name: 'José' }))._id;
    await DeviceModel.create([
      { deviceId: 'j1', userId: jose, platform: 'android', pushToken: 'tok-j1', capacidades: [CAPACIDAD_LLAMADA_NATIVA] },
      { deviceId: 'j2', userId: jose, platform: 'android', pushToken: 'tok-j2' },
      { deviceId: 'a1', userId: ana, platform: 'android', pushToken: 'tok-a1', capacidades: [CAPACIDAD_LLAMADA_NATIVA] },
    ]);
    markOnline(String(jose));
    const chatId = String(new Types.ObjectId());

    await avisarFinDeLlamada({ chatId, from: String(ana), members: [String(ana), String(jose)] });

    expect(datos).toEqual([{ tokens: ['tok-j1'], ttlSegundos: 60, data: { tipo: 'llamada-fin', chatId } }]);
    expect(enviados).toHaveLength(0);
  });

  it('sin nadie desconectado no manda nada', async () => {
    const ana = (await UserModel.create({ phone: '51999999999', name: 'Ana' }))._id;

    await avisarLlamada({ chatId: String(new Types.ObjectId()), from: String(ana), members: [String(ana)], video: false });

    expect(enviados).toHaveLength(0);
  });
});
