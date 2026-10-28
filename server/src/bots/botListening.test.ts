import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from '../testMongo.js';
import { buildApp } from '../app.js';
import { UserModel } from '../models.js';
import { ChatModel, MessageModel, type Message } from '../chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../workspaceModels.js';
import { signSession } from '../sessions.js';
import { deleteMessage, editMessage } from '../chatService.js';
import { BotAppModel, BotDeliveryModel, BotInstallationModel } from './botModels.js';
import { configureBotDeliveries } from './botEvents.js';
import { configureFormFiles } from './botForms.js';
import { forgetBots } from './botRegistry.js';
import { installApp } from './botInstall.js';
import { botHears, botsHearDelete, botsHearEdit, botsHearMessage, filesOf } from './botTriggers.js';

/** What an app hears beyond its mentions (pending 87 and 90): the whole channel with `channels:history`, edits, deletions and files. */
let mongo: MongoMemoryServer;
const VOUCHER = Buffer.from('%PDF-1.4 voucher');
const stored = new Map<string, Buffer>();
const app = buildApp({
  mediaUploader: {
    async upload(params) {
      const url = `/files/${params.fileName}`;
      stored.set(url, params.bytes);
      return { ok: true, media: { url, storageName: `st-${params.fileName}`, sizeBytes: params.bytes.length } };
    },
  },
});
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let spaceId: Types.ObjectId;
let channel: Types.ObjectId;
const asAna = { get Authorization() { return `Bearer ${signSession({ userId: String(ana), deviceId: 'd-ana', email: 'x' })}`; } };

