import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from '../testMongo.js';
import { buildApp } from '../app.js';
import { UserModel } from '../models.js';
import { ChatModel } from '../chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../workspaceModels.js';
import { signSession } from '../sessions.js';
import { BotAppModel, BotInstallationModel } from './botModels.js';
import { ClientChannelModel } from './botClients.js';

/** Pending 121 (agentes c27e939): the service's Drive, asked to the app with `client.files.requested`. */
let mongo: MongoMemoryServer;
let hook: Server;
let hookUrl = '';
let answer: { status: number; body: unknown } = { status: 200, body: {} };
let received: { type?: string; data?: Record<string, unknown>; space?: string }[] = [];
let jose: Types.ObjectId;
let outsider: Types.ObjectId;
let spaceId: Types.ObjectId;
const app = buildApp();
const auth = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x@x.com' })}` });
const filesOf = (who: Types.ObjectId, service = 'srv-318', client = 'cli-cvs') => request(app).get(`/api/workspaces/${spaceId}/clients/${client}/services/${service}/files`).set(auth(who));

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_client_files_test'));
  hook = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    req.on('end', () => {
      const event = JSON.parse(raw) as { type?: string; data?: Record<string, unknown>; space_id?: string };
      received.push({ type: event.type, data: event.data, space: event.space_id });
      res.writeHead(answer.status, { 'Content-Type': 'application/json' }).end(JSON.stringify(answer.body));
    });
  });
  await new Promise<void>((resolve) => hook.listen(0, '127.0.0.1', resolve));
  const address = hook.address();
  hookUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/v1/channels/lilachat/events`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => hook.close(() => resolve()));
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  received = [];
  answer = { status: 200, body: { files: [{ name: 'densidades.pdf', mime: 'application/pdf', url: 'https://lila.constroad.com/f/1', folder: 'Informes', size_bytes: 1800000 }], drive_url: 'https://drive.google.com/drive/folders/x' } };
  await Promise.all([UserModel, ChatModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel, ClientChannelModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  [jose, outsider] = (await UserModel.create([{ phone: '51902049935', name: 'José' }, { phone: '51911111111', name: 'Otro' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  spaceId = (await WorkspaceModel.create({ name: 'Test', ownerId: jose, joinCode: 'TEST-7K3P' }))._id;
  await WorkspaceMemberModel.create([{ workspaceId: spaceId, userId: jose, phone: '51902049935', role: 'owner', status: 'active' }, { workspaceId: spaceId, userId: outsider, phone: '51911111111', role: 'member', status: 'active' }]);
  const botUser = (await UserModel.create({ phone: 'bot-portal', name: 'Portal' }))._id;
  const appDoc = await BotAppModel.create({ clientId: 'lca_portal', clientSecretHash: 'x', name: 'Portal', redirectUris: ['https://agentes.example.com/cb'], webhookUrl: hookUrl });
  await BotInstallationModel.create({ appId: appDoc._id, workspaceId: spaceId, botUserId: botUser, tokenHash: 'h1', signingSecret: 'secret', installedBy: jose });
  const chat = await ChatModel.create({ kind: 'group', name: 'constructora-via-sur', workspaceId: spaceId, channel: { visibility: 'private' }, members: [{ userId: botUser, role: 'member' }, { userId: jose, role: 'admin' }], lastSeq: 0 });
  await ClientChannelModel.create({ workspaceId: spaceId, appId: appDoc._id, clientId: 'cli-cvs', chatId: chat._id, name: 'Constructora Vía Sur', services: [{ id: 'srv-318', name: 'Pavimentación', status: 'in_progress', url: 'https://portal.example.com/s/318' }] });
});

describe('the service Drive on demand', () => {
  it('asks the app with client, service and who; answers its files', async () => {
    // Act
    const response = await filesOf(jose).expect(200);
    // Assert
    expect(received).toEqual([{ type: 'client.files.requested', space: String(spaceId), data: { client_id: 'cli-cvs', service_id: 'srv-318', user: { id: String(jose), name: 'José', phone: '51902049935' } } }]);
    expect(response.body.files).toEqual([expect.objectContaining({ name: 'densidades.pdf', folder: 'Informes', sizeBytes: 1800000 })]);
    expect(response.body.drive_url).toBe('https://drive.google.com/drive/folders/x');
  });

  it('a Drive of 200 files (well over 64 KB of JSON) arrives whole (agentes, 30/10: 149 files read as «sin respuesta»)', async () => {
    // Arrange
    const files = Array.from({ length: 200 }, (_, index) => ({ name: `informe-de-densidades-de-campo-km-12-tramo-norte-${index}.pdf`, mime: 'application/pdf', url: `https://lila.constroad.com/f/archivo-largo-${index}`, thumb_url: `https://lila.constroad.com/t/miniatura-${index}`, folder: 'Informes de laboratorio de suelos y asfalto', size_bytes: 1800000, modified_at: '2026-10-30T11:17:22.000Z' }));
    answer = { status: 200, body: { files, drive_url: 'https://drive.google.com/drive/folders/x' } };
    expect(JSON.stringify(answer.body).length).toBeGreaterThan(64_000);
    // Act
    const response = await filesOf(jose).expect(200);
    // Assert
    expect(response.body.files).toHaveLength(200);
  });

  it('a service the app did not list, another client, or someone outside the channel: 404 and no event', async () => {
    expect((await filesOf(jose, 'srv-999')).status).toBe(404);
    expect((await filesOf(jose, 'srv-318', 'otro')).status).toBe(404);
    expect((await filesOf(outsider)).status).toBe(404);
    expect((await filesOf(jose, 'srv 318')).status).toBe(404);
    expect(received).toHaveLength(0);
  });

  it('the app fails (502, product_failed): «No se pudo traer el Drive» with the service link', async () => {
    answer = { status: 502, body: { error: 'No se pudo traer el Drive', code: 'product_failed' } };
    const response = await filesOf(jose).expect(200);
    expect(response.body).toEqual({ error: 'drive_failed', message: 'No se pudo traer el Drive', drive_url: 'https://portal.example.com/s/318' });
  });
});
