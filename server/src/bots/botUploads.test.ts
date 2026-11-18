import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from '../testMongo.js';
import { buildApp } from '../app.js';
import { UserModel } from '../models.js';
import { ChatModel, MessageModel } from '../chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../workspaceModels.js';
import { signSession } from '../sessions.js';
import { BotAppModel, BotInstallationModel, OAuthCodeModel } from './botModels.js';
import { ProspectChannelModel } from './botProspects.js';
import { BotUploadModel } from './botUploads.js';
import { configureDevelopers } from './botApps.js';
import { forgetBots } from './botRegistry.js';
import { sha256 } from './botSecrets.js';

/** A prospect's files (José 17/11: «si un prospecto me manda un kml, una imagen o un pdf con metrados»). */
let mongo: MongoMemoryServer;
const stored: string[] = [];
const app = buildApp({ mediaUploader: { async upload(params) { stored.push(params.fileName); return { ok: true, media: { url: `/media/bot/${params.fileName}`, storageName: `st-${params.fileName}`, sizeBytes: params.bytes.length } }; } } });
const REDIRECT = 'https://agentes.example.com/canales/lilachat/vuelta';
const VERIFIER = 'v'.repeat(64);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');
const asLila = { Authorization: `Basic ${Buffer.from('lca_dev_lila:lcx_dev_secret').toString('base64')}` };
const asBot = (token: string) => ({ Authorization: `Bearer ${token}` });
const PROSPECT = 'dali:constroad:9f2c41';
const KML = Buffer.from('<?xml version="1.0"?><kml><Document><name>Metrados</name></Document></kml>');
let jose: Types.ObjectId;
let spaceId: Types.ObjectId;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_bot_uploads'));
  configureDevelopers(['lca_dev_lila']);
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  forgetBots();
  stored.length = 0;
  await Promise.all([UserModel, ChatModel, MessageModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel, OAuthCodeModel, ProspectChannelModel, BotUploadModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  jose = (await UserModel.create({ phone: '51902049935', name: 'José' }))._id;
  spaceId = (await WorkspaceModel.create({ name: 'CONSTROAD', ownerId: jose, joinCode: 'CONS-7K3P' }))._id;
  await WorkspaceMemberModel.create({ workspaceId: spaceId, userId: jose, phone: '51902049935', role: 'owner', status: 'active' });
  await BotAppModel.create({ clientId: 'lca_dev_lila', clientSecretHash: sha256('lcx_dev_secret'), name: 'Lila', redirectUris: [REDIRECT], webhookUrl: 'http://127.0.0.1:9/events' });
});

async function installApp(key = 'dali'): Promise<string> {
  const asJose = { Authorization: `Bearer ${signSession({ userId: String(jose), deviceId: `d-${jose}`, email: 'x' })}` };
  const { body } = await request(app).post('/api/bots/apps').set(asLila).send({ key, name: 'Dali', redirect_uri: REDIRECT, webhook_url: 'http://127.0.0.1:9/events', scopes: ['prospects:write'] }).expect(201);
  const authorized = await request(app).post('/api/oauth/authorize').set(asJose).send({ client_id: body.client_id, redirect_uri: REDIRECT, state: 'state-0123456789abcdef', code_challenge: CHALLENGE, code_challenge_method: 'S256', space_id: String(spaceId), decision: 'approve' }).expect(200);
  const token = await request(app).post('/api/oauth/token').send({ grant_type: 'authorization_code', code: new URL(authorized.body.redirect).searchParams.get('code'), redirect_uri: REDIRECT, client_id: body.client_id, client_secret: body.client_secret, code_verifier: VERIFIER }).expect(200);
  return token.body.access_token;
}
const upload = (token: string, bytes: Buffer, name: string, mime: string) => request(app).post('/api/bots/files').set(asBot(token)).attach('file', bytes, { filename: name, contentType: mime });
const post = (token: string, body: Record<string, unknown>) => request(app).post('/api/bots/messages').set(asBot(token)).send(body);

describe('POST /api/bots/files', () => {
  it('keeps a KML that came as octet-stream and answers where it lives', async () => {
    const token = await installApp();
    const { body } = await upload(token, KML, 'METRADOS 161126.kml', 'application/octet-stream').expect(201);
    expect(body).toMatchObject({ file_id: expect.stringMatching(/^[0-9a-f]{24}$/), mime: 'application/octet-stream', name: 'METRADOS 161126.kml', size: KML.length });
    expect(body.url).toMatch(/\/media\/bot\/METRADOS 161126\.kml$/);
    expect(stored).toEqual(['METRADOS 161126.kml']);
  });

  it('keeps an accented name as the client wrote it (E2E 17/11: «Metrado Paola RÃos.kml»)', async () => {
    const token = await installApp();
    expect((await upload(token, KML, 'Metrado Paola Ríos.kml', 'application/octet-stream').expect(201)).body.name).toBe('Metrado Paola Ríos.kml');
  });

  it('refuses a type off the list (415), a file over 16 MB (413) and a post without a file (400)', async () => {
    const token = await installApp();
    expect((await upload(token, Buffer.from('MZ'), 'setup.exe', 'application/octet-stream').expect(415)).body.error).toBe('unsupported_type');
    expect((await upload(token, Buffer.alloc(16 * 1024 * 1024 + 1), 'big.pdf', 'application/pdf').expect(413)).body.error).toBe('file_too_large');
    expect((await request(app).post('/api/bots/files').set(asBot(token)).send({}).expect(400)).body.error).toBe('invalid_request');
    expect(stored).toEqual([]);
  });
});

