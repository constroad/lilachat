import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash, createSign, generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import type { Response } from 'superagent';
import { Disco } from '../disco.js';
import { MEDIA_MARKER } from '../mediaDisk.js';
import { buildOtaRouter } from './otaRoutes.js';

/**
 * Self-hosted Expo Updates (agentes 25/10/2026): the server only STORES and SERVES what José's machine
 * signed. It holds no private key; it verifies the signature with the public certificate so garbage
 * never becomes «the latest update» of every phone.
 */
const TOKEN = 'ota-publish-test-token';
const RUNTIME = '1441aed1602610372a0cc7330e2817023eec6a3a';
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const certificate = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;

let root: string;

const sign = (payload: string, key = privateKey) => createSign('RSA-SHA256').update(payload, 'utf8').sign(key, 'base64');
const hashOf = (bytes: Buffer) => createHash('sha256').update(bytes).digest('base64url');
const bearer = { Authorization: `Bearer ${TOKEN}` };
// The same literal as `shared/src/otaPublish.ts`: the publisher signs these exact bytes.
const NO_UPDATE = '{"type":"noUpdateAvailable"}';

function buildApp(overrides: { token?: string; maxAssetBytes?: number; orphanGraceMs?: number; keep?: number } = {}) {
  const app = express();
  app.use(
    '/api/ota',
    buildOtaRouter({
      disk: () => new Disco(root, { marca: MEDIA_MARKER }),
      token: () => ('token' in overrides ? overrides.token : TOKEN),
      certificate: async () => certificate,
      maxAssetBytes: overrides.maxAssetBytes ?? 1024 * 1024,
      orphanGraceMs: overrides.orphanGraceMs ?? 0,
      keep: overrides.keep ?? 10,
    })
  );
  return app;
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'lilachat-ota-'));
  await writeFile(path.join(root, MEDIA_MARKER), 'test\n');
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function manifestOf(options: { id?: string; runtime?: string; launch: Buffer; assets?: Buffer[] }) {
  const id = options.id ?? randomUUID();
  const asset = (bytes: Buffer) => ({ hash: hashOf(bytes), key: 'k', contentType: 'image/png', fileExtension: '.png', url: `https://lilachat.test/api/ota/assets/${hashOf(bytes)}` });
  return {
    id,
    text: JSON.stringify({
      id,
      createdAt: '2026-10-25T12:00:00.000Z',
      runtimeVersion: options.runtime ?? RUNTIME,
      launchAsset: { ...asset(options.launch), contentType: 'application/javascript', fileExtension: '.bundle' },
      assets: (options.assets ?? []).map(asset),
      metadata: {},
      extra: {},
    }),
  };
}

function putAsset(app: express.Express, bytes: Buffer, contentType = 'application/javascript') {
  return request(app).put(`/api/ota/assets/${hashOf(bytes)}`).set(bearer).set('Content-Type', 'application/octet-stream').set('x-ota-content-type', contentType).send(bytes);
}

async function publish(app: express.Express, options: { id?: string; runtime?: string; launch?: Buffer; assets?: Buffer[]; noUpdate?: boolean } = {}) {
  const launch = options.launch ?? Buffer.from(`bundle-${randomUUID()}`);
  await putAsset(app, launch).expect((res) => expect([200, 201]).toContain(res.status));
  for (const bytes of options.assets ?? []) await putAsset(app, bytes, 'image/png');
  const manifest = manifestOf({ id: options.id, runtime: options.runtime, launch, assets: options.assets });
  const response = await request(app)
    .post('/api/ota/updates')
    .set(bearer)
    .send({ runtimeVersion: options.runtime ?? RUNTIME, manifest: manifest.text, signature: sign(manifest.text), ...(options.noUpdate === false ? {} : { noUpdateSignature: sign(NO_UPDATE) }) });
  return { response, manifest, launch };
}

const binary = (res: Response, done: (error: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => done(null, Buffer.concat(chunks)));
};

