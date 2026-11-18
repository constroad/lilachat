import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { startTestMongo } from '../testMongo.js';
import { UserModel } from '../models.js';
import { ChatModel, MessageModel } from '../chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../workspaceModels.js';
import { BotAppModel, BotCommandRunModel, BotInstallationModel, type BotInstallation } from './botModels.js';
import { configureDevelopers } from './botApps.js';
import { commandContextOf } from './commandContext.js';

/** agentes' Lila answers «/lila ¿qué se decidió?» in a channel (José 18/11): it reads the channel only through a live /lila run. */
let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let spaceId: Types.ObjectId;
let channel: Types.ObjectId;
let portal: BotInstallation;
let stranger: BotInstallation;

const FIFTEEN_MINUTES_MS = 15 * 60_000;
const runOf = async (installation: BotInstallation, extra: Record<string, unknown> = {}) =>
  String((await BotCommandRunModel.create({ installationId: installation._id, chatId: channel, workspaceId: spaceId, userId: jose, command: 'lila', text: '¿qué se decidió?', expiresAt: new Date(Date.now() + FIFTEEN_MINUTES_MS), ...extra }))._id);

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_command_context'));
});
afterAll(async () => {
  configureDevelopers(['lca_lnkjg6KXzr_GBiF-YG3V']);
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel, ChatModel, MessageModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel, BotCommandRunModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  configureDevelopers(['lca_test_lila']);
  const [joseUser, anaUser] = await UserModel.create([{ phone: '902049935', name: 'José' }, { phone: '987654321', name: 'Ana' }]);
  jose = joseUser!._id;
  ana = anaUser!._id;
  spaceId = (await WorkspaceModel.create({ name: 'Test', ownerId: jose, joinCode: 'TEST-8355' }))._id;
  channel = (await ChatModel.create({ kind: 'group', name: 'obra-norte', workspaceId: spaceId, channel: { visibility: 'public' }, members: [{ userId: jose, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 2 }))._id;
  await MessageModel.create([
    { chatId: channel, seq: 1, senderId: ana, clientKey: 'k1', kind: 'text', body: 'El vaciado queda para el lunes' },
    { chatId: channel, seq: 2, senderId: jose, clientKey: 'k2', kind: 'text', body: 'Ok, lunes a las 7' },
  ]);
  const [lila, outsider] = await BotAppModel.create([
    { clientId: 'lca_test_lila', clientSecretHash: 'h1', name: 'Lila', redirectUris: ['https://agentes.test/cb'], webhookUrl: 'https://agentes.test/hook' },
    { clientId: 'lca_other', clientSecretHash: 'h3', name: 'Otra', redirectUris: ['https://otra.test/cb'], webhookUrl: 'https://otra.test/hook' },
  ]);
  const portalApp = await BotAppModel.create({ clientId: 'lca_portal', clientSecretHash: 'h2', name: 'Portal', redirectUris: ['https://agentes.test/cb'], webhookUrl: 'https://agentes.test/hook', ownerAppId: lila!._id });
  const install = (appId: Types.ObjectId, token: string) => ({ appId, workspaceId: spaceId, botUserId: new Types.ObjectId(), tokenHash: token, signingSecret: `s-${token}`, installedBy: jose });
  const [portalInstall, otherInstall] = await BotInstallationModel.create([install(portalApp._id, 'portal'), install(outsider!._id, 'other')]);
  portal = portalInstall!.toObject() as BotInstallation;
  stranger = otherInstall!.toObject() as BotInstallation;
});

describe('commandContextOf: the channel a /lila run was asked in', () => {
  it('gives the chat name and its last messages with who wrote them', async () => {
    // Arrange
    const id = await runOf(portal);
    // Act
    const context = await commandContextOf(portal, id);
    // Assert
    expect(context).toEqual({ chat: { name: 'obra-norte' }, messages: [{ from: 'Ana', text: 'El vaciado queda para el lunes' }, { from: 'José', text: 'Ok, lunes a las 7' }] });
  });

  it('is 404 for a run of another installation or an id that is not one', async () => {
    const id = await runOf(portal);
    expect(await commandContextOf(stranger, id)).toMatchObject({ status: 404 });
    expect(await commandContextOf(portal, 'nope')).toMatchObject({ status: 404 });
  });

  it('is 410 once the run is older than 15 minutes', async () => {
    const id = await runOf(portal, { expiresAt: new Date(Date.now() - 1_000) });
    expect(await commandContextOf(portal, id)).toMatchObject({ status: 410, error: 'command_expired' });
  });

  it('is 403 for any command other than /lila: a command is not a pass to read the channel', async () => {
    const id = await runOf(portal, { command: 'tanques' });
    expect(await commandContextOf(portal, id)).toMatchObject({ status: 403, error: 'not_a_context_command' });
  });

  it('is 403 for an app that is not agentes\' own, even with a /lila run', async () => {
    const id = await runOf(stranger);
    expect(await commandContextOf(stranger, id)).toMatchObject({ status: 403, error: 'not_a_context_command' });
  });

  it('is 409 for a run from the space\'s ⚡, which has no chat', async () => {
    const id = await runOf(portal, { chatId: undefined });
    expect(await commandContextOf(portal, id)).toMatchObject({ status: 409, error: 'no_chat' });
  });

  it('is 409 for an encrypted chat: its text never leaves', async () => {
    await ChatModel.updateOne({ _id: channel }, { $set: { encrypted: true } });
    const id = await runOf(portal);
    expect(await commandContextOf(portal, id)).toMatchObject({ status: 409, error: 'encrypted_chat' });
  });
});
