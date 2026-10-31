import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { signSession } from './sessions.js';

/** R31/10-B7: «Exportar chat» gives a .txt like WhatsApp's, to a member only. */
let mongo: MongoMemoryServer;
const app = buildApp();
let ana: Types.ObjectId;
let beto: Types.ObjectId;
let carla: Types.ObjectId;
let direct: Types.ObjectId;
const at = (iso: string) => new Date(iso);
const tokenOf = (id: Types.ObjectId, phone: string) => signSession({ userId: String(id), deviceId: `d-${phone}`, email: phone });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  const users = await UserModel.create([
    { phone: '51900000911', name: 'Ana' },
    { phone: '51900000912', name: 'Beto' },
    { phone: '51900000913', name: 'Carla' },
  ]);
  [ana, beto, carla] = users.map((user) => user._id as Types.ObjectId) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  const chat = await ChatModel.create({ kind: 'direct', members: [{ userId: ana, borradoHasta: 1 }, { userId: beto }], lastSeq: 4 });
  direct = chat._id as Types.ObjectId;
  await MessageModel.insertMany([
    { chatId: direct, seq: 1, senderId: ana, clientKey: 'k1', kind: 'text' as const, body: 'vaciado para Ana', at: at('2026-10-01T13:00:00Z') },
    { chatId: direct, seq: 2, senderId: beto, clientKey: 'k2', kind: 'text' as const, body: 'hola', at: at('2026-10-01T14:05:00Z') },
    { chatId: direct, seq: 3, senderId: ana, clientKey: 'k3', kind: 'image' as const, body: 'la losa', at: at('2026-10-01T14:06:00Z') },
    { chatId: direct, seq: 4, senderId: beto, clientKey: 'k4', kind: 'text' as const, body: 'se fue', at: at('2026-10-01T14:07:00Z'), disappearsAt: at('2026-10-01T14:08:00Z') },
  ]);
});

describe('GET /api/chats/:chatId/export', () => {
  it('a member gets the text from what they did not empty, in their zone, named after the other person', async () => {
    // Act
    const response = await request(app).get(`/api/chats/${direct}/export?tz=America/Lima`).set('Authorization', `Bearer ${tokenOf(ana, '51900000911')}`);
    // Assert
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.headers['content-disposition']).toContain(encodeURIComponent('Chat de Lilachat con Beto.txt'));
    expect(response.text).toBe('01/10/2026, 09:05 - Beto: hola\n01/10/2026, 09:06 - Ana: <Foto omitida> la losa\n');
  });

  it('a stranger gets 404 and a secret chat 409', async () => {
    // Arrange
    const secret = await ChatModel.create({ kind: 'direct', encrypted: true, members: [{ userId: ana }, { userId: beto }] });
    // Act
    const stranger = await request(app).get(`/api/chats/${direct}/export`).set('Authorization', `Bearer ${tokenOf(carla, '51900000913')}`);
    const sealed = await request(app).get(`/api/chats/${secret._id}/export`).set('Authorization', `Bearer ${tokenOf(ana, '51900000911')}`);
    // Assert
    expect(stranger.status).toBe(404);
    expect(sealed.status).toBe(409);
  });
});
