import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { DeviceModel, UserModel } from './models.js';
import { buildApp } from './app.js';
import { signSession } from './sessions.js';

/** The web's install strip (José 05/11): whoever already has the APK is not offered it. */
let mongo: MongoMemoryServer;
let me: Types.ObjectId;
let ana: Types.ObjectId;
const app = buildApp();
const auth = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'jose@test.pe' })}` });
const answerFor = async (userId: Types.ObjectId) => (await request(app).get('/api/me/android-app').set(auth(userId)).expect(200)).body;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_android_app_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), DeviceModel.deleteMany({})]);
  me = (await UserModel.create({ phone: '902049935', name: 'José' }))._id;
  ana = (await UserModel.create({ phone: '987654321', name: 'Ana' }))._id;
});

describe('GET /api/me/android-app', () => {
  it('says yes when the phone registered its push token', async () => {
    await DeviceModel.create({ deviceId: 'apk', userId: me, platform: 'android', pushToken: 'fcm-token' });

    expect(await answerFor(me)).toEqual({ hasAndroidApp: true });
  });

  it('says no for a web session: `platform` defaults to android on every sign-in', async () => {
    await DeviceModel.findOneAndUpdate({ deviceId: 'web' }, { deviceId: 'web', userId: me, lastSeenAt: new Date() }, { upsert: true });

    expect(await answerFor(me)).toEqual({ hasAndroidApp: false });
  });

  it('says no for a browser with web push', async () => {
    await DeviceModel.create({ deviceId: 'web', userId: me, platform: 'web', pushToken: '{"endpoint":"https://push.example"}' });

    expect(await answerFor(me)).toEqual({ hasAndroidApp: false });
  });

  it('does not count someone else\'s phone', async () => {
    await DeviceModel.create({ deviceId: 'apk', userId: ana, platform: 'android', pushToken: 'fcm-token' });

    expect(await answerFor(me)).toEqual({ hasAndroidApp: false });
  });

  it('asks for a session', async () => {
    await request(app).get('/api/me/android-app').expect(401);
  });
});
