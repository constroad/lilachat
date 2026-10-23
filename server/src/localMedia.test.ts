import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Disco } from './disco.js';
import { buildLocalUploader } from './localMediaUploader.js';
import { MEDIA_MARKER, ownMediaRelative } from './mediaDisk.js';
import { buildMediaServeRouter } from './mediaServeRoutes.js';
import { toAbsoluteMediaUrl } from './mediaClient.js';
import type { MediaUploader } from './mediaClient.js';

/**
 * Pending 82 (José, 23/10): Lilachat keeps its own media instead of uploading
 * to lila. Files land under CHAT_STORAGE_ROOT with the same layout lila used
 * (`apps/lilachat/<chatId>/…`), a hash in the name so the public URL cannot be
 * guessed, a 640 px thumbnail, and Range on the way out.
 */
let root: string;
let disk: Disco;
const CHAT = '6ad8b0cf30ce97957f4acc0c';
const fallback: MediaUploader = { upload: vi.fn(async () => ({ ok: true as const, media: { url: '/files/companies/constroad/apps/lilachat/x.jpg', sizeBytes: 3, storageName: 'x.jpg' } })) };

const png = () => sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 120, g: 60, b: 200 } } }).png().toBuffer();
const appWith = (served: Disco) => express().use('/media', buildMediaServeRouter(() => served));

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'lilachat-medios-'));
  await writeFile(path.join(root, MEDIA_MARKER), '');
  disk = new Disco(root, { marca: MEDIA_MARKER });
  vi.mocked(fallback.upload).mockClear();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('own media storage (pending 82)', () => {
  it('a photo is stored with a hash in its name, gets a 640 px thumbnail, and its URL is ours', async () => {
    const bytes = await png();
    const outcome = await buildLocalUploader({ disk: () => disk, fallback }).upload({ chatId: CHAT, fileName: 'foto obra.png', mimeType: 'image/png', kind: 'image', bytes });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.media.url).toMatch(new RegExp(`^/media/apps/lilachat/${CHAT}/image-[0-9T-]+Z?_[0-9a-f]{16}\\.png$`));
    expect(await readFile(path.join(root, outcome.media.url.replace('/media/', '')))).toEqual(bytes);
    expect(outcome.media).toMatchObject({ thumbnailStatus: 'ready', sizeBytes: bytes.length });
    const thumb = await sharp(path.join(root, outcome.media.thumbnailUrl!.replace('/media/', ''))).metadata();
    expect(Math.max(thumb.width!, thumb.height!)).toBe(640);
    expect(fallback.upload).not.toHaveBeenCalled();
  });

  it('a video gets its thumbnail when it can, and says «unsupported» when it cannot, without failing', async () => {
    const uploader = buildLocalUploader({ disk: () => disk, fallback, videoThumbnail: async () => false });
    const outcome = await uploader.upload({ chatId: CHAT, fileName: 'v.mp4', mimeType: 'video/mp4', kind: 'video', bytes: Buffer.from('not really a video') });
    expect(outcome).toMatchObject({ ok: true, media: { thumbnailStatus: 'unsupported' } });
    if (outcome.ok) expect(outcome.media.streamUrl).toBe(outcome.media.url);
  });

  it('while the root has no marker, uploads keep going to lila: nobody loses a photo during the move', async () => {
    await rm(path.join(root, MEDIA_MARKER));
    const outcome = await buildLocalUploader({ disk: () => disk, fallback }).upload({ chatId: CHAT, fileName: 'a.jpg', mimeType: 'image/jpeg', kind: 'image', bytes: Buffer.from('abc') });
    expect(fallback.upload).toHaveBeenCalledTimes(1);
    expect(outcome).toMatchObject({ ok: true, media: { url: '/files/companies/constroad/apps/lilachat/x.jpg' } });
  });

  it('serves the file with Range and a long cache, and never walks out of the root', async () => {
    const outcome = await buildLocalUploader({ disk: () => disk, fallback }).upload({ chatId: CHAT, fileName: 'f.png', mimeType: 'image/png', kind: 'image', bytes: await png() });
    if (!outcome.ok) throw new Error('upload failed');
    const full = await request(appWith(disk)).get(outcome.media.url).expect(200);
    expect(full.headers['cache-control']).toContain('immutable');
    expect(full.headers['content-type']).toBe('image/png');
    const part = await request(appWith(disk)).get(outcome.media.url).set('Range', 'bytes=0-9').expect(206);
    expect(part.body.length).toBe(10);
    await request(appWith(disk)).get('/media/../../etc/passwd').expect(404);
    await request(appWith(disk)).get(`/media/apps/lilachat/${CHAT}/no-existe.png`).expect(404);
  });

  it('without the disk a read answers 503 with Retry-After, never 404: the photo comes back by itself', async () => {
    await rm(path.join(root, MEDIA_MARKER));
    const answer = await request(appWith(disk)).get(`/media/apps/lilachat/${CHAT}/x.png`).expect(503);
    expect(answer.headers['retry-after']).toBe('5');
  });

  it('our URLs get our host and lila’s keep lila’s, so old and new messages both load', () => {
    process.env.LILA_PUBLIC_URL = 'https://lila.example.com';
    expect(toAbsoluteMediaUrl(`/media/apps/lilachat/${CHAT}/a.png`)).toBe(`https://lilachat.constroad.com/media/apps/lilachat/${CHAT}/a.png`);
    expect(toAbsoluteMediaUrl('/files/companies/constroad/a.png')).toBe('https://lila.example.com/files/companies/constroad/a.png');
    expect(ownMediaRelative(`https://lilachat.constroad.com/media/apps/lilachat/${CHAT}/a.png`)).toBe(`apps/lilachat/${CHAT}/a.png`);
    expect(ownMediaRelative('https://lila.example.com/files/a.png')).toBeNull();
  });
});
