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
import { BotAppModel, BotCommandRunModel, BotInstallationModel } from './botModels.js';
import { ClientChannelModel } from './botClients.js';
import { ReportDraftModel } from './clientReports.js';

/** A field report filled from the channel (José 05/11, spec INFORMES-DESDE-LILACHAT §4.2): the document, then each section as a form. */
let mongo: MongoMemoryServer;
let hook: Server;
let hookUrl = '';
let answers: Record<string, { status: number; body: unknown }> = {};
let received: { type?: string; data?: Record<string, unknown> }[] = [];
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let outsider: Types.ObjectId;
let spaceId: Types.ObjectId;
let chatId: Types.ObjectId;
const app = buildApp();
const auth = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x@x.com' })}` });
const base = () => `/api/workspaces/${spaceId}/clients/cli-cvs/services/srv-318/reports`;
const draftOf = (who: Types.ObjectId, body: Record<string, unknown> = { type: 'CTL-IMP' }) => request(app).post(`${base()}/draft`).set(auth(who)).send(body);
const openOf = (who: Types.ObjectId, body: Record<string, unknown>) => request(app).post(`${base()}/forms`).set(auth(who)).send(body);

const generalForm = { type: 'object', properties: { liquido: { type: 'string', title: 'Líquido', oneOf: [{ const: 'MC-30', title: 'MC-30' }, { const: 'EMULSION', title: 'Emulsión' }] }, responsable: { type: 'string', title: 'Responsable' } }, required: ['liquido', 'responsable'] };
const ubicacionForm = { type: 'object', properties: { tramo: { type: 'string', title: 'Tramo' } }, required: ['tramo'] };
const fotosForm = { type: 'object', properties: { foto: { type: 'string', title: 'Foto', 'x-input': 'photo' }, descripcion: { type: 'string', title: 'Descripción', maxLength: 200 } }, required: ['foto'] };
const document = {
  id: null, type: 'CTL-IMP', title: 'Control de imprimación', status: 'draft',
  forms: { general: generalForm, ubicacion: ubicacionForm, fotos: fotosForm },
  sections: [
    { id: 'general', title: 'Datos generales', required: true, state: 'empty', summary: [], results: [], form: 'general', values: { responsable: 'Ana Torres' } },
    { id: 'tramos', title: 'Tramos', required: true, enabled: false, state: 'empty', summary: [], repeat: { itemTitle: 'Tramo', addLabel: 'Agregar tramo', min: 1, template: [{ id: 'ubicacion', title: 'Ubicación', required: true, form: 'ubicacion' }, { id: 'fotos', title: 'Fotos', required: false, form: 'fotos', tool: 'agregar_foto_de_informe' }] }, items: [] },
  ],
  publish: { label: 'Publicar informe', missing: ['Faltan los datos generales'] },
};

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_client_reports_test'));
  hook = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    req.on('end', () => {
      const event = JSON.parse(raw) as { type?: string; data?: Record<string, unknown> };
      received.push({ type: event.type, data: event.data });
      const answer = answers[event.type ?? ''] ?? { status: 200, body: {} };
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
  answers = { 'client.report.draft.requested': { status: 200, body: document }, 'form.submitted': { status: 200, body: { response_type: 'ephemeral', text: 'Guardado.' } } };
  await Promise.all([UserModel, ChatModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel, BotCommandRunModel, ClientChannelModel, ReportDraftModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  [jose, ana, outsider] = (await UserModel.create([{ phone: '51902049935', name: 'José' }, { phone: '51922222222', name: 'Ana' }, { phone: '51911111111', name: 'Otro' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  spaceId = (await WorkspaceModel.create({ name: 'Test', ownerId: jose, joinCode: 'TEST-7K3P' }))._id;
  await WorkspaceMemberModel.create([{ workspaceId: spaceId, userId: jose, phone: '51902049935', role: 'owner', status: 'active' }, { workspaceId: spaceId, userId: ana, phone: '51922222222', role: 'member', status: 'active' }, { workspaceId: spaceId, userId: outsider, phone: '51911111111', role: 'member', status: 'active' }]);
  const botUser = (await UserModel.create({ phone: 'bot-portal', name: 'Portal' }))._id;
  const appDoc = await BotAppModel.create({ clientId: 'lca_portal', clientSecretHash: 'x', name: 'Portal', redirectUris: ['https://agentes.example.com/cb'], webhookUrl: hookUrl });
  await BotInstallationModel.create({ appId: appDoc._id, workspaceId: spaceId, botUserId: botUser, tokenHash: 'h1', signingSecret: 'secret', installedBy: jose });
  chatId = (await ChatModel.create({ kind: 'group', name: 'consorcio-vial', workspaceId: spaceId, channel: { visibility: 'private' }, members: [{ userId: botUser, role: 'member' }, { userId: jose, role: 'admin' }, { userId: ana, role: 'member' }] }))._id;
  await ClientChannelModel.create({ workspaceId: spaceId, appId: appDoc._id, clientId: 'cli-cvs', chatId, name: 'Consorcio Vial del Pacífico', services: [{ id: 'srv-318', name: 'Imprimación Av. Los Incas', status: 'in_progress', url: 'https://portal.example.com/s/318' }] });
});

describe('the document', () => {
  it('asks Portal for the draft with client, service, type and who; a plain member may', async () => {
    const response = await draftOf(ana).expect(200);

    expect(response.body.document).toMatchObject({ id: null, type: 'CTL-IMP', sections: [{ id: 'general', kind: 'form' }, { id: 'tramos', kind: 'repeat', enabled: false }] });
    expect(received).toEqual([{ type: 'client.report.draft.requested', data: { client_id: 'cli-cvs', service_id: 'srv-318', type: 'CTL-IMP', user: { id: String(ana), name: 'Ana', phone: '51922222222' } } }]);
    expect(await ReportDraftModel.countDocuments({ userId: ana, serviceId: 'srv-318' })).toBe(1);
  });

  it('asks again with the report id, and keeps the newest document', async () => {
    await draftOf(ana).expect(200);
    answers['client.report.draft.requested'] = { status: 200, body: { ...document, id: '6aed0a1b2c3d4e5f60718293' } };

    await draftOf(ana, { type: 'CTL-IMP', report_id: '6aed0a1b2c3d4e5f60718293' }).expect(200);

    expect(received[1]?.data).toMatchObject({ report_id: '6aed0a1b2c3d4e5f60718293' });
    expect((await ReportDraftModel.findOne({ userId: ana }).lean())?.document.id).toBe('6aed0a1b2c3d4e5f60718293');
  });

  it('is a 404 outside the channel and a 400 for a type that does not open here', async () => {
    await draftOf(outsider).expect(404);
    await draftOf(ana, { type: 'LIQ-SRV' }).expect(400);
    expect(received).toEqual([]);
  });

  it('is a failure with its message when Portal cannot be drawn', async () => {
    answers['client.report.draft.requested'] = { status: 200, body: { ...document, sections: [{ ...document.sections[0], form: 'nope' }] } };

    const response = await draftOf(ana).expect(200);

    expect(response.body).toMatchObject({ error: 'report_draft_failed' });
  });
});

describe('a section as a form', () => {
  it('opens the section with its saved values as defaults, and the report, section and service ride with the answers', async () => {
    await draftOf(ana).expect(200);

    const opened = await openOf(ana, { kind: 'section', type: 'CTL-IMP', section_id: 'general', item_id: null, key: 'general' }).expect(200);

    expect(opened.body).toMatchObject({ outcome: 'form', appName: 'Portal', response: { responseType: 'form', form: { id: 'guardar_seccion_de_informe', title: 'Datos generales' } } });
    expect(opened.body.response.form.schema.properties.responsable).toMatchObject({ default: 'Ana Torres' });
    const run = await BotCommandRunModel.findById(opened.body.commandId).lean();
    expect(run).toMatchObject({ chatId, userId: ana, command: 'guardar_seccion_de_informe', context: { servicioId: 'srv-318', tipo: 'CTL-IMP', seccion: 'general' }, service: { clientId: 'cli-cvs', serviceId: 'srv-318' } });

    await request(app).post(`/api/chats/${chatId}/commands/${opened.body.commandId}/form`).set(auth(ana)).send({ values: { liquido: 'MC-30', responsable: 'Ana Torres' } }).expect(200);

    const submitted = received.find((event) => event.type === 'form.submitted')!;
    expect(submitted.data).toMatchObject({ form_id: 'guardar_seccion_de_informe', command_id: opened.body.commandId, client_id: 'cli-cvs', service_id: 'srv-318', values: { liquido: 'MC-30', responsable: 'Ana Torres', servicioId: 'srv-318', tipo: 'CTL-IMP', seccion: 'general' } });
  });

  it('a new tramo opens its first section empty, with the report but no tramo', async () => {
    answers['client.report.draft.requested'] = { status: 200, body: { ...document, id: '6aed0a1b2c3d4e5f60718293' } };
    await draftOf(ana).expect(200);

    const opened = await openOf(ana, { kind: 'section', type: 'CTL-IMP', section_id: 'tramos', item_id: null, key: 'ubicacion' }).expect(200);

    expect(opened.body.response.form.title).toBe('Tramo · Ubicación');
    const run = await BotCommandRunModel.findById(opened.body.commandId).lean();
    expect(run?.context).toEqual({ servicioId: 'srv-318', tipo: 'CTL-IMP', seccion: 'ubicacion', informeId: '6aed0a1b2c3d4e5f60718293' });
  });

  it('without the document open it asks to open the report again, and a path that is not there too', async () => {
    const closed = await openOf(ana, { kind: 'section', type: 'CTL-IMP', section_id: 'general', item_id: null, key: 'general' }).expect(409);
    expect(closed.body.error).toBe('draft_not_open');
    await draftOf(ana).expect(200);
    await openOf(ana, { kind: 'section', type: 'CTL-IMP', section_id: 'tramos', item_id: 't9', key: 'ubicacion' }).expect(409);
  });

  it('is a 404 outside the channel and a 400 for a shape off the contract', async () => {
    await openOf(outsider, { kind: 'section', type: 'CTL-IMP', section_id: 'general', item_id: null, key: 'general' }).expect(404);
    await openOf(ana, { kind: 'section', type: 'CTL-IMP', section_id: 'general' }).expect(400);
    await openOf(ana, { kind: 'section', type: 'CTL-IMP', section_id: 'tramos', item_id: 't1', key: 'fotos', lat: 95, lng: -77, at: '2026-11-05T15:00:00Z' }).expect(400);
    await openOf(ana, { kind: 'section', type: 'CTL-IMP', section_id: 'tramos', item_id: 't1', key: 'fotos', lat: -12.1, lng: -77, at: 'ayer' }).expect(400);
    await openOf(ana, { kind: 'publish' }).expect(400);
  });
});

describe('the photo and «Publicar» as forms', () => {
  const filled = { ...document, id: '6aed0a1b2c3d4e5f60718293', sections: [document.sections[0], { ...document.sections[1], enabled: true, items: [{ id: 't1', title: 'Tramo 1', sections: [{ id: 'ubicacion', state: 'done', values: { tramo: 'Km 12' } }, { id: 'fotos', state: 'empty', values: {} }] }] }] };

  it('a photo is the tramo\'s own tool, one at a time; the place, the hour, the report and the tramo ride as context', async () => {
    answers['client.report.draft.requested'] = { status: 200, body: filled };
    await draftOf(ana).expect(200);

    const opened = await openOf(ana, { kind: 'section', type: 'CTL-IMP', section_id: 'tramos', item_id: 't1', key: 'fotos', lat: -12.0464, lng: -77.0428, at: '2026-11-05T15:00:00.000Z' }).expect(200);

    expect(opened.body.response.form).toMatchObject({ id: 'agregar_foto_de_informe', title: 'Tramo 1 · Fotos', schema: { required: ['foto'] } });
    const run = await BotCommandRunModel.findById(opened.body.commandId).lean();
    expect(run?.context).toEqual({ servicioId: 'srv-318', informeId: '6aed0a1b2c3d4e5f60718293', tramoId: 't1', lat: -12.0464, lng: -77.0428, at: '2026-11-05T15:00:00.000Z' });
  });

  it('a photo without the hour of the capture is refused', async () => {
    answers['client.report.draft.requested'] = { status: 200, body: filled };
    await draftOf(ana).expect(200);

    await openOf(ana, { kind: 'section', type: 'CTL-IMP', section_id: 'tramos', item_id: 't1', key: 'fotos' }).expect(400);
  });

  it('publishing is a form with an optional note; sending it carries the report and the service', async () => {
    const opened = await openOf(ana, { kind: 'publish', report_id: '6aed0a1b2c3d4e5f60718293' }).expect(200);

    expect(opened.body.response.form).toMatchObject({ id: 'publicar_informe', submitLabel: 'Publicar' });
    await request(app).post(`/api/chats/${chatId}/commands/${opened.body.commandId}/form`).set(auth(ana)).send({ values: {} }).expect(200);

    expect(received.find((event) => event.type === 'form.submitted')?.data).toMatchObject({ form_id: 'publicar_informe', service_id: 'srv-318', values: { servicioId: 'srv-318', informeId: '6aed0a1b2c3d4e5f60718293' } });
  });
});
