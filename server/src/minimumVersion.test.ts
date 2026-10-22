import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { appBelowMinimum, createMinimumSource, requireMinimumBuild } from './minimumVersion.js';

const OKHTTP = 'okhttp/4.12.0';

describe('appBelowMinimum', () => {
  it('rejects an app whose build header is below the minimum', () => {
    // Arrange
    const client = { build: '150' };
    // Act
    const below = appBelowMinimum(client, 151);
    // Assert
    expect(below).toBe(true);
  });

  it('lets in the minimum itself and anything newer', () => {
    expect(appBelowMinimum({ build: '151' }, 151)).toBe(false);
    expect(appBelowMinimum({ build: '160' }, 151)).toBe(false);
  });

  it('a request without the header is never judged (an old app, the web, bots, media downloads)', () => {
    expect(appBelowMinimum({}, 999)).toBe(false);
  });

  it('a broken header is ignored, not read as zero', () => {
    expect(appBelowMinimum({ build: 'abc' }, 151)).toBe(false);
  });

  it('without a minimum (0, LilaStore did not answer) nobody is rejected', () => {
    expect(appBelowMinimum({ build: '1' }, 0)).toBe(false);
  });
});

describe('createMinimumSource', () => {
  it('asks LilaStore once per period and keeps the answer', async () => {
    // Arrange
    let now = 0;
    const fetchMinimum = vi.fn(async () => 151);
    const source = createMinimumSource({ fetchMinimum, maxAgeMs: 60_000, now: () => now });
    // Act
    source.refresh();
    await vi.waitFor(() => expect(source.current()).toBe(151));
    now = 30_000;
    source.refresh();
    // Assert
    expect(fetchMinimum).toHaveBeenCalledTimes(1);
  });

  it('a failure keeps the last known minimum (an outage does not unlock or lock anyone)', async () => {
    let now = 0;
    const fetchMinimum = vi.fn<() => Promise<number>>().mockResolvedValueOnce(151).mockRejectedValueOnce(new Error('down'));
    const source = createMinimumSource({ fetchMinimum, maxAgeMs: 1_000, now: () => now });
    source.refresh();
    await vi.waitFor(() => expect(source.current()).toBe(151));
    now = 5_000;
    source.refresh();
    await vi.waitFor(() => expect(fetchMinimum).toHaveBeenCalledTimes(2));
    expect(source.current()).toBe(151);
  });
});

describe('requireMinimumBuild', () => {
  const appWith = (minimum: number) => {
    const app = express();
    app.use('/api', requireMinimumBuild({ current: () => minimum, refresh: () => undefined }));
    app.get('/api/chats', (_req, res) => res.json({ ok: true }));
    app.post('/api/crash', (_req, res) => res.json({ ok: true }));
    return app;
  };

  it('answers 426 with the minimum to an old app', async () => {
    const response = await request(appWith(151)).get('/api/chats').set('User-Agent', OKHTTP).set('x-lilachat-build', '150');
    expect(response.status).toBe(426);
    expect(response.body).toEqual({ message: 'Actualiza Lilachat para seguir usándola.', code: 'update_required', minVersionCode: 151 });
  });

  it('lets a current app through', async () => {
    const response = await request(appWith(151)).get('/api/chats').set('User-Agent', OKHTTP).set('x-lilachat-build', '151');
    expect(response.status).toBe(200);
  });

  it('crash reports from an old app still come in', async () => {
    const response = await request(appWith(151)).post('/api/crash').set('User-Agent', OKHTTP).set('x-lilachat-build', '100');
    expect(response.status).toBe(200);
  });
});
