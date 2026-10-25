import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { buildApp } from '../app.js';
import { MEDIA_MARKER } from '../mediaDisk.js';

/**
 * The OTA router is mounted in the real app BEFORE the global JSON parser: an asset published as
 * `application/json` (a Lottie, a font map) would otherwise be consumed by the parser and arrive empty.
 */
let root: string;
const token = 'ota-mount-test-token';

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'lilachat-ota-mount-'));
  await writeFile(path.join(root, MEDIA_MARKER), 'test\n');
  process.env.CHAT_STORAGE_ROOT = root;
  process.env.OTA_PUBLISH_TOKEN = token;
});
afterAll(async () => {
  delete process.env.CHAT_STORAGE_ROOT;
  delete process.env.OTA_PUBLISH_TOKEN;
  await rm(root, { recursive: true, force: true });
});

describe('/api/ota inside the real app', () => {
  it('stores a JSON asset byte for byte even though the app parses JSON everywhere else', async () => {
    // Arrange
    const app = buildApp();
    const bytes = Buffer.from(JSON.stringify({ animacion: 'lottie', cuadros: [1, 2, 3] }));
    const hash = createHash('sha256').update(bytes).digest('base64url');
    // Act
    await request(app).put(`/api/ota/assets/${hash}`).set('Authorization', `Bearer ${token}`).set('Content-Type', 'application/json').set('x-ota-content-type', 'application/json').send(bytes.toString()).expect(201);
    // Assert
    const served = await request(app).get(`/api/ota/assets/${hash}`).expect(200);
    expect(served.text).toBe(bytes.toString());
  });

  it('is open to the phones without a session and without the build header (the minimum-build gate does not apply)', async () => {
    const response = await request(buildApp()).get('/api/ota/manifest').set({ 'expo-protocol-version': '1', 'expo-platform': 'android', 'expo-runtime-version': 'a'.repeat(40) });
    expect([200, 404]).toContain(response.status);
  });
});
