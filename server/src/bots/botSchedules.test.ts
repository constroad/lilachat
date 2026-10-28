import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server, type ServerResponse } from 'node:http';
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
import { BotAppModel, BotCommandRunModel, BotDeliveryModel, BotInstallationModel, type BotInstallation } from './botModels.js';
import { configureCommands, respondToCommand } from './botCommands.js';
import { forgetBots } from './botRegistry.js';
import { installApp } from './botInstall.js';
import { runDueSchedules } from './botSchedules.js';
import { AppScheduleModel } from './scheduleModels.js';
import { openEveryItem } from './testItems.js';

/**
 * Schedules (José, 28/10; agentes COMANDOS-Y-HORARIOS §3): an admin programs
 * a read command; at its hour it runs AS that admin, posts its report once,
 * honors «solo si hay algo», and tells the creator when it could not run.
 */
let mongo: MongoMemoryServer;
const app = buildApp({});
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let spaceId: Types.ObjectId;
let planta: Types.ObjectId;
let appId: string;
let installation: BotInstallation;
let hook: Server;
let hookUrl = '';
const received: { type: string; event_id: string; data: Record<string, unknown> }[] = [];
let answer: (res: ServerResponse) => void = (res) => res.end();
const asUser = (userId: () => Types.ObjectId) => ({ get Authorization() { return `Bearer ${signSession({ userId: String(userId()), deviceId: `d-${userId()}`, email: 'x' })}`; } });
const asJose = asUser(() => jose);
const asAna = asUser(() => ana);
const json = (body: unknown) => (res: ServerResponse) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};
const schedules = () => `/api/workspaces/${spaceId}/apps/${appId}/schedules`;
const create = (body: Record<string, unknown>, as = asJose) => request(app).post(schedules()).set(as).send({ command: 'asistencia', time: '10:30', repeat: { weekdays: [1, 2, 3, 4, 5, 6] }, chat_id: String(planta), ...body });
// 28/10/2026 is a Wednesday; 10:30 in Lima is 15:30 UTC.
const SLOT = new Date('2026-10-28T15:30:00Z');
const slotFor = async (id: string) => AppScheduleModel.updateOne({ _id: id }, { $set: { nextRunAt: SLOT } });
const botMessagesIn = (chatId: Types.ObjectId | string) => MessageModel.find({ chatId, senderId: installation.botUserId }).lean();

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_bot_schedules'));
  hook = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      received.push(JSON.parse(body));
      answer(res);
    });
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
  received.length = 0;
  answer = json({ response_type: 'in_channel', text: 'Asistencia: 12 de 15' });
  forgetBots();
  await Promise.all([UserModel, ChatModel, MessageModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel, BotDeliveryModel, BotCommandRunModel, AppScheduleModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  [jose, ana] = (await UserModel.create([{ phone: '902049935', name: 'José' }, { phone: '987654321', name: 'Ana' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  spaceId = (await WorkspaceModel.create({ name: 'INFRAMAQ', ownerId: jose, joinCode: 'INFR-7K3P' }))._id;
  await WorkspaceMemberModel.create([
    { workspaceId: spaceId, userId: jose, phone: '902049935', role: 'owner', status: 'active' },
    { workspaceId: spaceId, userId: ana, phone: '987654321', role: 'member', status: 'active' },
  ]);
  const bot = await BotAppModel.create({
    clientId: 'lca_inframaq', clientSecretHash: 'x', name: 'Inframaq', redirectUris: ['https://agentes.example.com/vuelta'], webhookUrl: hookUrl,
    commands: [{ command: 'asistencia', description: 'Asistencia del día', schedulable: true }, { command: 'planilla', description: 'Planilla', schedulable: true, shareable: false }, { command: 'marcar', description: 'Marcar' }],
    suggestedSchedules: [{ command: 'asistencia', text: '', time: '10:30', repeat: { weekdays: [1, 2, 3, 4, 5, 6] }, onlyIfSomething: false }, { command: 'asistencia', text: '', time: '18:30', repeat: { weekdays: [1, 2, 3, 4, 5, 6] }, onlyIfSomething: false }],
  });
  appId = String(bot._id);
  installation = (await installApp({ app: bot.toObject(), workspaceId: spaceId, installedBy: jose })).installation;
  planta = (await ChatModel.create({ kind: 'group', name: 'planta', workspaceId: spaceId, channel: { visibility: 'public' }, members: [{ userId: jose, role: 'admin' }, { userId: ana, role: 'member' }, { userId: installation.botUserId, role: 'member' }], lastSeq: 0 }))._id;
  await openEveryItem();
});

describe('creating a schedule', () => {
  it('an admin programs a read command in a channel; a member cannot', async () => {
    const created = await create({}).expect(201);
    expect(created.body.schedule).toMatchObject({ command: 'asistencia', time: '10:30', where: { kind: 'channel', name: 'planta' }, active: true });
    await create({}, asAna).expect(403);
    const listed = (await request(app).get(schedules()).set(asAna).expect(200)).body;
    expect(listed.schedules).toHaveLength(1);
    expect(listed.canEdit).toBe(false);
    // The 10:30 suggestion is taken; the 18:30 one is still offered.
    expect(listed.suggested.map((one: { time: string }) => one.time)).toEqual(['18:30']);
  });

  it('refuses a form, amounts in a channel, a channel without the app, and a command that is off there', async () => {
    expect((await create({ command: 'marcar' }).expect(400)).body.message).toBe('/marcar no se puede programar: solo se programan consultas.');
    expect((await create({ command: 'planilla' }).expect(400)).body.message).toBe('/planilla tiene montos: solo se programa en tu chat con la app.');
    await create({ command: 'planilla', chat_id: 'direct' }).expect(201);
    const flota = (await ChatModel.create({ kind: 'group', name: 'flota', workspaceId: spaceId, channel: { visibility: 'public' }, members: [{ userId: jose, role: 'admin' }], lastSeq: 0 }))._id;
    expect((await create({ chat_id: String(flota) }).expect(409)).body.message).toBe('Inframaq no está en #flota: agrégala en Ajustes.');
    await request(app).put(`/api/workspaces/${spaceId}/apps/${appId}/items`).set(asJose).send({ items: { 'command:asistencia': { channels: 'none' } } }).expect(200);
    expect((await create({}).expect(400)).body.message).toBe('/asistencia no está encendido en #planta.');
  });
});

describe('at its hour', () => {
  it('runs as the creator with trigger «schedule», posts once, and moves to the next slot', async () => {
    const { id } = (await create({}).expect(201)).body.schedule;
    await slotFor(id);
    expect(await runDueSchedules(new Date('2026-10-28T15:30:20Z'))).toBe(1);
    expect(await runDueSchedules(new Date('2026-10-28T15:31:00Z'))).toBe(0);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ type: 'command.invoked', data: { command: 'asistencia', text: '', trigger: 'schedule', schedule_id: id, scheduled_for: SLOT.toISOString(), user: { id: String(jose) } } });
    expect((await botMessagesIn(planta)).map((message) => message.body)).toEqual(['Asistencia: 12 de 15']);
    const after = await AppScheduleModel.findById(id).lean();
    expect(after?.nextRunAt.toISOString()).toBe('2026-10-29T15:30:00.000Z');
    expect(after?.lastRun).toMatchObject({ outcome: 'posted' });
  });

  it('«solo si hay algo» with nothing to report posts nothing', async () => {
    answer = json({ response_type: 'in_channel', text: 'Todos marcaron', nothing_to_report: true });
    const { id } = (await create({ only_if_something: true }).expect(201)).body.schedule;
    await slotFor(id);
    await runDueSchedules(new Date('2026-10-28T15:30:20Z'));
    expect(await botMessagesIn(planta)).toEqual([]);
    expect((await AppScheduleModel.findById(id).lean())?.lastRun).toMatchObject({ outcome: 'nothing' });
  });

  it('an ephemeral answer (an error, «conecta tu cuenta») reaches only the creator, in their 1:1 with the app', async () => {
    answer = json({ response_type: 'ephemeral', text: 'Conecta tu cuenta de Inframaq para usar /asistencia.' });
    const { id } = (await create({}).expect(201)).body.schedule;
    await slotFor(id);
    await runDueSchedules(new Date('2026-10-28T15:30:20Z'));
    expect(await botMessagesIn(planta)).toEqual([]);
    const direct = await ChatModel.findOne({ kind: 'direct', 'members.userId': { $all: [jose, installation.botUserId] } }).lean();
    expect((await botMessagesIn(direct!._id)).map((message) => message.body)).toEqual(['El horario de /asistencia de las 10:30 no corrió: Conecta tu cuenta de Inframaq para usar /asistencia.']);
  });

  it('more than 30 minutes late it is missed: the app is not called and the creator is told', async () => {
    const { id } = (await create({}).expect(201)).body.schedule;
    await slotFor(id);
    await runDueSchedules(new Date('2026-10-28T16:01:00Z'));
    expect(received).toEqual([]);
    expect((await AppScheduleModel.findById(id).lean())?.lastRun).toMatchObject({ outcome: 'missed' });
  });

  it('place and permission are checked again: switched off there, it does not run and says why', async () => {
    const { id } = (await create({}).expect(201)).body.schedule;
    await slotFor(id);
    await request(app).put(`/api/workspaces/${spaceId}/apps/${appId}/items`).set(asJose).send({ items: { 'command:asistencia': { channels: 'none' } } }).expect(200);
    await runDueSchedules(new Date('2026-10-28T15:30:20Z'));
    expect(received).toEqual([]);
    expect((await AppScheduleModel.findById(id).lean())?.lastRun).toMatchObject({ outcome: 'refused', message: '/asistencia no está encendido en #planta.' });
  });

  it('a late answer by /respond follows the schedule: it goes to the channel', async () => {
    answer = (res) => res.end();
    const { id } = (await create({}).expect(201)).body.schedule;
    await slotFor(id);
    await runDueSchedules(new Date('2026-10-28T15:30:20Z'));
    expect((await AppScheduleModel.findById(id).lean())?.lastRun).toMatchObject({ outcome: 'pending' });
    const fresh = (await BotInstallationModel.findById(installation._id).lean())!;
    expect(await respondToCommand(fresh, String(received[0]!.data.command_id), { response_type: 'in_channel', text: 'Asistencia tardía: 13 de 15' })).toEqual({ response_type: 'in_channel' });
    expect((await botMessagesIn(planta)).map((message) => message.body)).toEqual(['Asistencia tardía: 13 de 15']);
  });

  it('an admin pauses and deletes it', async () => {
    const { id } = (await create({}).expect(201)).body.schedule;
    await request(app).patch(`${schedules()}/${id}`).set(asAna).send({ active: false }).expect(403);
    await request(app).patch(`${schedules()}/${id}`).set(asJose).send({ active: false }).expect(200);
    await slotFor(id);
    expect(await runDueSchedules(new Date('2026-10-28T15:30:20Z'))).toBe(0);
    await request(app).delete(`${schedules()}/${id}`).set(asJose).expect(200);
    expect(await AppScheduleModel.countDocuments()).toBe(0);
  });
});
