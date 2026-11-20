import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { REPORTS_PER_DAY } from '@lilachat/shared';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { DeviceModel, UserModel } from '../src/models.js';
import { setPushSender } from '../src/pushService.js';
import type { PushMessage } from '../src/pushSender.js';
import { ReportModel } from '../src/reportModel.js';
import { signSession } from '../src/sessions.js';
import { startTestMongo } from '../src/testMongo.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../src/workspaceModels.js';

/** Google Play (José 19/11): report a person or a message; the superadmin and the space's admins hear of it. */
const app = buildApp();
let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let beto: Types.ObjectId;
let carla: Types.ObjectId;
let space: Types.ObjectId;
let channel: Types.ObjectId;
let directChat: Types.ObjectId;
let sent: PushMessage[];
const auth = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' })}` });
const recipientsOf = (title: string) => sent.filter((message) => message.title === title).flatMap((message) => message.tokens).sort();

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_reports'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  sent = [];
  setPushSender({ send: async (message) => void sent.push(message), sendDatos: async () => undefined });
  await Promise.all([UserModel, DeviceModel, ChatModel, MessageModel, ReportModel, WorkspaceModel, WorkspaceMemberModel].map((model) => (model as typeof UserModel).deleteMany({})));
  [jose, ana, beto, carla] = (await UserModel.create([{ phone: '902049935', name: 'José' }, { phone: '911111111', name: 'Ana' }, { phone: '922222222', name: 'Beto' }, { phone: '933333333', name: 'Carla' }])).map((user) => user._id) as Types.ObjectId[] as [Types.ObjectId, Types.ObjectId, Types.ObjectId, Types.ObjectId];
  await DeviceModel.create([jose, ana, beto, carla].map((userId, index) => ({ deviceId: `dev-${index}`, userId, platform: 'android', pushToken: `tok-${index}` })));
  space = (await WorkspaceModel.create({ name: 'Inframaq', ownerId: carla, joinCode: 'INFRA-1', joinPolicy: 'open' }))._id;
  await WorkspaceMemberModel.create([
    { workspaceId: space, userId: carla, phone: '933333333', role: 'owner', status: 'active' },
    { workspaceId: space, userId: ana, phone: '911111111', role: 'member', status: 'active' },
    { workspaceId: space, userId: beto, phone: '922222222', role: 'member', status: 'active' },
  ]);
  channel = (await ChatModel.create({ kind: 'group', name: 'obra', workspaceId: space, channel: { visibility: 'public' }, members: [{ userId: ana, role: 'member' }, { userId: beto, role: 'member' }, { userId: carla, role: 'admin' }], lastSeq: 2 }))._id;
  directChat = (await ChatModel.create({ kind: 'direct', members: [{ userId: ana, role: 'member' }, { userId: beto, role: 'member' }], lastSeq: 1 }))._id;
  await MessageModel.create([
    { chatId: channel, seq: 1, senderId: beto, clientKey: 'c1', kind: 'text', body: 'Te voy a buscar', at: new Date() },
    { chatId: channel, seq: 2, senderId: ana, clientKey: 'c2', kind: 'image', media: { mediaId: 'foto-1' }, at: new Date() },
    { chatId: directChat, seq: 1, senderId: beto, clientKey: 'p1', kind: 'text', body: 'spam spam', at: new Date() },
  ]);
});

describe('POST /api/reports — a message', () => {
  it('keeps a copy of the message as evidence, even after it is deleted', async () => {
    // Act
    const { body } = await request(app).post('/api/reports').set(auth(ana)).send({ target: 'message', chatId: String(channel), seq: 1, reason: 'violence' }).expect(201);
    await MessageModel.updateOne({ chatId: channel, seq: 1 }, { $unset: { body: 1 }, $set: { deletedAt: new Date() } });
    // Assert
    const report = await ReportModel.findById(body.reportId).lean();
    expect(report).toMatchObject({ target: 'message', reason: 'violence', priority: 'normal', status: 'open', workspaceId: space });
    expect(String(report?.reportedUserId)).toBe(String(beto));
    expect(report?.evidence).toMatchObject({ seq: 1, kind: 'text', body: 'Te voy a buscar', mediaIds: [], encrypted: false });
  });

  it('notifies the superadmin and the space admins, never the reported person nor the reporter', async () => {
    // Arrange: Beto is also an admin of the space; he must not hear he was reported.
    await WorkspaceMemberModel.updateOne({ workspaceId: space, userId: beto }, { role: 'admin' });
    // Act
    await request(app).post('/api/reports').set(auth(ana)).send({ target: 'message', chatId: String(channel), seq: 1, reason: 'child_abuse' }).expect(201);
    // Assert
    expect(recipientsOf('Denuncia urgente')).toEqual(['tok-0', 'tok-3']);
    expect(sent.every((message) => !message.body.includes('Te voy a buscar'))).toBe(true);
    expect((await ReportModel.findOne().lean())?.priority).toBe('high');
  });

  it('in a chat without a space, only the superadmin hears of it', async () => {
    await request(app).post('/api/reports').set(auth(ana)).send({ target: 'message', chatId: String(directChat), seq: 1, reason: 'spam' }).expect(201);
    expect(recipientsOf('Nueva denuncia')).toEqual(['tok-0']);
  });

  it('refuses my own message, a chat I am not in, and a message that does not exist', async () => {
    await request(app).post('/api/reports').set(auth(ana)).send({ target: 'message', chatId: String(channel), seq: 2, reason: 'spam' }).expect(400);
    await request(app).post('/api/reports').set(auth(jose)).send({ target: 'message', chatId: String(channel), seq: 1, reason: 'spam' }).expect(404);
    await request(app).post('/api/reports').set(auth(ana)).send({ target: 'message', chatId: String(channel), seq: 99, reason: 'spam' }).expect(404);
    expect(await ReportModel.countDocuments()).toBe(0);
  });

  it('«Bloquear también» blocks the author in the same step', async () => {
    const { body } = await request(app).post('/api/reports').set(auth(ana)).send({ target: 'message', chatId: String(directChat), seq: 1, reason: 'spam', alsoBlock: true }).expect(201);
    expect(body).toMatchObject({ blocked: true });
    expect((await UserModel.findById(ana).lean())?.blockedUsers?.map(String)).toEqual([String(beto)]);
    expect((await ChatModel.findById(directChat).lean())?.blockedBy?.map(String)).toEqual([String(ana)]);
  });
});

