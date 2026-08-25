import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { io as connect, type Socket } from 'socket.io-client';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { ChatModel } from '../src/chatModels.js';
import { signSession } from '../src/sessions.js';
import { attachSocket } from '../src/socket.js';

/**
 * La señalización de llamadas (F10), con DOS clientes de socket reales.
 *
 * Es la parte de las llamadas que vive en nuestro código: el audio y el video
 * los lleva WebRTC directo entre los dos teléfonos, pero para llegar a
 * conocerse necesitan que alguien les pase la oferta, la respuesta y los
 * candidatos. Ese cartero es el server, y lo que importa es a QUIÉN le entrega.
 */
let mongo: MongoMemoryServer;
let httpServer: Server;
let url: string;

const ana = new Types.ObjectId();
const beto = new Types.ObjectId();
const extraño = new Types.ObjectId();
const tokenDe = (id: Types.ObjectId) =>
  signSession({ userId: String(id), deviceId: `d-${id}`, email: 'x' });

let chatId: string;
const abiertos: Socket[] = [];

const abrir = (id: Types.ObjectId): Promise<Socket> =>
  new Promise((resolve, reject) => {
    const socket = connect(url, { auth: { token: tokenDe(id) }, transports: ['websocket'] });
    abiertos.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });

const esperar = (socket: Socket, evento: string, ms = 2500): Promise<unknown | null> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    socket.once(evento, (data: unknown) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_calls_test'));

  httpServer = createServer(buildApp());
  attachSocket(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const address = httpServer.address();
  url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(async () => {
  for (const socket of abiertos) socket.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await ChatModel.deleteMany({});
  const chat = await ChatModel.create({
    kind: 'direct',
    lastSeq: 0,
    members: [{ userId: ana }, { userId: beto }],
  });
  chatId = String(chat._id);
});

describe('señalización de llamadas', () => {
  it('la oferta de Ana le llega a Beto, con quién llama', async () => {
    const [socketAna, socketBeto] = await Promise.all([abrir(ana), abrir(beto)]);
    const recibido = esperar(socketBeto, 'call.offer');

    socketAna.emit('call.offer', { chatId, sdp: 'v=0 oferta', video: false });

    expect(await recibido).toMatchObject({ sdp: 'v=0 oferta', from: String(ana) });
  });

  /**
   * A MÍ NO. Si la oferta volviera al que llama, el teléfono se llamaría a sí
   * mismo — y con varios dispositivos sonarían todos los propios.
   */
  it('quien llama NO recibe su propia oferta', async () => {
    const socketAna = await abrir(ana);
    const propia = esperar(socketAna, 'call.offer', 1200);

    socketAna.emit('call.offer', { chatId, sdp: 'v=0 oferta' });

    expect(await propia).toBeNull();
  });

  /**
   * LA prueba de permiso: un extraño con sesión válida no puede hacer sonar el
   * teléfono de nadie. Sin esto, cualquiera con cuenta llama a cualquiera.
   */
  it('un extraño no puede hacer sonar un chat ajeno', async () => {
    const [socketExtraño, socketBeto] = await Promise.all([abrir(extraño), abrir(beto)]);
    const recibido = esperar(socketBeto, 'call.offer', 1500);

    socketExtraño.emit('call.offer', { chatId, sdp: 'v=0 intruso' });

    expect(await recibido).toBeNull();
  });

  it('la respuesta y los candidatos ICE viajan en los dos sentidos', async () => {
    const [socketAna, socketBeto] = await Promise.all([abrir(ana), abrir(beto)]);

    const respuesta = esperar(socketAna, 'call.answer');
    socketBeto.emit('call.answer', { chatId, sdp: 'v=0 respuesta' });
    expect(await respuesta).toMatchObject({ sdp: 'v=0 respuesta', from: String(beto) });

    const candidato = esperar(socketBeto, 'call.ice');
    socketAna.emit('call.ice', { chatId, candidate: 'candidate:1 udp' });
    expect(await candidato).toMatchObject({ candidate: 'candidate:1 udp' });
  });

  it('colgar le llega al otro', async () => {
    const [socketAna, socketBeto] = await Promise.all([abrir(ana), abrir(beto)]);
    const fin = esperar(socketBeto, 'call.end');

    socketAna.emit('call.end', { chatId, motivo: 'colgada' });

    expect(await fin).toMatchObject({ motivo: 'colgada', from: String(ana) });
  });

  /** Un chat inventado no tumba la conexión ni entrega nada. */
  it('un chatId inválido se ignora en silencio', async () => {
    const [socketAna, socketBeto] = await Promise.all([abrir(ana), abrir(beto)]);
    const recibido = esperar(socketBeto, 'call.offer', 1200);

    socketAna.emit('call.offer', { chatId: 'no-es-un-id', sdp: 'x' });

    expect(await recibido).toBeNull();
    expect(socketAna.connected).toBe(true);
  });
});

describe('GET /api/calls/ice', () => {
  it('entrega los servidores ICE del usuario', async () => {
    const respuesta = await request(buildApp())
      .get('/api/calls/ice')
      .set('Authorization', `Bearer ${tokenDe(ana)}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.iceServers[0].urls).toContain('stun:');
  });

  it('sin sesión, 401', async () => {
    expect((await request(buildApp()).get('/api/calls/ice')).status).toBe(401);
  });
});
