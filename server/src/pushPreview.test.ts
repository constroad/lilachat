import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { DeviceModel, UserModel } from './models.js';
import { ChatModel, type Message } from './chatModels.js';
import { notifyOffline, setPushSender } from './pushService.js';
import { __resetPresence } from './presence.js';
import type { PushMessage } from './pushSender.js';
import { signSession } from './sessions.js';
import { HIDDEN_PREVIEW_BODY, previewHiddenFor } from './pushPreview.js';

/** R31/10-B8: «Mostrar vista previa» off hides what a message says in its notice. */
let mongo: MongoMemoryServer;
const app = buildApp();
const sent: PushMessage[] = [];
let ana: Types.ObjectId;
let beto: Types.ObjectId;
let carla: Types.ObjectId;
let group: Types.ObjectId;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  sent.length = 0;
  __resetPresence();
  setPushSender({ send: async (message) => void sent.push(message), sendDatos: async () => undefined });
  await Promise.all([UserModel.deleteMany({}), DeviceModel.deleteMany({}), ChatModel.deleteMany({})]);
  const users = await UserModel.create([
    { phone: '51900000921', name: 'Ana' },
    { phone: '51900000922', name: 'Beto', pushPreviewOff: true },
    { phone: '51900000923', name: 'Carla' },
  ]);
  [ana, beto, carla] = users.map((user) => user._id as Types.ObjectId) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  await DeviceModel.create([
    { userId: beto, deviceId: 'b1', platform: 'android', pushToken: 'tok-beto' },
    { userId: carla, deviceId: 'c1', platform: 'android', pushToken: 'tok-carla' },
  ]);
  group = (await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: ana }, { userId: beto }, { userId: carla }] }))._id as Types.ObjectId;
});

const message = (): Message => ({ chatId: group, seq: 7, senderId: ana, clientKey: 'k7', kind: 'text', body: 'la clave es 1234', at: new Date() }) as Message;

describe('the preview of the notices', () => {
  it('whoever turned it off gets who wrote, not what; the rest get the text', async () => {
    // Act
    await notifyOffline({ message: message(), members: [String(ana), String(beto), String(carla)], senderId: String(ana) });
    // Assert
    const toBeto = sent.find((push) => push.tokens.includes('tok-beto'));
    const toCarla = sent.find((push) => push.tokens.includes('tok-carla'));
    expect(toBeto).toMatchObject({ title: 'Obra · Ana', body: HIDDEN_PREVIEW_BODY });
    expect(toCarla?.body).toContain('la clave es 1234');
  });

  it('reads only the people who turned it off', async () => {
    expect([...(await previewHiddenFor([String(beto), String(carla)]))]).toEqual([String(beto)]);
    expect((await previewHiddenFor([])).size).toBe(0);
  });

  it('GET and PUT /api/me/notification-preview turn it on and off', async () => {
    // Arrange
    const token = signSession({ userId: String(carla), deviceId: 'c1', email: '51900000923' });
    // Act
    const off = await request(app).put('/api/me/notification-preview').set('Authorization', `Bearer ${token}`).send({ on: false });
    const read = await request(app).get('/api/me/notification-preview').set('Authorization', `Bearer ${token}`);
    const wrong = await request(app).put('/api/me/notification-preview').set('Authorization', `Bearer ${token}`).send({ on: 'no' });
    // Assert
    expect(off.body).toEqual({ on: false });
    expect(read.body).toEqual({ on: false });
    expect(wrong.status).toBe(400);
    expect((await UserModel.findById(carla).lean())?.pushPreviewOff).toBe(true);
  });
});