describe('POST /api/reports — a person', () => {
  it('from a group member’s card: with the chat, its space admins hear of it', async () => {
    await request(app).post('/api/reports').set(auth(ana)).send({ target: 'user', userId: String(beto), chatId: String(channel), reason: 'impersonation' }).expect(201);
    const report = await ReportModel.findOne().lean();
    expect(report).toMatchObject({ target: 'user', reason: 'impersonation', workspaceId: space });
    expect(report?.evidence).toBeUndefined();
    expect(recipientsOf('Nueva denuncia')).toEqual(['tok-0', 'tok-3']);
  });

  it('refuses myself, someone who does not exist, and a bad body', async () => {
    await request(app).post('/api/reports').set(auth(ana)).send({ target: 'user', userId: String(ana), reason: 'spam' }).expect(400);
    await request(app).post('/api/reports').set(auth(ana)).send({ target: 'user', userId: String(new Types.ObjectId()), reason: 'spam' }).expect(404);
    await request(app).post('/api/reports').set(auth(ana)).send({ target: 'user', userId: String(beto), reason: 'other' }).expect(400);
    await request(app).post('/api/reports').send({ target: 'user', userId: String(beto), reason: 'spam' }).expect(401);
  });
});

describe('anti-abuse', () => {
  it('the same open report again is not a second one', async () => {
    const first = await request(app).post('/api/reports').set(auth(ana)).send({ target: 'user', userId: String(beto), reason: 'spam' }).expect(201);
    sent = [];
    const second = await request(app).post('/api/reports').set(auth(ana)).send({ target: 'user', userId: String(beto), reason: 'harassment' }).expect(200);
    expect(second.body).toMatchObject({ reportId: first.body.reportId, duplicate: true });
    expect(await ReportModel.countDocuments()).toBe(1);
    expect(sent).toEqual([]);
  });

  it(`after ${REPORTS_PER_DAY} reports in a day, 429`, async () => {
    // Arrange
    await ReportModel.create(Array.from({ length: REPORTS_PER_DAY }, () => ({ reporterId: ana, target: 'user', reportedUserId: new Types.ObjectId(), reason: 'spam', priority: 'normal' })));
    // Act / Assert
    await request(app).post('/api/reports').set(auth(ana)).send({ target: 'user', userId: String(beto), reason: 'spam' }).expect(429);
  });
});

describe('the superadmin queue (/api/admin/reports)', () => {
  it('only the superadmin reads it', async () => {
    await request(app).get('/api/admin/reports').expect(401);
    await request(app).get('/api/admin/reports').set(auth(carla)).expect(403);
  });

  it('lists the open ones, child abuse first, with the people, the chat, the space and the evidence', async () => {
    // Arrange
    await request(app).post('/api/reports').set(auth(ana)).send({ target: 'user', userId: String(beto), reason: 'spam' }).expect(201);
    await request(app).post('/api/reports').set(auth(ana)).send({ target: 'message', chatId: String(channel), seq: 1, reason: 'child_abuse', note: 'es grave' }).expect(201);
    // Act
    const { body } = await request(app).get('/api/admin/reports').set(auth(jose)).expect(200);
    // Assert
    expect(body).toMatchObject({ total: 2, open: 2, page: 1 });
    expect(body.reports.map((report: { reason: string }) => report.reason)).toEqual(['child_abuse', 'spam']);
    expect(body.reports[0]).toMatchObject({
      target: 'message',
      note: 'es grave',
      priority: 'high',
      reporter: { id: String(ana), name: 'Ana' },
      reported: { id: String(beto), name: 'Beto' },
      chat: { id: String(channel), name: 'obra', kind: 'group' },
      space: { id: String(space), name: 'Inframaq' },
      evidence: { seq: 1, body: 'Te voy a buscar', senderId: String(beto) },
    });
  });

  it('resolves or dismisses one; it leaves the open list and shows among the closed', async () => {
    // Arrange
    const { body: created } = await request(app).post('/api/reports').set(auth(ana)).send({ target: 'user', userId: String(beto), reason: 'spam' }).expect(201);
    // Act
    await request(app).post(`/api/admin/reports/${created.reportId}/close`).set(auth(jose)).send({ outcome: 'resolved', note: 'Hablé con el admin' }).expect(200);
    // Assert
    expect((await request(app).get('/api/admin/reports').set(auth(jose)).expect(200)).body).toMatchObject({ total: 0, open: 0 });
    const closed = (await request(app).get('/api/admin/reports?estado=cerradas').set(auth(jose)).expect(200)).body;
    expect(closed.reports[0]).toMatchObject({ status: 'resolved', closedNote: 'Hablé con el admin' });
    await request(app).post(`/api/admin/reports/${created.reportId}/close`).set(auth(jose)).send({ outcome: 'reabrir' }).expect(400);
    await request(app).post(`/api/admin/reports/${new Types.ObjectId()}/close`).set(auth(jose)).send({ outcome: 'dismissed' }).expect(404);
  });
});