const received: { type: string; body: Record<string, unknown> }[] = [];
let hook: Server;
let hookUrl = '';
const eventsOf = (type: string) => received.filter((one) => one.type === type).map((one) => one.body.data as Record<string, unknown>);
const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_bot_listening'));
  hook = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      received.push({ type: String(req.headers['x-lilachat-event']), body: JSON.parse(body) });
      res.end();
    });
  });
  await new Promise<void>((resolve) => hook.listen(0, '127.0.0.1', resolve));
  hookUrl = `http://127.0.0.1:${(hook.address() as AddressInfo).port}/events`;
  configureBotDeliveries({ retryDelaysMs: [50] });
  configureFormFiles({ read: async (url) => stored.get(url) ?? null });
});
afterAll(async () => {
  hook.close();
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  received.length = 0;
  stored.clear();
  forgetBots();
  await Promise.all([UserModel, ChatModel, MessageModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel, BotDeliveryModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  [jose, ana] = (await UserModel.create([{ phone: '902049935', name: 'José' }, { phone: '987654321', name: 'Ana' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  spaceId = (await WorkspaceModel.create({ name: 'CONSTROAD', ownerId: jose, joinCode: 'CONS-7K3P' }))._id;
  await WorkspaceMemberModel.create([{ workspaceId: spaceId, userId: jose, phone: '902049935', role: 'owner', status: 'active' }, { workspaceId: spaceId, userId: ana, phone: '987654321', role: 'member', status: 'active' }]);
  channel = (await ChatModel.create({ kind: 'group', name: 'inframaq-admin', workspaceId: spaceId, channel: { visibility: 'public' }, members: [{ userId: jose, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 0 }))._id;
});

/** Installs «Inframaq» with the scopes its manifest asks for; returns the chat's members with the bot. */
async function installInframaq(scopes: string[]): Promise<string[]> {
  const bot = await BotAppModel.create({ clientId: 'lca_inframaq', clientSecretHash: 'x', name: 'Inframaq', redirectUris: ['https://agentes.example.com/vuelta'], webhookUrl: hookUrl, scopes });
  const installed = await installApp({ app: bot.toObject(), workspaceId: spaceId, installedBy: jose });
  return [String(jose), String(ana), String(installed.installation.botUserId)];
}

const say = async (seq: number, body: string, extra: Partial<Message> = {}) => (await MessageModel.create({ chatId: channel, seq, senderId: ana, clientKey: `k${seq}`, kind: 'text', body, ...extra })).toObject();

describe('who hears a message (pending 87a)', () => {
  it('its 1:1 always; a channel only by mention, or entirely with channels:history', () => {
    expect(botHears({ chatKind: 'direct', named: false, scopes: [] })).toBe(true);
    expect(botHears({ chatKind: 'group', named: true, scopes: [] })).toBe(true);
    expect(botHears({ chatKind: 'group', named: false, scopes: [] })).toBe(false);
    expect(botHears({ chatKind: 'group', named: false, scopes: ['channels:history'] })).toBe(true);
    expect(botHears({ chatKind: 'group', named: false, scopes: ['users:read.email'] })).toBe(false);
  });

  it('with channels:history the app hears the production announcement nobody addressed to it', async () => {
    const members = await installInframaq(['channels:history']);
    expect(await botsHearMessage(await say(1, 'tenemos producción el sábado 24-10, 03:00, 480 m³'), members)).toBe(true);
    await settle();
    expect(eventsOf('message.created')).toMatchObject([{ channel: { kind: 'channel', name: 'inframaq-admin' }, message: { seq: 1, text: 'tenemos producción el sábado 24-10, 03:00, 480 m³', mentions_bot: false }, author: { phone: '51987654321' } }]);
  });

  it('without the scope the same message stays unheard', async () => {
    const members = await installInframaq([]);
    expect(await botsHearMessage(await say(1, 'tenemos producción el sábado'), members)).toBe(false);
    await settle();
    expect(eventsOf('message.created')).toEqual([]);
  });

  it('a reply in a thread carries thread_of so the app answers there', async () => {
    const members = await installInframaq(['channels:history']);
    await botsHearMessage(await say(2, 'mejor a las 04:00', { hiloDe: 1 }), members);
    await settle();
    expect(eventsOf('message.created')[0]).toMatchObject({ message: { seq: 2, thread_of: 1 } });
  });
});

describe('edits and deletions of what the app heard (pending 87b)', () => {
  it('message.edited with the text before, to the app that heard it', async () => {
    const members = await installInframaq(['channels:history']);
    await say(1, 'producción el sábado a las 03:00');
    const edited = await editMessage({ chatId: String(channel), seq: 1, userId: ana, body: 'producción el sábado a las 05:00' });
    if (!edited.ok) throw new Error(edited.motivo);
    await botsHearEdit(edited.message, edited.previous, members);
    await settle();
    expect(eventsOf('message.edited')).toMatchObject([{ message: { seq: 1, text: 'producción el sábado a las 05:00', previous_text: 'producción el sábado a las 03:00', mentions_bot: false }, author: { id: String(ana) } }]);
  });

  it('a mention-only app hears the edit that names it, but not the text it never heard', async () => {
    const members = await installInframaq([]);
    await say(1, 'producción el sábado');
    const edited = await editMessage({ chatId: String(channel), seq: 1, userId: ana, body: '@Inframaq producción el sábado' });
    if (!edited.ok) throw new Error(edited.motivo);
    await botsHearEdit(edited.message, edited.previous, members);
    await settle();
    const [event] = eventsOf('message.edited');
    expect(event).toMatchObject({ message: { text: '@Inframaq producción el sábado', mentions_bot: true } });
    expect((event!.message as Record<string, unknown>).previous_text).toBeUndefined();
  });

  it('message.deleted with who deleted it, and nothing to an app that never heard it', async () => {
    const members = await installInframaq(['channels:history']);
    await say(1, 'cancelado lo del sábado');
    const deleted = await deleteMessage({ chatId: String(channel), seq: 1, userId: ana });
    if (!deleted.ok) throw new Error(deleted.motivo);
    await botsHearDelete(deleted.previous, members, ana);
    await settle();
    expect(eventsOf('message.deleted')).toMatchObject([{ channel: { id: String(channel) }, message: { seq: 1 }, by: { id: String(ana) } }]);
    expect(JSON.stringify(eventsOf('message.deleted'))).not.toContain('cancelado');

    received.length = 0;
    forgetBots();
    await BotInstallationModel.updateMany({}, { $set: { grantedScopes: [] } });
    await say(2, 'sin mención');
    const other = await deleteMessage({ chatId: String(channel), seq: 2, userId: ana });
    if (!other.ok) throw new Error(other.motivo);
    await botsHearDelete(other.previous, members, ana);
    await settle();
    expect(eventsOf('message.deleted')).toEqual([]);
  });
});

describe('files toward the app (pending 90)', () => {
  it('a photo, a document or a voice note goes as a signed address; a sticker or a video does not', () => {
    const id = new Types.ObjectId();
    const media = { mediaId: 'st-1', url: '/files/voucher.pdf', mime: 'application/pdf', fileName: 'voucher.pdf', sizeBytes: 16 };
    expect(filesOf({ _id: id, kind: 'file', media })).toMatchObject([{ mime: 'application/pdf', name: 'voucher.pdf', size: 16 }]);
    expect(filesOf({ _id: id, kind: 'file', media })[0]!.url).toMatch(/\/api\/bots\/files\/[\w-]+\.[\w-]+$/);
    expect(filesOf({ _id: id, kind: 'sticker', media })).toEqual([]);
    expect(filesOf({ _id: id, kind: 'video', media })).toEqual([]);
    expect(filesOf({ _id: id, kind: 'text' })).toEqual([]);
  });

  it('a voucher uploaded to the 1:1 reaches the app, and its address serves the bytes', async () => {
    const members = await installInframaq([]);
    const botUserId = members[2]!;
    const direct = (await ChatModel.create({ kind: 'direct', workspaceId: spaceId, members: [{ userId: ana, role: 'member' }, { userId: new Types.ObjectId(botUserId), role: 'member' }], lastSeq: 0 }))._id;
    await request(app).post('/api/media').set(asAna).field('chatId', String(direct)).field('clientKey', 'v1').attach('file', VOUCHER, { filename: 'voucher.pdf', contentType: 'application/pdf' }).expect(201);
    await settle();
    const [event] = eventsOf('message.created');
    const files = (event!.message as { files: { url: string; mime: string; name: string }[] }).files;
    expect(files).toMatchObject([{ mime: 'application/pdf', name: 'voucher.pdf' }]);
    const address = new URL(files[0]!.url);
    const served = await request(app).get(address.pathname).expect(200);
    expect(served.headers['content-type']).toContain('application/pdf');
    expect(Buffer.from(served.body as Buffer).toString()).toBe(VOUCHER.toString());
  });

  it('a deleted file stops being served even inside its 15 minutes', async () => {
    const members = await installInframaq(['channels:history']);
    const sent = await say(1, '', { kind: 'file', media: { mediaId: 'st-1', url: '/files/r.pdf', mime: 'application/pdf', fileName: 'r.pdf' } });
    stored.set('/files/r.pdf', VOUCHER);
    const [file] = filesOf(sent);
    await deleteMessage({ chatId: String(channel), seq: 1, userId: ana });
    await request(app).get(new URL(file!.url).pathname).expect(404);
    expect(members).toHaveLength(3);
  });
});
