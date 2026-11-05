import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import type { Server as SocketServer } from 'socket.io';
import { startTestMongo } from '../testMongo.js';
import { UserModel } from '../models.js';
import { ChatModel, MessageModel } from '../chatModels.js';
import { sendMessage } from '../chatService.js';
import { fijarServidorDelReparto } from '../reparto.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../workspaceModels.js';
import { BotAppModel, BotInstallationModel } from './botModels.js';
import { forgetBots } from './botRegistry.js';
import { installApp } from './botInstall.js';
import { postBotMessage } from './botMessages.js';

/** An app's answer under a voucher stayed out of sight until a reload: the chip of the root never moved (04/11). */
let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let channel: Types.ObjectId;
let spaceId: Types.ObjectId;
const frames: { room: string; event: string; frame: Record<string, unknown> }[] = [];
const fakeIo = { to: (room: string) => ({ emit: (event: string, frame: Record<string, unknown>) => frames.push({ room, event, frame }) }) };
const threadFrames = () => frames.filter((one) => one.event === 'msg.hilo');

const installPortal = async () => {
  const bot = await BotAppModel.create({ clientId: 'lca_portal', clientSecretHash: 'x', name: 'Portal', redirectUris: ['https://agentes.example.com/vuelta'], webhookUrl: 'http://127.0.0.1:1/events', scopes: [] });
  return (await installApp({ app: bot.toObject(), workspaceId: spaceId, installedBy: jose })).installation;
};

const voucher = async () => (await sendMessage({ chatId: String(channel), senderId: jose, clientKey: 'voucher-1', kind: 'text', body: '/gastos pago parcial' })).message;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_bot_thread_reply'));
  fijarServidorDelReparto(fakeIo as unknown as SocketServer);
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  frames.length = 0;
  forgetBots();
  await Promise.all([UserModel, ChatModel, MessageModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  jose = (await UserModel.create({ phone: '902049935', name: 'José' }))._id;
  spaceId = (await WorkspaceModel.create({ name: 'Test', ownerId: jose, joinCode: 'TEST-8355' }))._id;
  await WorkspaceMemberModel.create({ workspaceId: spaceId, userId: jose, phone: '902049935', role: 'owner', status: 'active' });
  channel = (await ChatModel.create({ kind: 'group', name: 'flujo-caja', workspaceId: spaceId, channel: { visibility: 'public' }, members: [{ userId: jose, role: 'admin' }], lastSeq: 0 }))._id;
});

describe('an app answering in a thread', () => {
  it('moves the chip of the root for every member, without a reload', async () => {
    const installation = await installPortal();
    const root = await voucher();

    await postBotMessage(installation, { target: { channelId: String(channel) }, text: 'No registré este voucher', threadOf: root.seq, idempotencyKey: 'reply-1' });

    const announced = threadFrames().find((one) => one.room.includes(String(jose)));
    expect(announced?.frame).toMatchObject({ chatId: String(channel), raiz: root.seq, hilo: { respuestas: 1 } });
  });

  it('a retried post with the same key does not announce it twice', async () => {
    const installation = await installPortal();
    const root = await voucher();
    const post = { target: { channelId: String(channel) }, text: 'Registrado', threadOf: root.seq, idempotencyKey: 'reply-2' };

    await postBotMessage(installation, post);
    const afterFirst = threadFrames().length;
    await postBotMessage(installation, post);

    expect(threadFrames()).toHaveLength(afterFirst);
  });

  it('a message outside a thread announces no summary', async () => {
    const installation = await installPortal();

    await postBotMessage(installation, { target: { channelId: String(channel) }, text: 'Caja del día', idempotencyKey: 'plain-1' });

    expect(threadFrames()).toEqual([]);
  });
});
