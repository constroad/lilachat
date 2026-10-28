import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from '../testMongo.js';
import { buildApp } from '../app.js';
import { UserModel } from '../models.js';
import { ChatModel, MessageModel } from '../chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../workspaceModels.js';
import { signSession } from '../sessions.js';
import { BotAppModel, BotCommandRunModel, BotDeliveryModel, BotInstallationModel } from './botModels.js';
import { configureCommands } from './botCommands.js';
import { forgetBots } from './botRegistry.js';
import { installApp } from './botInstall.js';
import { migrateItemsToAllOff } from './botItems.js';

/**
 * Who may use each command and action, and where (José, 28/10, agentes
 * `specs/COMANDOS-Y-HORARIOS.spec.md` §2): untouched is off everywhere, once
 * on only admins until the admin widens it, the app's own 1:1 too, and the
 * server refuses at invoke time what the menu would not offer.
 */
let mongo: MongoMemoryServer;
const app = buildApp({});
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let luis: Types.ObjectId;
let spaceId: Types.ObjectId;
let planta: Types.ObjectId;
let appId: string;
let hook: Server;
let hookUrl = '';
const asUser = (userId: () => Types.ObjectId) => ({ get Authorization() { return `Bearer ${signSession({ userId: String(userId()), deviceId: `d-${userId()}`, email: 'x' })}`; } });
const asJose = asUser(() => jose);
const asAna = asUser(() => ana);
const asLuis = asUser(() => luis);
type Who = typeof asJose;

