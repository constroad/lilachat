import { createServer, type Server as HttpServer } from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { io as createClient } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { isOnline } from '../src/presence.js';
import { signSession } from '../src/sessions.js';
import { attachSocket } from '../src/socket.js';

/**
 * LA PRESENCIA NO SE PEGA (FL8.1, 17/10/2026). `markOnline` corría DESPUÉS de
 * leer los contactos (un `await`) y `markOffline` podía correr antes: conectar
 * y cortar enseguida —salir rápido de la app, una reconexión que se cae— dejaba
 * el contador en 1 para siempre. Esa persona figuraba «en línea» y no le
 * llegaba ningún push (mensajes ni llamadas) hasta reiniciar el server.

 * El cliente corta apenas conecta: el corte llega mientras el server todavía
 * lee los contactos, que es exactamente la ventana del bug.
 */
let mongo: MongoMemoryServer;
let httpServer: HttpServer;
let port: number;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_presencia_test'));
  httpServer = createServer(buildApp());
  attachSocket(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as { port: number }).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await new Promise((resolve) => setTimeout(resolve, 300));
  await mongoose.disconnect();
  await mongo.stop();
});

describe('presencia con conexiones que se cortan al instante', () => {
  it('conectar y cortar antes de que terminen de leerse los contactos deja a la persona fuera de línea', async () => {
    const userId = String(new Types.ObjectId());
    const token = signSession({ userId, deviceId: 'flap', email: 'flap@x.com' });
    const socket = createClient(`http://127.0.0.1:${port}`, { auth: { token }, transports: ['websocket'], reconnection: false });
    await new Promise<void>((listo) => socket.on('connect', () => listo()));
    socket.disconnect();

    await new Promise((listo) => setTimeout(listo, 600));

    expect(isOnline(userId)).toBe(false);
  });
});