describe('POST /api/bots/messages with files', () => {
  it('as_contact posts each file as its own message by the prospect, the text riding on the first', async () => {
    const token = await installApp();
    await request(app).put(`/api/bots/prospects/${encodeURIComponent(PROSPECT)}`).set(asBot(token)).send({ name: 'Carlos', phone: '51949123824', last_activity_at: new Date().toISOString() }).expect(201);
    const kml = (await upload(token, KML, 'METRADOS 161126.kml', 'application/octet-stream').expect(201)).body.file_id;
    const photo = (await upload(token, Buffer.from('jpg'), 'cuadra.jpg', 'image/jpeg').expect(201)).body.file_id;
    await post(token, { prospect: PROSPECT, as_contact: true, sent_at: '2026-11-17T14:02:00.000Z', text: 'Les paso el metrado', files: [{ file_id: kml }, { file_id: photo }], idempotency_key: 'wamid.f1' }).expect(201);
    const messages = await MessageModel.find({ prospect: { $exists: true } }).sort({ seq: 1 }).lean();
    expect(messages.map((message) => [message.kind, message.media?.fileName, message.body ?? null])).toEqual([['file', 'METRADOS 161126.kml', 'Les paso el metrado'], ['image', 'cuadra.jpg', null]]);
    expect(messages[0]!.prospect).toMatchObject({ name: 'Carlos', phone: '51949123824' });
    await post(token, { prospect: PROSPECT, as_contact: true, files: [{ file_id: kml }, { file_id: photo }], idempotency_key: 'wamid.f1' }).expect(200);
    expect(await MessageModel.countDocuments({ prospect: { $exists: true } })).toBe(2);
    await post(token, { prospect: PROSPECT, files: [{ file_id: photo }], idempotency_key: 'dali.f2' }).expect(201);

    const asJose = { Authorization: `Bearer ${signSession({ userId: String(jose), deviceId: `d-${jose}`, email: 'x' })}` };
    const { body } = await request(app).get(`/api/workspaces/${spaceId}/prospects/${encodeURIComponent(PROSPECT)}/documents`).set(asJose).expect(200);
    expect(body.documents.map((document: { name: string; kind: string }) => [document.kind, document.name]).sort()).toEqual([['file', 'METRADOS 161126.kml'], ['image', 'cuadra.jpg']]);
    expect(body.documents[0]).toMatchObject({ seq: expect.any(Number), url: expect.stringContaining('/media/bot/'), at: '2026-11-17T14:02:00.000Z' });
  });

  it('a field read from a document reaches the ficha as «por confirmar» with its file', async () => {
    const token = await installApp();
    const kml = (await upload(token, KML, 'METRADOS 161126.kml', 'application/octet-stream').expect(201)).body.file_id;
    const fields = [{ key: 'area_m2', label: 'Área', value: '1 240 m²', source: 'document', file_id: kml }, { key: 'district', label: 'Distrito', value: 'Ate' }];
    await request(app).put(`/api/bots/prospects/${encodeURIComponent(PROSPECT)}`).set(asBot(token)).send({ phone: '51949123824', last_activity_at: new Date().toISOString(), fields }).expect(201);
    const asJose = { Authorization: `Bearer ${signSession({ userId: String(jose), deviceId: `d-${jose}`, email: 'x' })}` };
    const ficha = await request(app).get(`/api/workspaces/${spaceId}/prospects/${encodeURIComponent(PROSPECT)}`).set(asJose).expect(200);
    expect(ficha.body.prospect.fields).toEqual([{ key: 'area_m2', label: 'Área', value: '1 240 m²', source: 'document', fileId: kml, confirmed: false }, { key: 'district', label: 'Distrito', value: 'Ate' }]);
  });

  it('a file_id of another app is not found (404) and posts nothing', async () => {
    const dali = await installApp();
    await request(app).put(`/api/bots/prospects/${encodeURIComponent(PROSPECT)}`).set(asBot(dali)).send({ phone: '51949123824', last_activity_at: new Date().toISOString() }).expect(201);
    const other = await installApp('otra');
    const foreign = (await upload(other, KML, 'ajeno.kml', 'application/vnd.google-earth.kml+xml').expect(201)).body.file_id;
    expect((await post(dali, { prospect: PROSPECT, as_contact: true, files: [{ file_id: foreign }], idempotency_key: 'k' }).expect(404)).body.error).toBe('file_not_found');
    expect(await MessageModel.countDocuments({ kind: 'file' })).toBe(0);
  });
});
