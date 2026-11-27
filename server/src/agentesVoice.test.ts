import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { startTestMongo } from './testMongo.js';
import { WorkspaceMemberModel } from './workspaceModels.js';
import { BotAppModel, BotInstallationModel } from './bots/botModels.js';
import { configureDevelopers } from './bots/botApps.js';
import { eventSignature } from './bots/botSecrets.js';
import { speakWithAgentes } from './agentesVoice.js';

/** José 27/11: the sticker voice comes from agentes (`POST /v1/voice/speech`, agentes 871d7c9), signed like its events. */
let mongo: MongoMemoryServer;
let agentes: Server;
let base = '';
const admin = new Types.ObjectId();
const space = new Types.ObjectId();
const SECRET = 'lcs_test_voice';
type Heard = { path: string; installation: string; signedOk: boolean; body: Record<string, unknown> };
const heard: Heard[] = [];
let reply: { status: number; body: Buffer | string } = { status: 200, body: Buffer.from('m4a') };
let installationId = '';

const read = (req: IncomingMessage) => new Promise<string>((resolve) => { let raw = ''; req.on('data', (chunk) => (raw += chunk)); req.on('end', () => resolve(raw)); });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_agentes_voice'));
  agentes = createServer(async (req, res) => {
    const raw = await read(req);
    const ts = Number(req.headers['x-lilachat-timestamp']);
    heard.push({ path: req.url ?? '', installation: String(req.headers['x-lilachat-installation']), signedOk: req.headers['x-lilachat-signature'] === eventSignature(SECRET, ts, raw), body: JSON.parse(raw || '{}') });
    res.writeHead(reply.status, { 'Content-Type': reply.status === 200 ? 'audio/mp4' : 'application/json' });
    res.end(reply.body);
  }).listen(0);
  base = `http://127.0.0.1:${(agentes.address() as AddressInfo).port}`;
});
afterAll(async () => {
  configureDevelopers(['lca_lnkjg6KXzr_GBiF-YG3V']);
  agentes.close();
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  heard.length = 0;
  reply = { status: 200, body: Buffer.from('m4a') };
  await Promise.all([WorkspaceMemberModel.deleteMany({}), BotAppModel.deleteMany({}), BotInstallationModel.deleteMany({})]);
  configureDevelopers(['lca_test_lila']);
  const lila = await BotAppModel.create({ clientId: 'lca_test_lila', clientSecretHash: 'h', name: 'Lila', redirectUris: ['https://agentes.test/cb'], webhookUrl: `${base}/v1/channels/lilachat/events` });
  await WorkspaceMemberModel.create({ workspaceId: space, userId: admin, phone: '51900000021', role: 'admin', status: 'active' });
  installationId = String((await BotInstallationModel.create({ appId: lila._id, workspaceId: space, botUserId: new Types.ObjectId(), tokenHash: 't', signingSecret: SECRET, installedBy: admin }))._id);
});

const speech = { text: '¡Buen trabajo!', voiceId: 'daniel' as const, spaceId: String(space), userId: String(admin) };

describe('speakWithAgentes', () => {
  it('asks agentes for the phrase, signed with the Lila installation, and gets the audio', async () => {
    // Act
    const outcome = await speakWithAgentes(speech);
    // Assert
    expect(outcome).toEqual({ ok: true, audio: Buffer.from('m4a') });
    expect(heard).toEqual([{ path: '/v1/voice/speech', installation: installationId, signedOk: true, body: { text: '¡Buen trabajo!', voice: 'daniel', spaceId: String(space), userId: String(admin) } }]);
  });

  it('the cap is «limit», a bad phrase «refused», anything else «unavailable»', async () => {
    reply = { status: 429, body: '{}' };
    expect(await speakWithAgentes(speech)).toEqual({ ok: false, reason: 'limit' });
    reply = { status: 400, body: '{"code":"invalid_input"}' };
    expect(await speakWithAgentes(speech)).toEqual({ ok: false, reason: 'refused' });
    reply = { status: 503, body: '{"reason":"voice_unavailable"}' };
    expect(await speakWithAgentes(speech)).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('an empty 200 is not a voice', async () => {
    reply = { status: 200, body: Buffer.alloc(0) };
    expect(await speakWithAgentes(speech)).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('any live app of agentes in the space signs it, not only Lila (prod 27/11: Lila had no installation)', async () => {
    // Arrange: only a Dali-like app of agentes is installed, plus a foreign app on another host
    await BotInstallationModel.deleteMany({});
    const [dali, foreign] = await BotAppModel.create([
      { clientId: 'lca_test_dali', clientSecretHash: 'h', name: 'Dali', redirectUris: ['https://agentes.test/cb'], webhookUrl: `${base}/v1/channels/lilachat/events` },
      { clientId: 'lca_test_other', clientSecretHash: 'h', name: 'Otro', redirectUris: ['https://otro.test/cb'], webhookUrl: 'https://otro.test/hook' },
    ]);
    await BotInstallationModel.create({ appId: foreign!._id, workspaceId: space, botUserId: new Types.ObjectId(), tokenHash: 't2', signingSecret: 'lcs_foreign', installedBy: admin });
    const daliInstall = await BotInstallationModel.create({ appId: dali!._id, workspaceId: space, botUserId: new Types.ObjectId(), tokenHash: 't3', signingSecret: SECRET, installedBy: admin });
    // Act
    const outcome = await speakWithAgentes(speech);
    // Assert
    expect(outcome.ok).toBe(true);
    expect(heard).toEqual([expect.objectContaining({ installation: String(daliInstall._id), signedOk: true })]);
  });

  it('without a live app of agentes there is no voice, and nothing is asked', async () => {
    await BotInstallationModel.deleteMany({});
    expect(await speakWithAgentes(speech)).toEqual({ ok: false, reason: 'unavailable' });
    expect(heard).toHaveLength(0);
  });
});
