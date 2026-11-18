import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { startTestMongo } from './testMongo.js';
import { WorkspaceMemberModel } from './workspaceModels.js';
import { BotAppModel, BotInstallationModel } from './bots/botModels.js';
import { configureDevelopers } from './bots/botApps.js';
import { lilaDoorFor, modelAnswerOf } from './agentesModel.js';

let mongo: MongoMemoryServer;
const jose = new Types.ObjectId();
const stranger = new Types.ObjectId();
const space = new Types.ObjectId();
const otherSpace = new Types.ObjectId();
let lilaAppId: Types.ObjectId;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  configureDevelopers(['lca_lnkjg6KXzr_GBiF-YG3V']);
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([WorkspaceMemberModel, BotAppModel, BotInstallationModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  configureDevelopers(['lca_test_lila']);
  const [lila, other] = await BotAppModel.create([
    { clientId: 'lca_test_lila', clientSecretHash: 'h1', name: 'Lila', redirectUris: ['https://agentes.test/cb'], webhookUrl: 'https://agentes.test/v1/channels/lilachat/events' },
    { clientId: 'lca_test_portal', clientSecretHash: 'h2', name: 'Portal', redirectUris: ['https://portal.test/cb'], webhookUrl: 'https://portal.test/hook' },
  ]);
  lilaAppId = lila!._id;
  await WorkspaceMemberModel.create([
    { workspaceId: space, userId: jose, phone: '51902049935', role: 'owner', status: 'active' },
    { workspaceId: otherSpace, userId: stranger, phone: '51987654321', role: 'owner', status: 'deactivated' },
  ]);
  const install = (appId: Types.ObjectId, workspaceId: Types.ObjectId, token: string, extra: Record<string, unknown> = {}) => ({ appId, workspaceId, botUserId: new Types.ObjectId(), tokenHash: token, signingSecret: `secret-${token}`, installedBy: jose, ...extra });
  await BotInstallationModel.create([install(other!._id, space, 'portal'), install(lilaAppId, space, 'lila'), install(lilaAppId, otherSpace, 'lila-other')]);
});

describe('lilaDoorFor: the Lila app installation that signs a model task', () => {
  it('is the Lila installation of a space where the chat member is active', async () => {
    // Act
    const door = await lilaDoorFor([String(jose)]);
    // Assert
    expect(door).toMatchObject({ signingSecret: 'secret-lila', webhookUrl: 'https://agentes.test/v1/channels/lilachat/events' });
    expect(String(door?.workspaceId)).toBe(String(space));
  });

  it('is none for someone without an active space that has Lila', async () => {
    expect(await lilaDoorFor([String(stranger)])).toBeNull();
    expect(await lilaDoorFor([])).toBeNull();
  });

  it('skips a revoked installation', async () => {
    // Arrange
    await BotInstallationModel.updateOne({ tokenHash: 'lila' }, { $set: { revokedAt: new Date() } });
    // Act / Assert
    expect(await lilaDoorFor([String(jose)])).toBeNull();
  });
});

describe('modelAnswerOf: what agentes answered', () => {
  it('passes the JSON of a done task', () => {
    expect(modelAnswerOf({ status: 200, body: { ok: true, json: { category: 'IA' }, provider: 'anthropic', model: 'claude-haiku-5-5' } })).toEqual({ ok: true, json: { category: 'IA' } });
  });

  it('says not configured when agentes has the model off', () => {
    expect(modelAnswerOf({ status: 200, body: { ok: false, code: 'off' } })).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('is a failure for anything else: a budget, a timeout, a 502 or a broken body', () => {
    expect(modelAnswerOf({ status: 200, body: { ok: false, code: 'budget' } })).toEqual({ ok: false, reason: 'failed' });
    expect(modelAnswerOf({ status: null, body: null, error: 'timeout' })).toEqual({ ok: false, reason: 'failed' });
    expect(modelAnswerOf({ status: 502, body: { code: 'product_failed' }, error: 'HTTP 502' })).toEqual({ ok: false, reason: 'failed' });
    expect(modelAnswerOf({ status: 200, body: undefined })).toEqual({ ok: false, reason: 'failed' });
  });
});
