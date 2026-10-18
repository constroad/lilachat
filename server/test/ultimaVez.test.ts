import { createServer, type Server as HttpServer } from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ChatModel } from '../src/chatModels.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';
import { attachSocket } from '../src/socket.js';

/**
 * «últ. vez» (FL10, auditoría §46.3). Al quedar fuera de línea se guarda
 * cuándo, se avisa a los contactos con la hora, y quien abre el chat la pide.
 * Solo la ve quien comparte un chat: a un desconocido no se le dice nada.
 */
let mongo: MongoMemoryServer;
let httpServer: HttpServer;
let port: number;
const abiertos: ClientSocket[] = [];

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_ultima_vez_test'));
  httpServer = createServer(buildApp());
  attachSocket(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as { port: number }).port;
});

afterAll(async () => {
  for (const socket of abiertos) socket.disconnect();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await new Promise((resolve) => setTimeout(resolve, 300));
  await mongoose.disconnect();
  await mongo.stop();
});

async function conectar(userId: string): Promise<ClientSocket> {
  const token = signSession({ userId, deviceId: `d-${userId}`, email: `${userId}@x.com` });
  const socket = createClient(`http://127.0.0.1:${port}`, { auth: { token }, transports: ['websocket'], reconnection: false });
  abiertos.push(socket);
  await new Promise<void>((listo) => socket.on('connect', () => listo()));
  return socket;
}

async function pedirUltimaVez(socket: ClientSocket, userId: string): Promise<string | null> {
  const respuesta = (await socket.timeout(3000).emitWithAck('presence.ultimaVez', { userId })) as { lastSeenAt: string | null };
  return respuesta.lastSeenAt;
}

describe('últ. vez', () => {
  it('al irse se guarda y se avisa con la hora; quien comparte el chat la pide', async () => {
    const [ana, beto, extrano] = await UserModel.create([{ phone: '900000071' }, { phone: '900000072' }, { phone: '900000073' }]);
    await ChatModel.create({ kind: 'direct', members: [{ userId: ana._id }, { userId: beto._id }], lastSeq: 0 });
    const deAna = await conectar(String(ana._id));
    await new Promise((listo) => setTimeout(listo, 200));
    const deBeto = await conectar(String(beto._id));
    await new Promise((listo) => setTimeout(listo, 200));

    const aviso = new Promise<{ online: boolean; lastSeenAt?: string }>((listo) =>
      deAna.on('presence', (frame: { userId: string; online: boolean; lastSeenAt?: string }) => {
        if (frame.userId === String(beto._id) && !frame.online) listo(frame);
      })
    );
    deBeto.disconnect();
    const recibido = await aviso;
    await new Promise((listo) => setTimeout(listo, 200));

    const guardado = await UserModel.findById(beto._id).lean();
    expect(guardado?.lastSeenAt).toBeInstanceOf(Date);
    expect(recibido.lastSeenAt).toBe(guardado?.lastSeenAt?.toISOString());
    expect(await pedirUltimaVez(deAna, String(beto._id))).toBe(recibido.lastSeenAt);

    const delExtrano = await conectar(String(extrano._id));
    expect(await pedirUltimaVez(delExtrano, String(beto._id))).toBeNull();
  });

  it('de quien está en línea, o con un id inválido, nada', async () => {
    const [carla, dario] = await UserModel.create([{ phone: '900000074' }, { phone: '900000075' }]);
    await ChatModel.create({ kind: 'direct', members: [{ userId: carla._id }, { userId: dario._id }], lastSeq: 0 });
    await UserModel.updateOne({ _id: dario._id }, { $set: { lastSeenAt: new Date('2026-10-18T07:00:00Z') } });
    const deCarla = await conectar(String(carla._id));
    await conectar(String(dario._id));

    expect(await pedirUltimaVez(deCarla, String(dario._id))).toBeNull();
    expect(await pedirUltimaVez(deCarla, 'no-es-un-id')).toBeNull();
  });
});
