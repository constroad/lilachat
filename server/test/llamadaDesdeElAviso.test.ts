import { createServer, type Server as HttpServer } from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ChatModel } from '../src/chatModels.js';
import { __reiniciarLlamadas } from '../src/llamadas.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';
import { attachSocket } from '../src/socket.js';

/**
 * FL11 (José y Wilson, 18/10): contestar desde la notificación nunca conectaba.
 * Quien llama manda la oferta y sus candidatos ICE mientras el otro teléfono no
 * tiene socket; al tocar «Contestar» la app conecta y el server le repetía la
 * oferta, pero no los candidatos.
 */
let mongo: MongoMemoryServer;
let httpServer: HttpServer;
let port: number;
const abiertos: ClientSocket[] = [];

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_llamada_aviso_test'));
  httpServer = createServer(buildApp());
  attachSocket(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as { port: number }).port;
});

afterAll(async () => {
  for (const socket of abiertos) socket.disconnect();
  __reiniciarLlamadas();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await new Promise((resolve) => setTimeout(resolve, 300));
  await mongoose.disconnect();
  await mongo.stop();
});

function conectar(userId: string, alRecibir?: (evento: string, frame: { candidate?: { candidate: string } }) => void): Promise<ClientSocket> {
  const token = signSession({ userId, deviceId: `d-${userId}`, email: 'x@x.com' });
  const socket = createClient(`http://127.0.0.1:${port}`, { auth: { token }, transports: ['websocket'], reconnection: false });
  abiertos.push(socket);
  if (alRecibir) socket.onAny((evento: string, frame) => alRecibir(evento, frame));
  return new Promise((listo) => socket.on('connect', () => listo(socket)));
}

describe('llamada contestada desde la notificación', () => {
  it('quien conecta tarde recibe la oferta y DESPUÉS los candidatos de quien llama', async () => {
    const [ana, jose] = await UserModel.create([{ phone: '900000081', name: 'Ana' }, { phone: '900000082', name: 'José' }]);
    const chat = await ChatModel.create({ kind: 'direct', members: [{ userId: ana._id }, { userId: jose._id }], lastSeq: 0 });
    const chatId = String(chat._id);
    const deAna = await conectar(String(ana._id));

    deAna.emit('call.offer', { chatId, video: false, sdp: { type: 'offer', sdp: 'v=0' } });
    await new Promise((listo) => setTimeout(listo, 150));
    deAna.emit('call.ice', { chatId, candidate: { candidate: 'relay-1', sdpMid: '0', sdpMLineIndex: 0 } });
    deAna.emit('call.ice', { chatId, candidate: { candidate: 'srflx-2', sdpMid: '0', sdpMLineIndex: 0 } });
    await new Promise((listo) => setTimeout(listo, 150));

    const recibidos: string[] = [];
    await conectar(String(jose._id), (evento, frame) => {
      if (evento === 'call.offer') recibidos.push('oferta');
      if (evento === 'call.ice') recibidos.push(frame.candidate?.candidate ?? '?');
    });
    await new Promise((listo) => setTimeout(listo, 500));

    expect(recibidos).toEqual(['oferta', 'relay-1', 'srflx-2']);
  });

  /**
   * Con el otro conectado, las señales salen en el orden en que llegaron. La
   * oferta consulta la base (el nombre de quien llama) y un candidato no: sin
   * orden, el candidato le ganaba a su oferta y el que recibe lo descartaba,
   * porque todavía no sabía de qué llamada era.
   */
  it('en vivo, la oferta sale antes que sus candidatos aunque lleguen pegados', async () => {
    const [ana, jose] = await UserModel.create([{ phone: '900000083', name: 'Ana' }, { phone: '900000084', name: 'José' }]);
    const chat = await ChatModel.create({ kind: 'direct', members: [{ userId: ana._id }, { userId: jose._id }], lastSeq: 0 });
    const chatId = String(chat._id);
    const recibidos: string[] = [];
    await conectar(String(jose._id), (evento, frame) => {
      if (evento === 'call.offer') recibidos.push('oferta');
      if (evento === 'call.ice') recibidos.push(frame.candidate?.candidate ?? '?');
    });
    const deAna = await conectar(String(ana._id));
    await new Promise((listo) => setTimeout(listo, 200));

    deAna.emit('call.offer', { chatId, video: false, sdp: { type: 'offer', sdp: 'v=0' } });
    deAna.emit('call.ice', { chatId, candidate: { candidate: 'host-1', sdpMid: '0', sdpMLineIndex: 0 } });
    deAna.emit('call.ice', { chatId, candidate: { candidate: 'host-2', sdpMid: '0', sdpMLineIndex: 0 } });
    await new Promise((listo) => setTimeout(listo, 500));

    expect(recibidos).toEqual(['oferta', 'host-1', 'host-2']);
  });
});
