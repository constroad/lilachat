import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import type { CommandNotice } from '@lilachat/shared';
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
import { BotAppModel, BotCommandRunModel, BotDeliveryModel, BotInstallationModel, OAuthCodeModel } from './botModels.js';
import { configureCommands } from './botCommands.js';
import { configureFormFiles, FormFileModel } from './botForms.js';
import { forgetBots } from './botRegistry.js';
import { sha256 } from './botSecrets.js';

/** App forms (R160, `specs/BOTS-API.spec.md` §c-ter): Inframaq's real `registrar_marca`. */
let mongo: MongoMemoryServer;
const app = buildApp({});
const REDIRECT = 'https://agentes.example.com/canales/lilachat/vuelta';
const SECRET = 'lcx_test-client-secret';
const VERIFIER = 'v'.repeat(64);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let spaceId: Types.ObjectId;
let channel: Types.ObjectId;
let hook: Server;
let hookUrl = '';
let botToken = '';
const botAuth = async () => ({ Authorization: `Bearer ${botToken}` });
type Event = { type: string; data: Record<string, unknown> };
const received: Event[] = [];
let answer: (event: Event, res: ServerResponse) => void = (_event, res) => res.end();
const stored = new Map<string, Buffer>();
const asUser = (userId: () => Types.ObjectId) => ({ get Authorization() { return `Bearer ${signSession({ userId: String(userId()), deviceId: `d-${userId()}`, email: 'x' })}`; } });
const asAna = asUser(() => ana);
const asJose = asUser(() => jose);
const json = (body: unknown) => (_event: Event, res: ServerResponse) => res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
const marca = {
  id: 'registrar_marca',
  title: 'Marcar asistencia',
  submit_label: 'Marcar',
  schema: {
    type: 'object',
    properties: {
      accion: { type: 'string', enum: ['ingreso', 'refrigerio', 'retorno', 'salida'], 'x-labels': { ingreso: 'Ingreso', refrigerio: 'Refrigerio', retorno: 'Retorno', salida: 'Salida' } },
      ubicacion: { type: 'object', 'x-input': 'location' },
      foto: { type: 'string', format: 'uri', 'x-input': 'photo' },
      actividades: { type: 'string', maxLength: 300 },
    },
    required: ['accion', 'ubicacion', 'foto'],
  },
};
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_bot_forms'));
  hook = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const event = { type: String(req.headers['x-lilachat-event']), data: JSON.parse(body || '{}').data ?? {} };
      received.push(event);
      answer(event, res);
    });
  });
  await new Promise<void>((resolve) => hook.listen(0, '127.0.0.1', resolve));
  hookUrl = `http://127.0.0.1:${(hook.address() as AddressInfo).port}/events`;
  configureCommands({ answerTimeoutMs: 300 });
  configureFormFiles({
    upload: async ({ bytes }) => {
      const url = `/media/test/${stored.size + 1}.jpg`;
      stored.set(url, bytes);
      return { ok: true, media: { url, sizeBytes: bytes.length, storageName: 'x.jpg' } };
    },
    read: async (url) => stored.get(url) ?? null,
  });
});
afterAll(async () => {
  hook.close();
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  received.length = 0;
  stored.clear();
  answer = (_event, res) => res.end();
  forgetBots();
  await Promise.all([UserModel, ChatModel, MessageModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel, OAuthCodeModel, BotDeliveryModel, BotCommandRunModel, FormFileModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  [jose, ana] = (await UserModel.create([{ phone: '51902049935', name: 'José' }, { phone: '51987654321', name: 'Ana' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  spaceId = (await WorkspaceModel.create({ name: 'INFRAMAQ', ownerId: jose, joinCode: 'INFR-7K3P' }))._id;
  await WorkspaceMemberModel.create([
    { workspaceId: spaceId, userId: jose, phone: '51902049935', role: 'owner', status: 'active' },
    { workspaceId: spaceId, userId: ana, phone: '51987654321', role: 'member', status: 'active' },
  ]);
  channel = (await ChatModel.create({ kind: 'group', name: 'planta', workspaceId: spaceId, channel: { visibility: 'public' }, members: [{ userId: jose, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 0 }))._id;
  await BotAppModel.create({ clientId: 'lca_inframaq', clientSecretHash: sha256(SECRET), name: 'Inframaq', redirectUris: [REDIRECT], webhookUrl: hookUrl, commands: [{ command: 'asistencia', description: 'Marcar asistencia' }] });
  const authorized = await request(app).post('/api/oauth/authorize').set(asJose).send({ client_id: 'lca_inframaq', redirect_uri: REDIRECT, state: 'state-0123456789abcdef', code_challenge: CHALLENGE, code_challenge_method: 'S256', space_id: String(spaceId), decision: 'approve' }).expect(200);
  botToken = (await request(app).post('/api/oauth/token').send({ grant_type: 'authorization_code', code: new URL(authorized.body.redirect).searchParams.get('code'), redirect_uri: REDIRECT, client_id: 'lca_inframaq', client_secret: SECRET, code_verifier: VERIFIER }).expect(200)).body.access_token;
});

const appId = async () => String((await BotAppModel.findOne({ clientId: 'lca_inframaq' }).lean())!._id);
async function openForm(): Promise<string> {
  answer = json({ response_type: 'form', form: marca });
  const outcome = await request(app).post(`/api/chats/${channel}/commands`).set(asAna).send({ app_id: await appId(), command: 'asistencia', text: '' }).expect(200);
  expect(outcome.body).toMatchObject({ outcome: 'form', response: { responseType: 'form', form: { id: 'registrar_marca', title: 'Marcar asistencia' } } });
  return outcome.body.commandId;
}
const uploadPhoto = (commandId: string, as = asAna) => request(app).post(`/api/chats/${channel}/commands/${commandId}/files`).set(as).attach('file', JPEG, { filename: 'selfie.jpg', contentType: 'image/jpeg' });
const submit = (commandId: string, values: Record<string, unknown>, as = asAna) => request(app).post(`/api/chats/${channel}/commands/${commandId}/form`).set(as).send({ values });
const here = { lat: -11.98, lng: -76.95, precision: 6 };

describe('an app answers a command with a form', () => {
  it('the asker gets the form; what is missing is said field by field before the app hears anything', async () => {
    // Arrange
    const commandId = await openForm();
    received.length = 0;
    // Act
    const missing = await submit(commandId, { accion: 'almuerzo' }).expect(422);
    // Assert
    expect(missing.body.errors).toEqual({ accion: 'Elige una de las opciones.', ubicacion: 'Falta tu ubicación.', foto: 'Falta la foto.' });
    expect(received).toEqual([]);
  });

  it('the photo goes to Lilachat; the app hears form.submitted with a signed address it can download once within 15 minutes', async () => {
    // Arrange
    const commandId = await openForm();
    const { fileId } = (await uploadPhoto(commandId).expect(201)).body;
    answer = json({ card: { title: 'Ingreso marcado', status: { label: '07:12', tone: 'ok' }, fields: [] }, shareable: false });
    received.length = 0;
    // Act
    const done = await submit(commandId, { accion: 'ingreso', ubicacion: here, foto: fileId, actividades: '  Tolva 2  ' }).expect(200);
    // Assert
    expect(done.body).toMatchObject({ outcome: 'ephemeral', response: { card: { title: 'Ingreso marcado' }, shareable: false } });
    const event = received[0]!;
    expect(event.type).toBe('form.submitted');
    expect(event.data).toMatchObject({ form_id: 'registrar_marca', command_id: commandId, values: { accion: 'ingreso', ubicacion: here, actividades: 'Tolva 2' }, user: { name: 'Ana', phone: '51987654321' }, channel: { id: String(channel), kind: 'channel' } });
    const photoUrl = new URL(String((event.data.values as Record<string, unknown>).foto));
    expect(photoUrl.pathname).toMatch(/^\/api\/bots\/files\/[\w-]+\.[\w-]+$/);
    const photo = await request(app).get(photoUrl.pathname).expect(200);
    expect(photo.headers['content-type']).toBe('image/jpeg');
    expect(Buffer.compare(photo.body as Buffer, JPEG)).toBe(0);
    await request(app).get(`${photoUrl.pathname}x`).expect(404);
  });

  it('the app\'s errors keep the form open with them; a late answer through /respond closes it', async () => {
    const commandId = await openForm();
    const { fileId } = (await uploadPhoto(commandId).expect(201)).body;
    answer = json({ errors: { accion: 'Ya marcaste ingreso hoy. Lo que sigue es: refrigerio.' } });
    const refused = await submit(commandId, { accion: 'ingreso', ubicacion: here, foto: fileId }).expect(422);
    expect(refused.body.errors).toEqual({ accion: 'Ya marcaste ingreso hoy. Lo que sigue es: refrigerio.' });
    answer = (_event, res) => res.end();
    const pending = await submit(commandId, { accion: 'refrigerio', ubicacion: here, foto: fileId }).expect(200);
    expect(pending.body.outcome).toBe('pending');
  });

  it('only who asked, with a photo of this form, while it lasts', async () => {
    const commandId = await openForm();
    await uploadPhoto(commandId, asJose).expect(404);
    const { fileId } = (await uploadPhoto(commandId).expect(201)).body;
    await submit(commandId, { accion: 'ingreso', ubicacion: here, foto: fileId }, asJose).expect(404);
    const otherForm = await openForm();
    expect((await submit(otherForm, { accion: 'ingreso', ubicacion: here, foto: fileId }).expect(422)).body.errors).toEqual({ foto: 'Falta la foto.' });
    await BotCommandRunModel.updateOne({ _id: commandId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await submit(commandId, { accion: 'ingreso', ubicacion: here, foto: fileId }).expect(410);
  });

  it('a shareable:false answer cannot be sent to the channel', async () => {
    answer = json({ text: 'Deuda: S/ 12 400', shareable: false });
    const { commandId } = (await request(app).post(`/api/chats/${channel}/commands`).set(asAna).send({ app_id: await appId(), command: 'asistencia', text: '' }).expect(200)).body;
    expect((await request(app).post(`/api/chats/${channel}/commands/${commandId}/share`).set(asAna).send({}).expect(409)).body.message).toMatch(/no se comparte/i);
    expect(await MessageModel.countDocuments({ chatId: channel })).toBe(0);
  });

  it('an action of the «+» opens the same form: the app hears shortcut.invoked with who and where', async () => {
    // Arrange
    await BotAppModel.updateOne({ clientId: 'lca_inframaq' }, { $set: { shortcuts: [{ key: 'marcar_asistencia', name: 'Marcar asistencia' }] } });
    answer = json({ response_type: 'form', form: marca });
    received.length = 0;
    // Act
    const opened = await request(app).post(`/api/chats/${channel}/shortcuts`).set(asAna).send({ app_id: await appId(), shortcut: 'marcar_asistencia' }).expect(200);
    // Assert
    expect(opened.body).toMatchObject({ outcome: 'form', response: { form: { id: 'registrar_marca' } } });
    expect(received).toEqual([{ type: 'shortcut.invoked', data: expect.objectContaining({ shortcut: 'marcar_asistencia', command_id: opened.body.commandId, user: expect.objectContaining({ name: 'Ana', phone: '51987654321' }), channel: expect.objectContaining({ id: String(channel) }) }) }]);
    expect(received[0]!.data).not.toHaveProperty('command');
    await request(app).post(`/api/chats/${channel}/shortcuts`).set(asAna).send({ app_id: await appId(), shortcut: 'otra' }).expect(404);
  });

  it('from the space\'s ⚡, outside any chat: channel null, the photo and the form by the space, the late answer to the asker', async () => {
    // Arrange
    await BotAppModel.updateOne({ clientId: 'lca_inframaq' }, { $set: { shortcuts: [{ key: 'marcar_asistencia', name: 'Marcar asistencia' }] } });
    const notices: { userId: string; notice: CommandNotice }[] = [];
    configureCommands({ notify: (userId, notice) => notices.push({ userId, notice }) });
    answer = json({ response_type: 'form', form: marca });
    const space = `/api/workspaces/${spaceId}`;
    // Act
    const opened = await request(app).post(`${space}/shortcuts`).set(asAna).send({ app_id: await appId(), shortcut: 'marcar_asistencia' }).expect(200);
    const { commandId } = opened.body;
    const { fileId } = (await request(app).post(`${space}/commands/${commandId}/files`).set(asAna).attach('file', JPEG, { filename: 'selfie.jpg', contentType: 'image/jpeg' }).expect(201)).body;
    answer = (_event, res) => res.end();
    const sent = await request(app).post(`${space}/commands/${commandId}/form`).set(asAna).send({ values: { accion: 'ingreso', ubicacion: here, foto: fileId } }).expect(200);
    const late = await request(app).post(`/api/bots/commands/${commandId}/respond`).set(await botAuth()).send({ text: 'Ingreso marcado · 07:12', shareable: false }).expect(200);
    // Assert
    expect(received.map((event) => [event.type, event.data.channel])).toEqual([['shortcut.invoked', null], ['form.submitted', null]]);
    expect(sent.body.outcome).toBe('pending');
    expect(late.body.response_type).toBe('ephemeral');
    expect(notices).toEqual([{ userId: String(ana), notice: expect.objectContaining({ workspaceId: String(spaceId), commandId, response: expect.objectContaining({ text: 'Ingreso marcado · 07:12' }) }) }]);
    expect(notices[0]!.notice).not.toHaveProperty('chatId');
    await submit(commandId, { accion: 'ingreso', ubicacion: here, foto: fileId }).expect(404);
    const stranger = (await UserModel.create({ phone: '51911111111', name: 'Otro' }))._id;
    await request(app).post(`${space}/shortcuts`).set(asUser(() => stranger)).send({ app_id: await appId(), shortcut: 'marcar_asistencia' }).expect(404);
    configureCommands({ notify: () => undefined });
  });
});

describe('where each command and action works (José, 23/10: only some are global)', () => {
  const groupsAt = (query: string) => request(app).get(`/api/workspaces/${spaceId}/commands?${query}`).set(asAna).expect(200).then((res) => res.body.groups as { commands: { command: string }[]; shortcuts: { key: string }[] }[]);
  const names = (groups: { commands: { command: string }[]; shortcuts: { key: string }[] }[]) => groups.flatMap((group) => [...group.commands.map((entry) => `/${entry.command}`), ...group.shortcuts.map((entry) => entry.key)]);

  it('untouched: the action is in the ⚡ and in the channels, the command only in the channels', async () => {
    await BotAppModel.updateOne({ clientId: 'lca_inframaq' }, { $set: { shortcuts: [{ key: 'marcar_asistencia', name: 'Marcar asistencia' }] } });
    expect(names(await groupsAt('place=space'))).toEqual(['marcar_asistencia']);
    expect(names(await groupsAt(`chat=${channel}`))).toEqual(['/asistencia', 'marcar_asistencia']);
  });

  it('the admin makes the command global and takes the action out of the channels; the server refuses what is off', async () => {
    // Arrange
    await BotAppModel.updateOne({ clientId: 'lca_inframaq' }, { $set: { shortcuts: [{ key: 'marcar_asistencia', name: 'Marcar asistencia' }] } });
    const items = `/api/workspaces/${spaceId}/apps/${await appId()}/items`;
    await request(app).put(items).set(asAna).send({ items: { 'command:asistencia': { global: true } } }).expect(403);
    // Act
    const saved = await request(app).put(items).set(asJose).send({ items: { 'command:asistencia': { global: true }, 'shortcut:marcar_asistencia': { channels: 'none' } } }).expect(200);
    answer = json({ text: 'Hoy: 12 de 15' });
    received.length = 0;
    const fromSpace = await request(app).post(`/api/workspaces/${spaceId}/commands`).set(asAna).send({ app_id: await appId(), command: 'asistencia', text: '' }).expect(200);
    const offInChannel = await request(app).post(`/api/chats/${channel}/shortcuts`).set(asAna).send({ app_id: await appId(), shortcut: 'marcar_asistencia' }).expect(404);
    // Assert
    expect(saved.body.items).toEqual([
      { kind: 'shortcut', key: 'marcar_asistencia', name: 'Marcar asistencia', global: true, channels: 'none' },
      { kind: 'command', key: 'asistencia', name: '/asistencia', description: 'Marcar asistencia', global: true, channels: 'all' },
    ]);
    expect(names(await groupsAt('place=space'))).toEqual(['/asistencia', 'marcar_asistencia']);
    expect(names(await groupsAt(`chat=${channel}`))).toEqual(['/asistencia']);
    expect(fromSpace.body).toMatchObject({ outcome: 'ephemeral', response: { text: 'Hoy: 12 de 15' } });
    expect(received.map((event) => [event.type, event.data.channel])).toEqual([['command.invoked', null]]);
    expect(offInChannel.body.message).toMatch(/habilitado/);
    expect((await request(app).get(items).set(asAna).expect(200)).body.canEdit).toBe(false);
  });
});
