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
let ana: Types.ObjectId;
let spaceId: Types.ObjectId;
const app = buildApp();
const auth = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x@x.com' })}` });
const detailOf = (who: Types.ObjectId, service = 'srv-318') => request(app).get(`/api/workspaces/${spaceId}/clients/cli-cvs/services/${service}/detail`).set(auth(who));
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
  [jose, outsider, ana] = (await UserModel.create([{ phone: '51902049935', name: 'José' }, { phone: '51911111111', name: 'Otro' }, { phone: '51922222222', name: 'Ana' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  spaceId = (await WorkspaceModel.create({ name: 'Test', ownerId: jose, joinCode: 'TEST-7K3P' }))._id;
  await WorkspaceMemberModel.create([{ workspaceId: spaceId, userId: jose, phone: '51902049935', role: 'owner', status: 'active' }, { workspaceId: spaceId, userId: outsider, phone: '51911111111', role: 'member', status: 'active' }, { workspaceId: spaceId, userId: ana, phone: '51922222222', role: 'member', status: 'active' }]);
  const botUser = (await UserModel.create({ phone: 'bot-portal', name: 'Portal' }))._id;
  const appDoc = await BotAppModel.create({ clientId: 'lca_portal', clientSecretHash: 'x', name: 'Portal', redirectUris: ['https://agentes.example.com/cb'], webhookUrl: hookUrl });
  await BotInstallationModel.create({ appId: appDoc._id, workspaceId: spaceId, botUserId: botUser, tokenHash: 'h1', signingSecret: 'secret', installedBy: jose });
  const chat = await ChatModel.create({ kind: 'group', name: 'constructora-via-sur', workspaceId: spaceId, channel: { visibility: 'private' }, members: [{ userId: botUser, role: 'member' }, { userId: jose, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 0 });
  await ClientChannelModel.create({ workspaceId: spaceId, appId: appDoc._id, clientId: 'cli-cvs', chatId: chat._id, name: 'Constructora Vía Sur', services: [{ id: 'srv-318', name: 'Pavimentación', status: 'in_progress', url: 'https://portal.example.com/s/318' }] });
});

describe('the service Drive on demand', () => {
  it('asks the app with client, service and who; answers its files', async () => {
    // Act
    const response = await filesOf(jose).expect(200);
    // Assert
    expect(received).toEqual([{ type: 'client.files.requested', space: String(spaceId), data: { client_id: 'cli-cvs', service_id: 'srv-318', user: { id: String(jose), name: 'José', phone: '51902049935', sees_billing: true } } }]);
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

describe('the service detail on demand (José, 30/10: pedidos, despachos e informes)', () => {
  it('asks the app with client.service.requested and answers the validated detail', async () => {
    // Arrange
    answer = { status: 200, body: { service: { id: 'srv-318', name: 'Pavimentación', status: 'in_progress', stage_label: 'Ejecución', progress: 40 }, orders: [{ id: 'o1', date: '2026-10-12', product: 'Asfalto', quantity: 24, unit: 'm³', status_label: 'Despachado', tone: 'ok' }], dispatches: [], reports: [], totals: { orders: 148, dispatches: 0, reports: 0 } } };
    // Act
    const response = await detailOf(jose).expect(200);
    // Assert
    expect(received).toEqual([{ type: 'client.service.requested', space: String(spaceId), data: { client_id: 'cli-cvs', service_id: 'srv-318', user: { id: String(jose), name: 'José', phone: '51902049935', sees_billing: true } } }]);
    expect(response.body.detail.orders).toEqual([{ id: 'o1', date: '2026-10-12', product: 'Asfalto', quantity: 24, unit: 'm³', status: { label: 'Despachado', tone: 'ok' } }]);
    expect(response.body.detail.totals.orders).toBe(148);
  });

  it('a service the app did not list or someone outside the channel: 404 and no event; a failure says so with the Portal link', async () => {
    expect((await detailOf(jose, 'srv-999')).status).toBe(404);
    expect((await detailOf(outsider)).status).toBe(404);
    expect(received).toHaveLength(0);
    answer = { status: 503, body: { error: 'Sin lector', code: 'not-configured' } };
    const failed = await detailOf(jose).expect(200);
    expect(failed.body).toEqual({ error: 'detail_failed', message: 'No se pudo traer el detalle del servicio', portal_url: 'https://portal.example.com/s/318' });
  });
});


describe('who sees the collection (José 30/10: «los admins y podemos asignar algún otro miembro del canal»)', () => {
  const viewersOf = (who: Types.ObjectId) => request(app).get(`/api/workspaces/${spaceId}/clients/cli-cvs/billing-viewers`).set(auth(who));
  const mark = (who: Types.ObjectId, target: Types.ObjectId, sees: boolean) => request(app).put(`/api/workspaces/${spaceId}/clients/cli-cvs/billing-viewers/${target}`).set(auth(who)).send({ sees });
  const seesBillingSent = () => (received.at(-1)?.data?.user as { sees_billing?: boolean } | undefined)?.sees_billing;

  it('a channel member who is not an admin does not get sees_billing', async () => {
    // Act
    await detailOf(ana).expect(200);
    // Assert
    expect(seesBillingSent()).toBeUndefined();
  });

  it('an admin marks her and she gets it on the detail and the Drive; unmarked, it goes away', async () => {
    // Act
    expect((await mark(jose, ana, true).expect(200)).body).toEqual({ viewers: [String(ana)] });
    await detailOf(ana).expect(200);
    const afterMark = seesBillingSent();
    await filesOf(ana).expect(200);
    const onDrive = seesBillingSent();
    await mark(jose, ana, false).expect(200);
    await detailOf(ana).expect(200);
    // Assert
    expect(afterMark).toBe(true);
    expect(onDrive).toBe(true);
    expect(seesBillingSent()).toBeUndefined();
    expect((await viewersOf(jose).expect(200)).body).toEqual({ viewers: [] });
  });

  it('marking twice keeps one; only admins mark or list; only members of the channel can be marked', async () => {
    await mark(jose, ana, true).expect(200);
    expect((await mark(jose, ana, true).expect(200)).body.viewers).toEqual([String(ana)]);
    expect((await mark(ana, ana, true)).status).toBe(403);
    expect((await viewersOf(ana)).status).toBe(403);
    expect((await mark(jose, outsider, true)).status).toBe(404);
    expect((await request(app).put(`/api/workspaces/${spaceId}/clients/otro/billing-viewers/${ana}`).set(auth(jose)).send({ sees: true })).status).toBe(404);
    expect((await mark(jose, ana, 'si' as unknown as boolean)).status).toBe(400);
  });
});

describe('the client account on demand (José 30/10: «¿dónde veo las cotizaciones del cliente?», design f-08)', () => {
  const accountOf = (who: Types.ObjectId, client = 'cli-cvs') => request(app).get(`/api/workspaces/${spaceId}/clients/${client}/account`).set(auth(who));

  it('asks with client.account.requested, without a service, and answers the validated account', async () => {
    // Arrange
    answer = { status: 200, body: { client: { id: 'cli-cvs', name: 'Constructora Vía Sur' }, quotes: [{ id: 'q1', code: '313', date: '2026-08-28', total: 1000, status_label: 'Borrador', tone: 'neutral' }], credit_orders: [], pending: 0, totals: { quotes: 1, credit_orders: 0 } } };
    // Act
    const response = await accountOf(jose).expect(200);
    // Assert
    expect(received).toEqual([{ type: 'client.account.requested', space: String(spaceId), data: { client_id: 'cli-cvs', user: { id: String(jose), name: 'José', phone: '51902049935', sees_billing: true } } }]);
    expect(response.body.account.quotes).toEqual([{ id: 'q1', code: '313', date: '2026-08-28', total: 1000, status: { label: 'Borrador', tone: 'neutral' } }]);
    expect(response.body.account.totals).toEqual({ quotes: 1, creditOrders: 0 });
  });

  it('another client or someone outside the channel: 404 and no event; a failure says so', async () => {
    expect((await accountOf(outsider)).status).toBe(404);
    expect((await accountOf(jose, 'otro')).status).toBe(404);
    expect(received).toHaveLength(0);
    answer = { status: 502, body: { error: 'No se pudo traer la cuenta del cliente', code: 'product_failed' } };
    expect((await accountOf(jose).expect(200)).body).toEqual({ error: 'account_failed', message: 'No se pudo traer la cuenta del cliente', portal_url: null });
  });
});

describe('a report\'s PDF on demand (agentes 30/10, Portal 588e3ff9: client.report.requested)', () => {
  const pdfOf = (who: Types.ObjectId, service = 'srv-318', report = 'rep-1') => request(app).get(`/api/workspaces/${spaceId}/clients/cli-cvs/services/${service}/reports/${report}/pdf`).set(auth(who));

  it('asks with client, service and report; answers ready with its link or generating with the wait', async () => {
    // Arrange
    answer = { status: 200, body: { status: 'ready', pdf_url: 'https://lila.example.com/f/rep-1.pdf' } };
    // Act
    const ready = await pdfOf(jose).expect(200);
    // Assert
    expect(received).toEqual([{ type: 'client.report.requested', space: String(spaceId), data: { client_id: 'cli-cvs', service_id: 'srv-318', report_id: 'rep-1', user: { id: String(jose), name: 'José', phone: '51902049935', sees_billing: true } } }]);
    expect(ready.body).toEqual({ pdf: { status: 'ready', pdfUrl: 'https://lila.example.com/f/rep-1.pdf' } });
    answer = { status: 200, body: { status: 'generating', retry_after_s: 5 } };
    expect((await pdfOf(jose).expect(200)).body).toEqual({ pdf: { status: 'generating', retryAfterS: 5 } });
  });

  it('a service the app did not list, a bad report id or someone outside: 404 and no event; a failure says so', async () => {
    expect((await pdfOf(jose, 'srv-999')).status).toBe(404);
    expect((await pdfOf(jose, 'srv-318', 'mal id')).status).toBe(404);
    expect((await pdfOf(outsider)).status).toBe(404);
    expect(received).toHaveLength(0);
    answer = { status: 502, body: { error: 'No se pudo traer el PDF del informe', code: 'product_failed' } };
    expect((await pdfOf(jose).expect(200)).body).toEqual({ error: 'report_pdf_failed', message: 'No se pudo traer el PDF del informe' });
  });
});
