import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestMongo } from '../src/testMongo.js';
import { buildApp } from '../src/app.js';
import { ChatModel } from '../src/chatModels.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';
import { __resetPresence, markOnline } from '../src/presence.js';
import { __resetPresenceModes, presenceSnapshot, rememberPresencePrefs } from '../src/presenceModes.js';
import { ultimaVezDeContacto } from '../src/ultimaVez.js';

/** Pending 15 (José, 20/10): online, away, busy or invisible, and who sees «últ. vez». */
const app = buildApp({});
let mongo: MongoMemoryServer;
const me = new Types.ObjectId();
const ana = new Types.ObjectId();
const auth = () => ({ Authorization: `Bearer ${signSession({ userId: String(me), deviceId: 'd-me', email: 'x' })}` });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_presence_mode'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  __resetPresence();
  __resetPresenceModes();
  await Promise.all([ChatModel.deleteMany({}), UserModel.deleteMany({})]);
  await UserModel.create([{ _id: me, phone: '900000001' }, { _id: ana, phone: '900000002', lastSeenAt: new Date('2026-10-22T15:00:00.000Z') }]);
  await ChatModel.create({ kind: 'direct', members: [{ userId: me, role: 'member' }, { userId: ana, role: 'member' }], lastSeq: 0 });
});

describe('/api/me/presence', () => {
  it('starts as «En línea» with the last seen shown, and saves a change', async () => {
    // Arrange
    const first = await request(app).get('/api/me/presence').set(auth()).expect(200);
    // Act
    const saved = await request(app).put('/api/me/presence').set(auth()).send({ mode: 'busy', lastSeenHidden: true }).expect(200);
    const again = await request(app).get('/api/me/presence').set(auth()).expect(200);
    // Assert
    expect(first.body).toEqual({ mode: 'auto', lastSeenHidden: false });
    expect(saved.body).toEqual({ mode: 'busy', lastSeenHidden: true });
    expect(again.body).toEqual({ mode: 'busy', lastSeenHidden: true });
  });

  it('refuses a mode that does not exist', async () => {
    const { body } = await request(app).put('/api/me/presence').set(auth()).send({ mode: 'offline' }).expect(400);
    expect(body.message).toBe('Elige En línea, Ausente, Ocupado o Invisible.');
  });
});

describe('what the others see', () => {
  it('the snapshot leaves out someone invisible and tells away or busy', () => {
    const [busy, hidden, plain] = ['u-busy', 'u-hidden', 'u-plain'];
    for (const id of [busy, hidden, plain]) markOnline(id);
    rememberPresencePrefs(busy, { mode: 'busy', lastSeenHidden: false });
    rememberPresencePrefs(hidden, { mode: 'invisible', lastSeenHidden: false });
    expect(presenceSnapshot([busy, hidden, plain, 'u-offline'])).toEqual({ online: [busy, plain], statuses: { [busy]: 'busy' } });
  });

  it('«últ. vez» hidden by its owner is not told', async () => {
    await UserModel.updateOne({ _id: ana }, { $set: { lastSeenHidden: true } });
    expect(await ultimaVezDeContacto(String(me), String(ana))).toBeNull();
  });

  it('someone invisible while online shows the last seen they had, not «online» by its absence', async () => {
    markOnline(String(ana));
    await UserModel.updateOne({ _id: ana }, { $set: { presenceMode: 'invisible' } });
    expect(await ultimaVezDeContacto(String(me), String(ana))).toBe('2026-10-22T15:00:00.000Z');
  });
});