const protocolHeaders = { 'expo-protocol-version': '1', 'expo-platform': 'android', 'expo-runtime-version': RUNTIME };

function askManifest(app: express.Express, headers: Record<string, string> = {}) {
  return request(app).get('/api/ota/manifest').set({ ...protocolHeaders, ...headers }).buffer(true).parse(binary);
}

function partsOf(response: { headers: Record<string, string>; body: Buffer }) {
  const boundary = /boundary=(.+)$/.exec(response.headers['content-type'] ?? '')?.[1];
  expect(boundary).toBeTruthy();
  const parts: Record<string, { headers: Record<string, string>; body: string }> = {};
  for (const chunk of response.body.toString('utf8').split(`--${boundary}`)) {
    const trimmed = chunk.replace(/^\r\n/, '');
    const split = trimmed.indexOf('\r\n\r\n');
    if (split < 0) continue;
    const headers = Object.fromEntries(trimmed.slice(0, split).split('\r\n').map((line) => [line.slice(0, line.indexOf(':')).toLowerCase(), line.slice(line.indexOf(':') + 1).trim()]));
    const name = /name="([^"]+)"/.exec(headers['content-disposition'] ?? '')?.[1];
    if (name) parts[name] = { headers, body: trimmed.slice(split + 4).replace(/\r\n$/, '') };
  }
  return parts;
}

describe('GET /api/ota/manifest (public: the phone has no session)', () => {
  it('serves the latest update as the exact signed bytes, with the signature in the part header', async () => {
    // Arrange
    const app = buildApp();
    const { manifest } = await publish(app);
    // Act
    const response = await askManifest(app).expect(200);
    // Assert
    const parts = partsOf(response);
    expect(parts.manifest?.body).toBe(manifest.text);
    expect(parts.manifest?.headers['expo-signature']).toBe(`sig="${sign(manifest.text)}", keyid="main"`);
    expect(response.headers['expo-protocol-version']).toBe('1');
    expect(response.headers['expo-sfv-version']).toBe('0');
    expect(response.headers['cache-control']).toBe('private, max-age=0');
    expect(response.headers['content-type']).toMatch(/^multipart\/mixed; boundary=/);
  });

  it('says noUpdateAvailable (signed) when the phone already runs the latest', async () => {
    const app = buildApp();
    const { manifest } = await publish(app);
    const id = JSON.parse(manifest.text).id as string;
    const response = await askManifest(app, { 'expo-current-update-id': id }).expect(200);
    const parts = partsOf(response);
    expect(parts.manifest).toBeUndefined();
    expect(parts.directive?.body).toBe(NO_UPDATE);
    expect(parts.directive?.headers['expo-signature']).toBe(`sig="${sign(NO_UPDATE)}", keyid="main"`);
  });

  it('serves the update when the phone runs a different one', async () => {
    const app = buildApp();
    const { manifest } = await publish(app);
    const response = await askManifest(app, { 'expo-current-update-id': randomUUID() }).expect(200);
    expect(partsOf(response).manifest?.body).toBe(manifest.text);
  });

  it('serves the newest of two publications, and only for its own runtime', async () => {
    const app = buildApp();
    await publish(app);
    const second = await publish(app);
    await publish(app, { runtime: 'otro-runtime-1234' });
    const response = await askManifest(app).expect(200);
    expect(partsOf(response).manifest?.body).toBe(second.manifest.text);
  });

  it('a runtime nobody published for gets the signed noUpdateAvailable', async () => {
    const app = buildApp();
    await publish(app);
    const response = await askManifest(app, { 'expo-runtime-version': 'runtime-sin-updates' }).expect(200);
    expect(partsOf(response).directive?.body).toBe(NO_UPDATE);
  });

  it('answers 404 before anything was ever published (nothing signed to say)', async () => {
    await askManifest(buildApp()).expect(404);
  });

  it.each([
    ['without the protocol version', { 'expo-protocol-version': '' }],
    ['with protocol version 0', { 'expo-protocol-version': '0' }],
    ['for ios', { 'expo-platform': 'ios' }],
    ['without a runtime', { 'expo-runtime-version': '' }],
    ['with a runtime that climbs out of the folder', { 'expo-runtime-version': '../../etc' }],
    ['with a runtime with spaces', { 'expo-runtime-version': 'a b' }],
    ['with a runtime of 129 characters', { 'expo-runtime-version': 'a'.repeat(129) }],
  ])('refuses %s with 400', async (_name, headers) => {
    await askManifest(buildApp(), headers).expect(400);
  });

  it('a rollback to the embedded code is served once, and not to a phone already on it', async () => {
    const app = buildApp();
    const embedded = randomUUID();
    const directive = JSON.stringify({ type: 'rollBackToEmbedded', parameters: { commitTime: '2026-10-25T13:00:00.000Z' } });
    await request(app).post('/api/ota/updates').set(bearer).send({ runtimeVersion: RUNTIME, directive, signature: sign(directive), noUpdateSignature: sign(NO_UPDATE) }).expect(201);
    const onOta = await askManifest(app, { 'expo-current-update-id': randomUUID(), 'expo-embedded-update-id': embedded }).expect(200);
    expect(partsOf(onOta).directive?.body).toBe(directive);
    expect(partsOf(onOta).directive?.headers['expo-signature']).toBe(`sig="${sign(directive)}", keyid="main"`);
    const onEmbedded = await askManifest(app, { 'expo-current-update-id': embedded, 'expo-embedded-update-id': embedded }).expect(200);
    expect(partsOf(onEmbedded).directive?.body).toBe(NO_UPDATE);
  });
});