const items = () => `/api/workspaces/${spaceId}/apps/${appId}/items`;
const enable = (settings: Record<string, unknown>) => request(app).put(items()).set(asJose).send({ items: settings }).expect(200);
const offered = async (as: Who, query: string) => {
  const groups = (await request(app).get(`/api/workspaces/${spaceId}/commands${query}`).set(as).expect(200)).body.groups as { commands: { command: string }[]; shortcuts: { key: string }[] }[];
  return groups.flatMap((group) => [...group.commands.map((entry) => `/${entry.command}`), ...group.shortcuts.map((entry) => entry.key)]);
};
const run = (as: Who, chatId: Types.ObjectId | string) => request(app).post(`/api/chats/${chatId}/commands`).set(as).send({ app_id: appId, command: 'clima', text: '' });
const directOf = async (as: Who) => (await request(app).post(`/api/workspaces/${spaceId}/apps/${appId}/chat`).set(as).expect(200)).body.chatId as string;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_bot_item_access'));
  hook = createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ text: 'Soleado, 24 °C' }));
  });
  await new Promise<void>((resolve) => hook.listen(0, '127.0.0.1', resolve));
  hookUrl = `http://127.0.0.1:${(hook.address() as AddressInfo).port}/events`;
  configureCommands({ answerTimeoutMs: 2000, notify: () => undefined });
});
afterAll(async () => {
  hook.close();
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  forgetBots();
  await Promise.all([UserModel, ChatModel, MessageModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel, BotDeliveryModel, BotCommandRunModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  [jose, ana, luis] = (await UserModel.create([{ phone: '902049935', name: 'José' }, { phone: '987654321', name: 'Ana' }, { phone: '987654322', name: 'Luis' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  spaceId = (await WorkspaceModel.create({ name: 'INFRAMAQ', ownerId: jose, joinCode: 'INFR-7K3P' }))._id;
  await WorkspaceMemberModel.create([
    { workspaceId: spaceId, userId: jose, phone: '902049935', role: 'owner', status: 'active' },
    { workspaceId: spaceId, userId: ana, phone: '987654321', role: 'member', status: 'active' },
    { workspaceId: spaceId, userId: luis, phone: '987654322', role: 'member', status: 'active' },
  ]);
  planta = (await ChatModel.create({ kind: 'group', name: 'planta', workspaceId: spaceId, channel: { visibility: 'public' }, members: [{ userId: jose, role: 'admin' }, { userId: ana, role: 'member' }, { userId: luis, role: 'member' }], lastSeq: 0 }))._id;
  const bot = await BotAppModel.create({ clientId: 'lca_inframaq', clientSecretHash: 'x', name: 'Inframaq', redirectUris: ['https://agentes.example.com/vuelta'], webhookUrl: hookUrl, commands: [{ command: 'clima', description: 'Clima de hoy' }], shortcuts: [{ key: 'marcar_asistencia', name: 'Marcar asistencia' }] });
  appId = String(bot._id);
  await installApp({ app: bot.toObject(), workspaceId: spaceId, installedBy: jose });
});

describe('untouched, everything is off (José, 28/10)', () => {
  it('nobody is offered anything, and invoking anyway is refused with why', async () => {
    expect(await offered(asJose, `?chat=${planta}`)).toEqual([]);
    expect(await offered(asAna, '?place=space')).toEqual([]);
    expect(await offered(asAna, '')).toEqual([]);
    const refused = await run(asJose, planta).expect(403);
    expect(refused.body).toMatchObject({ error: 'not_allowed_here', message: 'No tienes permiso para usar /clima aquí. Pídeselo a un admin del espacio.' });
    expect((await request(app).post(`/api/workspaces/${spaceId}/shortcuts`).set(asJose).send({ app_id: appId, shortcut: 'marcar_asistencia' }).expect(403)).body.message).toBe('No tienes permiso para usar «Marcar asistencia» aquí. Pídeselo a un admin del espacio.');
  });

  it('the app\'s own 1:1 no longer offers everything', async () => {
    const direct = await directOf(asAna);
    expect(await offered(asAna, `?chat=${direct}`)).toEqual([]);
    await run(asAna, direct).expect(403);
  });
});

describe('turned on, only admins until the admin widens it', () => {
  it('in the channels: the admin uses it, a member neither sees it nor runs it', async () => {
    await enable({ 'command:clima': { channels: 'all' } });
    expect(await offered(asJose, `?chat=${planta}`)).toEqual(['/clima']);
    expect((await run(asJose, planta).expect(200)).body).toMatchObject({ outcome: 'ephemeral', response: { text: 'Soleado, 24 °C' } });
    expect(await offered(asAna, `?chat=${planta}`)).toEqual([]);
    await run(asAna, planta).expect(403);
  });

  it('«everyone» opens it to the members; «people» to the ones chosen, and the admins still', async () => {
    await enable({ 'command:clima': { channels: 'all', who: { kind: 'everyone' } } });
    await run(asAna, planta).expect(200);
    await enable({ 'command:clima': { who: { kind: 'people', userIds: [String(luis)] } } });
    expect(await offered(asLuis, `?chat=${planta}`)).toEqual(['/clima']);
    await run(asLuis, planta).expect(200);
    await run(asAna, planta).expect(403);
    await run(asJose, planta).expect(200);
  });

  it('the 1:1 with the app follows «direct», not the channels', async () => {
    await enable({ 'command:clima': { channels: 'all', who: { kind: 'everyone' } } });
    const direct = await directOf(asAna);
    expect(await offered(asAna, `?chat=${direct}`)).toEqual([]);
    await enable({ 'command:clima': { direct: true } });
    expect(await offered(asAna, `?chat=${direct}`)).toEqual(['/clima']);
    await run(asAna, direct).expect(200);
  });

  it('a client without a place (before R160) is offered what is on somewhere and allowed', async () => {
    await enable({ 'shortcut:marcar_asistencia': { global: true, who: { kind: 'everyone' } }, 'command:clima': { direct: true } });
    expect(await offered(asAna, '')).toEqual(['marcar_asistencia']);
    expect(await offered(asJose, '')).toEqual(['/clima', 'marcar_asistencia']);
  });
});

describe('the admin\'s «Comandos y acciones»', () => {
  it('reads direct and who for each item; only an admin saves; people must be members of the space', async () => {
    const rows = (await request(app).get(items()).set(asAna).expect(200)).body.items;
    expect(rows).toEqual([
      { kind: 'shortcut', key: 'marcar_asistencia', name: 'Marcar asistencia', global: false, channels: 'none', direct: false, who: { kind: 'admins' } },
      { kind: 'command', key: 'clima', name: '/clima', description: 'Clima de hoy', global: false, channels: 'none', direct: false, who: { kind: 'admins' } },
    ]);
    await request(app).put(items()).set(asAna).send({ items: { 'command:clima': { direct: true } } }).expect(403);
    const outsider = (await UserModel.create({ phone: '911111111', name: 'X' }))._id;
    const refused = await request(app).put(items()).set(asJose).send({ items: { 'command:clima': { who: { kind: 'people', userIds: [String(outsider)] } } } }).expect(400);
    expect(refused.body.message).toBe('Solo puedes elegir a miembros del espacio.');
  });
});

describe('the move to all off is a migration José approves, not the deploy', () => {
  it('an installation from before keeps working as it did: actions global, all channels, the 1:1, anyone', async () => {
    // Arrange
    await BotInstallationModel.updateMany({}, { $unset: { itemsV2: 1 } });
    const direct = await directOf(asAna);
    // Act
    const inChannel = await offered(asAna, `?chat=${planta}`);
    const inSpace = await offered(asAna, '?place=space');
    // Assert
    expect(inChannel).toEqual(['/clima', 'marcar_asistencia']);
    expect(inSpace).toEqual(['marcar_asistencia']);
    await run(asAna, planta).expect(200);
    await run(asAna, direct).expect(200);
  });

  it('the migration writes every item off and marks it, once; what an admin turned on before is off too', async () => {
    // Arrange
    await BotInstallationModel.updateMany({}, { $unset: { itemsV2: 1 } });
    await enable({ 'command:clima': { global: true } });
    // Act
    const first = await migrateItemsToAllOff();
    const again = await migrateItemsToAllOff();
    // Assert
    expect(first).toEqual({ installations: 1 });
    expect(again).toEqual({ installations: 0 });
    expect(await offered(asJose, `?chat=${planta}`)).toEqual([]);
    expect(await offered(asJose, '?place=space')).toEqual([]);
    await run(asAna, planta).expect(403);
  });
});
