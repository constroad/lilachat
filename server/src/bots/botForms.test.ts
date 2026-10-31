import sharp from 'sharp';
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
import { openEveryItem } from './testItems.js';

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
const attendanceForm = {
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
  configureCommands({ answerTimeoutMs: 300, lateAnswerWaitMs: 400 });
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

// Not about permissions (`botItemAccess.test.ts`): everything on, as an admin would leave it.
const appId = async () => {
  await openEveryItem();
  return String((await BotAppModel.findOne({ clientId: 'lca_inframaq' }).lean())!._id);
};
async function openForm(): Promise<string> {
  answer = json({ response_type: 'form', form: attendanceForm });
  const outcome = await request(app).post(`/api/chats/${channel}/commands`).set(asAna).send({ app_id: await appId(), command: 'asistencia', text: '' }).expect(200);
  expect(outcome.body).toMatchObject({ outcome: 'form', response: { responseType: 'form', form: { id: 'registrar_marca', title: 'Marcar asistencia' } } });
  return outcome.body.commandId;
}
const uploadPhoto = (commandId: string, as = asAna) => request(app).post(`/api/chats/${channel}/commands/${commandId}/files`).set(as).attach('file', JPEG, { filename: 'selfie.jpg', contentType: 'image/jpeg' });
const submit = (commandId: string, values: Record<string, unknown>, as = asAna) => request(app).post(`/api/chats/${channel}/commands/${commandId}/form`).set(as).send({ values });
// A reading of now: signing refuses an old one (José, 24/10).
const here = { lat: -11.98, lng: -76.95, precision: 6, age: 3000 };

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
    expect(event.data).toMatchObject({ form_id: 'registrar_marca', command_id: commandId, values: { accion: 'ingreso', ubicacion: { lat: -11.98, lng: -76.95, precision: 6 }, actividades: 'Tolva 2' }, user: { name: 'Ana', phone: '51987654321' }, channel: { id: String(channel), kind: 'channel' } });
    // `age` is Lilachat's check: the app gets exactly its schema (agentes, 24/10).
    expect((event.data.values as Record<string, Record<string, unknown>>).ubicacion).not.toHaveProperty('age');
    const photoUrl = new URL(String((event.data.values as Record<string, unknown>).foto));
    expect(photoUrl.pathname).toMatch(/^\/api\/bots\/files\/[\w-]+\.[\w-]+$/);
    const photo = await request(app).get(photoUrl.pathname).expect(200);
    expect(photo.headers['content-type']).toBe('image/jpeg');
    expect(Buffer.compare(photo.body as Buffer, JPEG)).toBe(0);
    await request(app).get(`${photoUrl.pathname}x`).expect(404);
  });

  it('the live selfie comes back stamped with the hour and the place; one it cannot read goes as it came (pending 94)', async () => {
    // Arrange: a real 320×240 white photo, sent with the place the form has.
    const commandId = await openForm();
    const white = await sharp({ create: { width: 320, height: 240, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
    // Act
    const { fileId } = (await request(app).post(`/api/chats/${channel}/commands/${commandId}/files`).set(asAna).field('stamp', '1').field('lat', '-11.98123').field('lng', '-76.95451').field('precision', '5').attach('file', white, { filename: 'selfie.jpg', contentType: 'image/jpeg' }).expect(201)).body;
    const broken = await request(app).post(`/api/chats/${channel}/commands/${commandId}/files`).set(asAna).field('stamp', '1').attach('file', JPEG, { filename: 'selfie.jpg', contentType: 'image/jpeg' }).expect(201);
    answer = json({ text: 'Ingreso marcado' });
    received.length = 0;
    await submit(commandId, { accion: 'ingreso', ubicacion: here, foto: fileId }).expect(200);
    // Assert: the stamped photo keeps its size and gets a dark band at the bottom.
    const photoUrl = new URL(String((received[0]!.data.values as Record<string, unknown>).foto));
    const photo = (await request(app).get(photoUrl.pathname).expect(200)).body as Buffer;
    const { data, info } = await sharp(photo).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([320, 240]);
    expect(data[(238 * info.width + 2) * info.channels]!).toBeLessThan(140);
    expect(broken.body.fileId).toEqual(expect.any(String));
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
    answer = json({ response_type: 'form', form: attendanceForm });
    received.length = 0;
    // Act
    const opened = await request(app).post(`/api/chats/${channel}/shortcuts`).set(asAna).send({ app_id: await appId(), shortcut: 'marcar_asistencia' }).expect(200);
    // Assert
    expect(opened.body).toMatchObject({ outcome: 'form', response: { form: { id: 'registrar_marca' } } });
    expect(received).toEqual([{ type: 'shortcut.invoked', data: expect.objectContaining({ shortcut: 'marcar_asistencia', command_id: opened.body.commandId, user: expect.objectContaining({ name: 'Ana', phone: '51987654321' }), channel: expect.objectContaining({ id: String(channel) }) }) }]);
    expect(received[0]!.data).not.toHaveProperty('command');
    await request(app).post(`/api/chats/${channel}/shortcuts`).set(asAna).send({ app_id: await appId(), shortcut: 'otra' }).expect(404);
  });

  it('an action tapped from a place that already knows something carries it as values (agentes 31/10: the link of a client or an order); a bad shape is refused', async () => {
    // Arrange
    await BotAppModel.updateOne({ clientId: 'lca_inframaq' }, { $set: { shortcuts: [{ key: 'marcar_asistencia', name: 'Marcar asistencia' }] } });
    answer = json({ response_type: 'form', form: attendanceForm });
    received.length = 0;
    // Act
    await request(app).post(`/api/chats/${channel}/shortcuts`).set(asAna).send({ app_id: await appId(), shortcut: 'marcar_asistencia', values: { alcance: 'pedido', clienteId: 'cli-1', pedidoId: 'o-7' } }).expect(200);
    const refused = await request(app).post(`/api/chats/${channel}/shortcuts`).set(asAna).send({ app_id: await appId(), shortcut: 'marcar_asistencia', values: { alcance: { anidado: true } } }).expect(400);
    // Assert
    expect(received).toEqual([{ type: 'shortcut.invoked', data: expect.objectContaining({ shortcut: 'marcar_asistencia', values: { alcance: 'pedido', clienteId: 'cli-1', pedidoId: 'o-7' } }) }]);
    expect(received[0]!.data).not.toHaveProperty('refresh');
    expect(refused.body.message).toBe('values va como un objeto de textos cortos, números o sí/no.');
  });

  describe('the late answer travels in the sent form\'s own reply (agentes, 25/10: «No se pudo confirmar» although it was recorded)', () => {
    const sendLate = async (commandId: string, body: Record<string, unknown>) => request(app).post(`/api/bots/commands/${commandId}/respond`).set(await botAuth()).send(body).expect(200);
    const send = async () => {
      const commandId = await openForm();
      const { fileId } = (await uploadPhoto(commandId).expect(201)).body;
      return { commandId, values: { accion: 'salida', ubicacion: here, foto: fileId } };
    };

    it('the app answers through /respond BEFORE its webhook returns: the submit already carries that answer', async () => {
      // Arrange: the order of agentes' logs (the late answer at 22.698, the acknowledgement at 22.807)
      const { commandId, values } = await send();
      answer = (event, res) => {
        void sendLate(String(event.data.command_id), { text: 'Salida marcada · 11:19', shareable: false }).then(() => res.end());
      };
      // Act
      const sent = await submit(commandId, values).expect(200);
      // Assert
      expect(sent.body).toMatchObject({ commandId, outcome: 'ephemeral', response: { responseType: 'ephemeral', text: 'Salida marcada · 11:19' } });
    });

    it('the app answers a moment AFTER acknowledging, within the wait: the same reply carries it', async () => {
      const { commandId, values } = await send();
      answer = (event, res) => {
        res.end();
        setTimeout(() => void sendLate(String(event.data.command_id), { text: 'Salida marcada · 11:19', shareable: false }), 30);
      };
      const sent = await submit(commandId, values).expect(200);
      expect(sent.body).toMatchObject({ commandId, outcome: 'ephemeral', response: { text: 'Salida marcada · 11:19' } });
    });

    it('a late refusal inside the wait comes back as the form\'s errors, like an immediate one', async () => {
      const { commandId, values } = await send();
      answer = (event, res) => {
        res.end();
        setTimeout(() => void sendLate(String(event.data.command_id), { errors: { accion: 'Completa tu registro de refrigerio antes de firmar salida.' } }), 30);
      };
      const refused = await submit(commandId, values).expect(422);
      expect(refused.body.errors).toEqual({ accion: 'Completa tu registro de refrigerio antes de firmar salida.' });
    });

    it('an answer that takes longer than the wait leaves the form «pending» and still reaches the asker by the socket', async () => {
      const notices: CommandNotice[] = [];
      configureCommands({ notify: (_userId, notice) => notices.push(notice) });
      const { commandId, values } = await send();
      answer = (_event, res) => res.end();
      const sent = await submit(commandId, values).expect(200);
      await sendLate(commandId, { text: 'Salida marcada · 11:19', shareable: false });
      expect(sent.body.outcome).toBe('pending');
      expect(notices.map((notice) => notice.commandId)).toEqual([commandId]);
      configureCommands({ notify: () => undefined });
    });
  });

  it('from the space\'s ⚡, outside any chat: channel null, the photo and the form by the space, the late answer to the asker', async () => {
    // Arrange
    await BotAppModel.updateOne({ clientId: 'lca_inframaq' }, { $set: { shortcuts: [{ key: 'marcar_asistencia', name: 'Marcar asistencia' }] } });
    const notices: { userId: string; notice: CommandNotice }[] = [];
    configureCommands({ notify: (userId, notice) => notices.push({ userId, notice }) });
    answer = json({ response_type: 'form', form: attendanceForm });
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

describe('a form with a list (José and agentes, 28/10: the order\'s trucks in rows, the quote\'s products)', () => {
  const orderForm = {
    id: 'crear_pedido',
    title: 'Crear un pedido',
    schema: {
      type: 'object',
      properties: {
        despachos: {
          type: 'array', title: 'Carros', minItems: 1, maxItems: 6, default: [{ carros: 1, m3: 25 }],
          items: { type: 'object', required: ['carros', 'm3'], properties: { carros: { type: 'integer', minimum: 1 }, m3: { type: 'number', exclusiveMinimum: 0 }, foto: { type: 'string', 'x-input': 'photo' } } },
        },
      },
      required: ['despachos'],
    },
  };
  const ask = (body: Record<string, unknown>) => request(app).post(`/api/chats/${channel}/commands`).set(asAna).send({ app_id: body.app_id, command: 'asistencia', text: '', ...body });

  it('a Lilachat that does not draw lists yet is told to update instead of getting a form it cannot open', async () => {
    // Arrange
    answer = json({ response_type: 'form', form: orderForm });
    const id = await appId();
    // Act
    const old = await ask({ app_id: id }).expect(200);
    const current = await ask({ app_id: id, forms: 2 }).expect(200);
    // Assert
    expect(old.body).toMatchObject({ outcome: 'failed', message: 'Actualiza Lilachat para llenar este formulario.' });
    expect(old.body).not.toHaveProperty('response');
    expect(current.body).toMatchObject({ outcome: 'form', response: { form: { id: 'crear_pedido' } } });
  });

  it('checks each item, with the path under the field; a photo inside an item goes to the app signed', async () => {
    // Arrange
    answer = json({ response_type: 'form', form: orderForm });
    const commandId = (await ask({ app_id: await appId(), forms: 2 }).expect(200)).body.commandId;
    const { fileId } = (await uploadPhoto(commandId).expect(201)).body;
    // Act
    const wrong = await submit(commandId, { despachos: [{ carros: 2, m3: 25 }, { carros: 1, m3: 0 }] }).expect(422);
    answer = json({ text: 'Pedido creado' });
    received.length = 0;
    await submit(commandId, { despachos: [{ carros: 2, m3: 25, foto: fileId }, { carros: 1, m3: 15 }] }).expect(200);
    // Assert
    expect(wrong.body.errors).toEqual({ 'despachos[1].m3': 'Mayor que 0.' });
    const items = (received[0]!.data.values as { despachos: Record<string, unknown>[] }).despachos;
    expect(items[1]).toEqual({ carros: 1, m3: 15 });
    expect(items[0]).toMatchObject({ carros: 2, m3: 25 });
    expect(String(items[0]!.foto)).toMatch(/\/api\/bots\/files\/[\w-]+\.[\w-]+$/);
  });
});

/** Fuel consumption (agentes 2483da7, 30/10): the period refreshes the options, a read tool sums up the draft. */
describe('a form that refreshes and sums up before sending', () => {
  const orders = (ids: string[]) => ({ type: 'array', title: 'Pedidos', minItems: 1, items: { type: 'string', oneOf: ids.map((id) => ({ const: id, title: `PED-${id}` })) } });
  const consumption = (ids: string[], extra: Record<string, unknown> = {}) => ({
    id: 'registrar_consumo',
    title: 'Registrar consumo',
    schema: { type: 'object', 'x-preview': { tool: 'revisar_consumo' }, properties: { desde: { type: 'string', format: 'date', 'x-refresh': true }, pedidos: orders(ids), foto: { type: 'string', 'x-input': 'photo' } }, required: ['pedidos'], ...extra },
  });
  const open = async (form = consumption(['p1', 'p2']), forms = 3) => {
    await BotAppModel.updateOne({ clientId: 'lca_inframaq' }, { $set: { shortcuts: [{ key: 'registrar_consumo', name: 'Registrar consumo' }] } });
    answer = json({ response_type: 'form', form });
    return request(app).post(`/api/chats/${channel}/shortcuts`).set(asAna).send({ app_id: await appId(), shortcut: 'registrar_consumo', forms }).expect(200);
  };
  const live = (commandId: string, what: 'refresh' | 'preview', values: Record<string, unknown>) => request(app).post(`/api/chats/${channel}/commands/${commandId}/${what}`).set(asAna).send({ values });

  it('a Lilachat that does not draw these yet is told to update', async () => {
    const old = await open(consumption(['p1']), 2);
    expect(old.body).toMatchObject({ outcome: 'failed', message: 'Actualiza Lilachat para llenar este formulario.' });
  });

  it('a new period asks the app again with the draft on the same command; the new form is what gets checked', async () => {
    // Arrange
    const commandId = (await open()).body.commandId;
    answer = json({ response_type: 'form', text: 'No hay pedidos para elegir en Portal en ese periodo.', form: consumption(['p7']) });
    received.length = 0;
    // Act
    const refreshed = await live(commandId, 'refresh', { desde: '2026-10-23', pedidos: ['p1'], foto: 'file-x', ajeno: 1 }).expect(200);
    // Assert
    expect(refreshed.body).toMatchObject({ outcome: 'form', commandId, response: { text: 'No hay pedidos para elegir en Portal en ese periodo.', form: { id: 'registrar_consumo' } } });
    expect(received).toEqual([{ type: 'shortcut.invoked', data: expect.objectContaining({ command_id: commandId, shortcut: 'registrar_consumo', refresh: true, values: { desde: '2026-10-23', pedidos: ['p1'] } }) }]);
    answer = json({ text: 'Consumo registrado' });
    expect((await submit(commandId, { pedidos: ['p1'] }).expect(422)).body.errors).toEqual({ pedidos: 'Elige entre las opciones.' });
    await submit(commandId, { pedidos: ['p7'] }).expect(200);
  });

  it('the summary: form.preview.requested with the draft, its blocks and errors back; a failing app means no summary', async () => {
    // Arrange
    const commandId = (await open()).body.commandId;
    answer = json({ blocks: [{ type: 'metric', value: '8.68', unit: 'gl/m³', label: 'Rendimiento', tone: 'warn' }], errors: { pedidos: 'Ese pedido ya tiene consumo.' } });
    received.length = 0;
    // Act
    const summed = await live(commandId, 'preview', { pedidos: ['p1'] }).expect(200);
    answer = (_event, res) => res.writeHead(502).end();
    const failed = await live(commandId, 'preview', { pedidos: ['p1'] }).expect(200);
    // Assert
    expect(summed.body).toEqual({ blocks: [{ type: 'metric', value: '8.68', unit: 'gl/m³', label: 'Rendimiento', tone: 'warn' }], errors: { pedidos: 'Ese pedido ya tiene consumo.' } });
    expect(received[0]).toEqual({ type: 'form.preview.requested', data: expect.objectContaining({ command_id: commandId, form_id: 'registrar_consumo', values: { pedidos: ['p1'] }, user: expect.objectContaining({ name: 'Ana' }) }) });
    expect(failed.body).toEqual({ blocks: [], errors: {} });
  });

  it('a form without x-refresh or x-preview refuses both; only who asked may', async () => {
    // Arrange
    const commandId = (await open(consumption(['p1'], { 'x-preview': undefined, properties: { pedidos: orders(['p1']) } }))).body.commandId;
    // Act / Assert
    await live(commandId, 'refresh', {}).expect(409);
    await live(commandId, 'preview', {}).expect(409);
    await request(app).post(`/api/chats/${channel}/commands/${commandId}/preview`).set(asJose).send({ values: {} }).expect(404);
  });
});
