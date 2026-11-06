import { generateKeyPairSync } from 'node:crypto';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceModel } from '../src/models.js';
import { buildPushSender, type PushSender } from '../src/pushSender.js';
import { createPushTally, outcomeOfReply } from '../src/pushTally.js';
import { registro } from '../src/registro.js';
import { startTestMongo } from '../src/testMongo.js';

const UNREGISTERED_BODY = JSON.stringify({ error: { code: 404, status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } });
const WRONG_PROJECT_BODY = JSON.stringify({ error: { code: 404, status: 'NOT_FOUND', message: 'Requested entity was not found.' } });

describe('outcomeOfReply: what one FCM answer means', () => {
  it('a 200 is accepted', () => {
    expect(outcomeOfReply(200, '{}')).toBe('accepted');
  });

  it('a 404 that says UNREGISTERED is a dead token', () => {
    expect(outcomeOfReply(404, UNREGISTERED_BODY)).toBe('dead');
  });

  it('a 404 for any other reason is an error: a wrong project must not wipe every token', () => {
    expect(outcomeOfReply(404, WRONG_PROJECT_BODY)).toBe('failed');
  });

  it('a 500 is an error', () => {
    expect(outcomeOfReply(500, '')).toBe('failed');
  });
});

describe('createPushTally: one line an hour', () => {
  const HOUR_MS = 3_600_000;

  it('writes nothing inside the hour', () => {
    const lines: string[] = [];
    const count = createPushTally((line) => lines.push(line), () => 0);
    count('accepted');
    count('dead');
    expect(lines).toEqual([]);
  });

  it('after the hour writes what it counted and starts over', () => {
    const lines: string[] = [];
    let clock = 0;
    const count = createPushTally((line) => lines.push(line), () => clock);
    count('accepted');
    count('accepted');
    count('dead');
    clock = HOUR_MS;
    count('failed');
    clock = HOUR_MS + 1;
    count('accepted');
    expect(lines).toEqual(['[push] FCM en la última hora: 2 aceptados, 1 vencidos, 1 con error']);
  });
});

describe('the FCM sender', () => {
  const DEAD_TOKEN = 'token-of-a-phone-that-rotated';
  const LIVE_TOKEN = 'token-of-a-live-phone';
  let mongo: MongoMemoryServer;
  let sender: PushSender;
  let replyTo: (token: string) => Promise<Response>;
  let errors: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    mongo = await startTestMongo();
    await mongoose.connect(mongo.getUri('lilachat_push_sender_test'));
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
    vi.stubEnv('FCM_SERVICE_ACCOUNT', JSON.stringify({ project_id: 'qa-project', client_email: 'qa@example.test', private_key: privateKey }));
    sender = buildPushSender();
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await DeviceModel.deleteMany({});
    await DeviceModel.create([
      { deviceId: 'dead-phone', userId: new mongoose.Types.ObjectId(), pushToken: DEAD_TOKEN },
      { deviceId: 'dead-phone-old-row', userId: new mongoose.Types.ObjectId(), pushToken: DEAD_TOKEN },
      { deviceId: 'live-phone', userId: new mongoose.Types.ObjectId(), pushToken: LIVE_TOKEN },
    ]);
    errors = vi.spyOn(registro, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', async (url: string, init: { body?: unknown }) => {
      if (url.includes('oauth2')) return new Response(JSON.stringify({ access_token: 'qa-access', expires_in: 3600 }));
      return replyTo((JSON.parse(String(init.body)) as { message: { token: string } }).message.token);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const storedTokens = async () => (await DeviceModel.find({ pushToken: { $exists: true } }).select('deviceId').lean()).map((device) => device.deviceId).sort();

  it('forgets a dead token on every row that holds it and keeps the others', async () => {
    replyTo = async (token) => (token === DEAD_TOKEN ? new Response(UNREGISTERED_BODY, { status: 404 }) : new Response('{}'));
    await sender.sendDatos!({ tokens: [DEAD_TOKEN, LIVE_TOKEN], data: { tipo: 'mensaje' }, ttlSegundos: 60 });
    expect(await storedTokens()).toEqual(['live-phone']);
  });

  it('keeps every token and says so when the 404 is not about the token', async () => {
    replyTo = async () => new Response(WRONG_PROJECT_BODY, { status: 404 });
    await sender.sendDatos!({ tokens: [LIVE_TOKEN], data: { tipo: 'mensaje' }, ttlSegundos: 60 });
    expect(await storedTokens()).toEqual(['dead-phone', 'dead-phone-old-row', 'live-phone']);
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('[push] FCM 404'));
  });

  it('says so when FCM does not answer, without printing the token', async () => {
    replyTo = async () => {
      throw new Error('The operation was aborted due to timeout');
    };
    await sender.sendDatos!({ tokens: [LIVE_TOKEN], data: { tipo: 'mensaje' }, ttlSegundos: 60 });
    expect(errors).toHaveBeenCalledWith('[push] FCM no respondió: The operation was aborted due to timeout');
    expect(await storedTokens()).toContain('live-phone');
  });
});