describe('assets', () => {
  it('stores an asset by its hash and serves it with its content type and a year of cache', async () => {
    const app = buildApp();
    const bytes = Buffer.from('console.log("hola")'.repeat(100));
    await putAsset(app, bytes).expect(201);
    const response = await request(app).get(`/api/ota/assets/${hashOf(bytes)}`).buffer(true).parse(binary).expect(200);
    expect(response.body.equals(bytes)).toBe(true);
    expect(response.headers['content-type']).toMatch(/^application\/javascript/);
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('gzips what is worth it when the phone accepts it, and the bytes come back intact', async () => {
    const app = buildApp();
    const bytes = Buffer.from('const a = 1;\n'.repeat(500));
    await putAsset(app, bytes).expect(201);
    const response = await request(app).get(`/api/ota/assets/${hashOf(bytes)}`).set('Accept-Encoding', 'gzip');
    expect(response.headers['content-encoding']).toBe('gzip');
    expect(response.headers['vary']).toMatch(/Accept-Encoding/i);
    expect(response.text).toBe(bytes.toString());
  });

  it('refuses bytes that do not hash to the name with 422 and keeps nothing', async () => {
    const app = buildApp();
    const claimed = hashOf(Buffer.from('lo que dice ser'));
    await request(app).put(`/api/ota/assets/${claimed}`).set(bearer).set('Content-Type', 'application/octet-stream').send(Buffer.from('otra cosa')).expect(422);
    await request(app).get(`/api/ota/assets/${claimed}`).expect(404);
  });

  it('a second upload of the same asset answers 200 and changes nothing', async () => {
    const app = buildApp();
    const bytes = Buffer.from('igual');
    await putAsset(app, bytes).expect(201);
    await putAsset(app, bytes).expect(200);
  });

  it('refuses an asset above the limit with 413', async () => {
    const app = buildApp({ maxAssetBytes: 16 });
    const bytes = Buffer.alloc(64, 7);
    await putAsset(app, bytes).expect(413);
    await request(app).get(`/api/ota/assets/${hashOf(bytes)}`).expect(404);
  });

  it('HEAD says whether the asset is there (200 or 404), for the publisher only', async () => {
    const app = buildApp();
    const bytes = Buffer.from('presente');
    await request(app).head(`/api/ota/assets/${hashOf(bytes)}`).set(bearer).expect(404);
    await putAsset(app, bytes).expect(201);
    await request(app).head(`/api/ota/assets/${hashOf(bytes)}`).set(bearer).expect(200);
    await request(app).head(`/api/ota/assets/${hashOf(bytes)}`).expect(401);
  });

  it.each(['..%2F..%2Fetc%2Fpasswd', 'corto', `${'a'.repeat(42)}.`, `${'a'.repeat(43)}.json`, 'a'.repeat(44)])('a name that is not a SHA-256 (%s) is refused, never read from disk', async (name) => {
    const app = buildApp();
    await request(app).get(`/api/ota/assets/${name}`).expect((res) => expect([400, 404]).toContain(res.status));
    await request(app).put(`/api/ota/assets/${name}`).set(bearer).send(Buffer.from('x')).expect((res) => expect([400, 404]).toContain(res.status));
  });
});

describe('publishing needs the token (the three routes that write)', () => {
  it('refuses PUT, HEAD and POST without a token or with a wrong one: 401', async () => {
    const app = buildApp();
    const bytes = Buffer.from('x');
    for (const header of [{}, { Authorization: 'Bearer otra-cosa' }, { Authorization: TOKEN }, { Authorization: 'Bearer ' }]) {
      await request(app).put(`/api/ota/assets/${hashOf(bytes)}`).set(header).send(bytes).expect(401);
      await request(app).head(`/api/ota/assets/${hashOf(bytes)}`).set(header).expect(401);
      await request(app).post('/api/ota/updates').set(header).send({}).expect(401);
    }
  });

  it('a server with no token configured publishes nothing, not even to an empty token', async () => {
    const app = buildApp({ token: '' as string });
    await request(app).post('/api/ota/updates').set({ Authorization: 'Bearer ' }).send({}).expect(401);
    const closed = buildApp({ token: undefined });
    await request(closed).post('/api/ota/updates').set(bearer).send({}).expect(401);
  });
});

describe('POST /api/ota/updates validates before it makes anything «the latest»', () => {
  it('refuses a signature made with another key: 422, and the latest stays the previous one', async () => {
    const app = buildApp();
    const first = await publish(app);
    const launch = Buffer.from('sospechoso');
    await putAsset(app, launch);
    const manifest = manifestOf({ launch });
    await request(app).post('/api/ota/updates').set(bearer).send({ runtimeVersion: RUNTIME, manifest: manifest.text, signature: sign(manifest.text, otherKey) }).expect(422);
    expect(partsOf(await askManifest(app)).manifest?.body).toBe(first.manifest.text);
  });

  it('refuses a manifest edited after signing: 422', async () => {
    const app = buildApp();
    const launch = Buffer.from('editado');
    await putAsset(app, launch);
    const manifest = manifestOf({ launch });
    await request(app).post('/api/ota/updates').set(bearer).send({ runtimeVersion: RUNTIME, manifest: `${manifest.text} `, signature: sign(manifest.text) }).expect(422);
  });

  it('refuses a manifest that names an asset nobody uploaded: 422, naming it', async () => {
    const app = buildApp();
    const launch = Buffer.from('lanzador');
    await putAsset(app, launch);
    const missing = Buffer.from('nunca subido');
    const manifest = manifestOf({ launch, assets: [missing] });
    const response = await request(app).post('/api/ota/updates').set(bearer).send({ runtimeVersion: RUNTIME, manifest: manifest.text, signature: sign(manifest.text) }).expect(422);
    expect(JSON.stringify(response.body)).toContain(hashOf(missing));
  });

  it('refuses a manifest whose runtime is not the one it is published for: 422', async () => {
    const app = buildApp();
    const launch = Buffer.from('runtime');
    await putAsset(app, launch);
    const manifest = manifestOf({ launch, runtime: 'otro-runtime-1234' });
    await request(app).post('/api/ota/updates').set(bearer).send({ runtimeVersion: RUNTIME, manifest: manifest.text, signature: sign(manifest.text) }).expect(422);
  });

  it('refuses a bad noUpdateAvailable signature: 422', async () => {
    const app = buildApp();
    const launch = Buffer.from('sin cambios');
    await putAsset(app, launch);
    const manifest = manifestOf({ launch });
    await request(app).post('/api/ota/updates').set(bearer).send({ runtimeVersion: RUNTIME, manifest: manifest.text, signature: sign(manifest.text), noUpdateSignature: sign(NO_UPDATE, otherKey) }).expect(422);
  });

  it.each([
    ['a runtime with a slash', { runtimeVersion: 'a/b', manifest: '{}', signature: 'x' }],
    ['neither manifest nor directive', { runtimeVersion: RUNTIME, signature: 'x' }],
    ['both manifest and directive', { runtimeVersion: RUNTIME, manifest: '{}', directive: '{}', signature: 'x' }],
    ['no signature', { runtimeVersion: RUNTIME, manifest: '{}' }],
  ])('refuses %s with 400', async (_name, body) => {
    await request(buildApp()).post('/api/ota/updates').set(bearer).send(body).expect(400);
  });
});

describe('retention', () => {
  it('keeps the last 10 updates of a runtime and drops the assets nobody uses anymore', async () => {
    const app = buildApp({ keep: 3 });
    const shared = Buffer.from('imagen compartida');
    const published = [];
    for (let index = 0; index < 5; index += 1) published.push(await publish(app, { launch: Buffer.from(`bundle ${index}`), assets: [shared] }));
    const updates = await readdir(path.join(root, 'ota', 'updates', RUNTIME));
    expect(updates.filter((name) => name !== 'latest.json')).toHaveLength(3);
    // The oldest two bundles are gone; the shared image and the newest three stay.
    await request(app).get(`/api/ota/assets/${hashOf(published[0]!.launch)}`).expect(404);
    await request(app).get(`/api/ota/assets/${hashOf(published[1]!.launch)}`).expect(404);
    await request(app).get(`/api/ota/assets/${hashOf(published[4]!.launch)}`).expect(200);
    await request(app).get(`/api/ota/assets/${hashOf(shared)}`).expect(200);
  });

  it('an asset uploaded for a publication still in progress survives the cleanup of another one (grace period)', async () => {
    const app = buildApp({ keep: 1, orphanGraceMs: 60 * 60_000 });
    const inFlight = Buffer.from('subido pero aun sin publicar');
    await putAsset(app, inFlight).expect(201);
    await publish(app);
    await publish(app);
    await request(app).get(`/api/ota/assets/${hashOf(inFlight)}`).expect(200);
    // An hour later it is just an orphan.
    const old = new Date(Date.now() - 2 * 60 * 60_000);
    await utimes(path.join(root, 'ota', 'assets', hashOf(inFlight)), old, old);
    await publish(app);
    await request(app).get(`/api/ota/assets/${hashOf(inFlight)}`).expect(404);
  });
});

describe('the disk is a USB that can be missing', () => {
  it('answers 503 with Retry-After (never a 404 that would stick) on every route when it is not mounted', async () => {
    const app = buildApp();
    await rm(path.join(root, MEDIA_MARKER));
    const bytes = Buffer.from('x');
    const manifest = await askManifest(app);
    expect(manifest.status).toBe(503);
    expect(manifest.headers['retry-after']).toBeTruthy();
    await request(app).get(`/api/ota/assets/${hashOf(bytes)}`).expect(503);
    await request(app).put(`/api/ota/assets/${hashOf(bytes)}`).set(bearer).send(bytes).expect(503);
  });

  it('creates nothing on the startup disk when the marker is missing', async () => {
    const app = buildApp();
    await rm(path.join(root, MEDIA_MARKER));
    await mkdir(path.join(root, 'sentinel'));
    await request(app).put(`/api/ota/assets/${hashOf(Buffer.from('x'))}`).set(bearer).send(Buffer.from('x'));
    expect(await readdir(root)).toEqual(['sentinel']);
  });
});
