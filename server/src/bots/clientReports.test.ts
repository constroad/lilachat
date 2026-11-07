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
const photosForm = { type: 'object', properties: { foto: { type: 'string', title: 'Foto', 'x-input': 'photo' }, descripcion: { type: 'string', title: 'Descripción', maxLength: 200 } }, required: ['foto'] };
const document = {
  id: null, type: 'CTL-IMP', title: 'Control de imprimación', status: 'draft',
  forms: { general: generalForm, ubicacion: ubicacionForm, fotos: photosForm },
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

  it('the client and the project are not asked: Portal\'s own values ride with the answers, or it would blank them', async () => {
    const general = { ...document.sections[0], values: { responsable: 'Ana Torres', cliente: 'Consorcio Vial', proyecto: 'Corredor Pachacútec' } };
    const known = { ...generalForm, properties: { ...generalForm.properties, cliente: { type: 'string', title: 'Cliente' }, proyecto: { type: 'string', title: 'Proyecto' } }, required: ['liquido', 'cliente', 'proyecto', 'responsable'] };
    answers['client.report.draft.requested'] = { status: 200, body: { ...document, forms: { ...document.forms, general: known }, sections: [general, ...document.sections.slice(1)] } };
    await draftOf(ana).expect(200);

    const opened = await openOf(ana, { kind: 'section', type: 'CTL-IMP', section_id: 'general', item_id: null, key: 'general' }).expect(200);

    expect(Object.keys(opened.body.response.form.schema.properties)).not.toContain('cliente');
    await request(app).post(`/api/chats/${chatId}/commands/${opened.body.commandId}/form`).set(auth(ana)).send({ values: { liquido: 'MC-30', responsable: 'Ana Torres' } }).expect(200);
    const submitted = received.find((event) => event.type === 'form.submitted')!;
    expect(submitted.data).toMatchObject({ values: { liquido: 'MC-30', responsable: 'Ana Torres', cliente: 'Consorcio Vial', proyecto: 'Corredor Pachacútec', seccion: 'general' } });
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

  it('taking a photo out of a draft is a form with no fields; sending it carries the report, the photo and the service (José 06/11)', async () => {
    const opened = await openOf(ana, { kind: 'remove_photo', report_id: '6aed0a1b2c3d4e5f60718293', photo_id: '6aed0a1b2c3d4e5f60718294' }).expect(200);

    expect(opened.body.response.form).toMatchObject({ id: 'quitar_foto_de_informe', submitLabel: 'Quitar' });
    expect(opened.body.response.form.schema.properties).toEqual({});
    await request(app).post(`/api/chats/${chatId}/commands/${opened.body.commandId}/form`).set(auth(ana)).send({ values: {} }).expect(200);

    expect(received.find((event) => event.type === 'form.submitted')?.data).toMatchObject({ form_id: 'quitar_foto_de_informe', client_id: 'cli-cvs', service_id: 'srv-318', values: { servicioId: 'srv-318', informeId: '6aed0a1b2c3d4e5f60718293', fotoId: '6aed0a1b2c3d4e5f60718294' } });
  });

  it('opening a Drive upload carries the checked service; the ticket reaches the asker and is not kept (José 06/11)', async () => {
    const ticket = { url: 'https://constroad.com/api/public/service-drive-upload/secreto', method: 'POST', fields: {}, fileField: 'file', expiresAt: '2026-11-06T23:00:00.000Z', maxBytes: 52428800, maxSeconds: 60, mimeTypes: ['image/jpeg', 'video/mp4'] };
    answers['form.submitted'] = { status: 200, body: { response_type: 'ephemeral', text: 'Ya puedes enviar el archivo.', shareable: false, upload: ticket } };
    const opened = await openOf(ana, { kind: 'drive_upload' }).expect(200);

    expect(opened.body.response.form).toMatchObject({ id: 'subir_al_drive', schema: { properties: {} } });
    const sent = await request(app).post(`/api/chats/${chatId}/commands/${opened.body.commandId}/form`).set(auth(ana)).send({ values: {} }).expect(200);

    expect(received.find((event) => event.type === 'form.submitted')?.data).toMatchObject({ form_id: 'subir_al_drive', client_id: 'cli-cvs', service_id: 'srv-318', values: { servicioId: 'srv-318' } });
    expect(sent.body.response.upload).toEqual(ticket);
    const run = await BotCommandRunModel.findById(opened.body.commandId).lean();
    expect(JSON.stringify(run)).not.toContain('secreto');
  });

  it('nobody outside the channel opens a Drive upload', async () => {
    await openOf(outsider, { kind: 'drive_upload' }).expect(404);
  });

  it('a photo to take out needs both its report and its id', async () => {
    await openOf(ana, { kind: 'remove_photo', report_id: '6aed0a1b2c3d4e5f60718293' }).expect(400);
    await openOf(ana, { kind: 'remove_photo', photo_id: '6aed0a1b2c3d4e5f60718294' }).expect(400);
  });

  it('nobody outside the channel takes a photo out', async () => {
    await openOf(outsider, { kind: 'remove_photo', report_id: '6aed0a1b2c3d4e5f60718293', photo_id: '6aed0a1b2c3d4e5f60718294' }).expect(404);
  });
});

describe('the progress of the work from the map (design o-07, agentes 07/11)', () => {
  const ENTRY = '3f0e2c1a-1111-4222-8333-444455556666';
  const point = { kind: 'ingreso', lat: -12.05, lng: -77.03, precision_m: 6, at: '2026-11-07T14:00:00.000Z' };
  const detail = { service: { id: 'srv-318', name: 'Imprimación' }, orders: [], dispatches: [], reports: [], totals: {}, discharges: [{ dispatch_id: 'd1', plate: 'QAP-101', m3: 15, points: [point] }, { dispatch_id: 'd2', plate: '', points: [point] }] };
  const progress = (overrides: Record<string, unknown> = {}) => ({ kind: 'work_progress', street_id: 'st-1', tag_id: 'tg-1', from_m: 10, to_m: 100, dispatch_ids: ['d1', 'd2'], entry_id: ENTRY, device_at: '2026-11-07T15:00:00.000Z', forms: 3, ...overrides });

  beforeEach(() => {
    answers['client.service.requested'] = { status: 200, body: detail };
  });

  it('it opens with the lists as context, the service from the door, and only units the detail brought', async () => {
    // Arrange: the phone also sends a unit the service never had.
    const opened = await openOf(jose, progress({ dispatch_ids: ['d1', 'd2', 'd-otro'] })).expect(200);
    // Act
    await request(app).post(`/api/chats/${chatId}/commands/${opened.body.commandId}/form`).set(auth(jose)).send({ values: { nota: 'Tramo de la mañana' } }).expect(200);
    // Assert
    expect(opened.body.response.form).toMatchObject({ id: 'registrar_avance_de_obra', schema: { properties: { nota: { maxLength: 280 } } } });
    expect(received.find((event) => event.type === 'form.submitted')?.data).toMatchObject({
      form_id: 'registrar_avance_de_obra', client_id: 'cli-cvs', service_id: 'srv-318',
      values: { nota: 'Tramo de la mañana', servicioId: 'srv-318', calleId: 'st-1', etiquetaId: 'tg-1', desdeM: 10, hastaM: 100, despachoIds: ['d1', 'd2'], entradaId: ENTRY, horaDelEquipo: '2026-11-07T15:00:00.000Z' },
    });
  });

  it('a contracted item goes as partidaId', async () => {
    const opened = await openOf(jose, progress({ tag_id: undefined, partida_id: 'pa-1' })).expect(200);
    const run = await BotCommandRunModel.findById(opened.body.commandId).lean();
    expect(run?.context).toMatchObject({ partidaId: 'pa-1' });
    expect(run?.context).not.toHaveProperty('etiquetaId');
  });

  it('any member of the client channel opens it, not only an admin (José 07/11: «todos pueden crear y actualizar»)', async () => {
    const opened = await openOf(ana, progress()).expect(200);
    expect(opened.body.response.form).toMatchObject({ id: 'registrar_avance_de_obra' });
  });

  it('someone outside the client channel does not open it', async () => {
    await openOf(outsider, progress()).expect(404);
    expect(received.some((event) => event.type === 'client.service.requested')).toBe(false);
  });

  it('units that are not in the service are refused before anything reaches Portal', async () => {
    const refused = await openOf(jose, progress({ dispatch_ids: ['d-otro'] })).expect(409);
    expect(refused.body.message).toBe('Esas unidades no salen en el detalle del servicio. Abre el mapa de nuevo.');
  });

  it('when the detail does not come back it says so, and opens nothing', async () => {
    answers['client.service.requested'] = { status: 502, body: {} };
    const refused = await openOf(jose, progress()).expect(409);
    expect(refused.body.message).toBe('No se pudo comprobar el servicio. Prueba de nuevo.');
    expect(await BotCommandRunModel.countDocuments({ command: 'registrar_avance_de_obra' })).toBe(0);
  });

  it('anything off the contract is a 400', async () => {
    await openOf(jose, progress({ tag_id: undefined })).expect(400);
    await openOf(jose, progress({ partida_id: 'pa-1' })).expect(400);
    await openOf(jose, progress({ to_m: 10 })).expect(400);
    await openOf(jose, progress({ entry_id: 'abc' })).expect(400);
    await openOf(jose, progress({ device_at: 'ayer' })).expect(400);
    await openOf(jose, progress({ dispatch_ids: Array.from({ length: 31 }, (_, index) => `d${index}`) })).expect(400);
  });
});

describe('a control de pista (06/11): units from the dispatches, photos with their kind and place', () => {
  const unitsSection = {
    id: 'unidades', kind: 'repeat', title: 'Unidades', required: true, state: 'empty', summary: [], itemTitle: 'Unidad', addLabel: '', min: 1, page: { current: 1, total: 2 },
    template: [{ id: 'datos', title: 'Datos', required: true, form: 'unidad' }, { id: 'foto-ingreso', title: 'Foto de ingreso', required: true, form: 'fotos', tool: 'agregar_foto_de_informe', photoKind: 'ingreso', requireLocation: true }],
    items: [{ id: 'd1', title: 'QAP-103', summary: ['Salió 07:10 · 15 m³'], sections: [] }],
  };
  // The unit's data form is `unidad` while its template entry is `datos`: Portal's `seccion` is the form (06/11).
  const pista = { ...document, id: '6aed0a1b2c3d4e5f60718293', type: 'CTL-PIS', title: 'Control de pista', forms: { ...document.forms, unidad: ubicacionForm }, sections: [document.sections[0], unitsSection] };
  const at = '2026-11-06T15:00:00.000Z';

  it('opens here, and a page of units rides to Portal as given; a page before the first is refused', async () => {
    answers['client.report.draft.requested'] = { status: 200, body: pista };
    await draftOf(ana, { type: 'CTL-PIS', page: 2 }).expect(200);
    expect(received[0]?.data).toMatchObject({ client_id: 'cli-cvs', service_id: 'srv-318', type: 'CTL-PIS', page: 2 });
    await draftOf(ana, { type: 'CTL-PIS' }).expect(200);
    expect(received[1]?.data).not.toHaveProperty('page');
    await draftOf(ana, { type: 'CTL-PIS', page: 0 }).expect(400);
  });

  it('a unit\'s photo says its kind and its own key beside the place, so Portal tells the photos apart', async () => {
    answers['client.report.draft.requested'] = { status: 200, body: pista };
    await draftOf(ana, { type: 'CTL-PIS' }).expect(200);

    const opened = await openOf(ana, { kind: 'section', type: 'CTL-PIS', section_id: 'unidades', item_id: 'd1', key: 'foto-ingreso', lat: -12.0464, lng: -77.0428, at, client_key: 'k-ingreso-1' }).expect(200);

    expect(opened.body.response.form).toMatchObject({ id: 'agregar_foto_de_informe', title: 'QAP-103 · Foto de ingreso' });
    const run = await BotCommandRunModel.findById(opened.body.commandId).lean();
    expect(run?.context).toEqual({ servicioId: 'srv-318', informeId: '6aed0a1b2c3d4e5f60718293', tramoId: 'd1', tipoFoto: 'ingreso', clientKey: 'k-ingreso-1', lat: -12.0464, lng: -77.0428, at });
  });

  it('a unit\'s data section is saved under its form id (`unidad`), the key Portal accepts, with the dispatch as tramo', async () => {
    answers['client.report.draft.requested'] = { status: 200, body: pista };
    await draftOf(ana, { type: 'CTL-PIS' }).expect(200);

    const opened = await openOf(ana, { kind: 'section', type: 'CTL-PIS', section_id: 'unidades', item_id: 'd1', key: 'datos' }).expect(200);

    expect(opened.body.response.form).toMatchObject({ id: 'guardar_seccion_de_informe', title: 'QAP-103 · Datos' });
    const run = await BotCommandRunModel.findById(opened.body.commandId).lean();
    expect(run?.context).toEqual({ servicioId: 'srv-318', tipo: 'CTL-PIS', seccion: 'unidad', informeId: '6aed0a1b2c3d4e5f60718293', tramoId: 'd1' });
  });

  it('a photo that needs its place is refused without one, before touching Portal', async () => {
    answers['client.report.draft.requested'] = { status: 200, body: pista };
    await draftOf(ana, { type: 'CTL-PIS' }).expect(200);
    const before = received.length;

    await openOf(ana, { kind: 'section', type: 'CTL-PIS', section_id: 'unidades', item_id: 'd1', key: 'foto-ingreso', at }).expect(400);

    expect(received).toHaveLength(before);
  });
});
