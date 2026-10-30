import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { missingVersionedFile } from './staleAssets.js';

/** José 30/10: a tab open across a deploy asked for the old emoji panel and got the page instead, so the web broke. */
describe('missingVersionedFile', () => {
  const app = express();
  app.use(missingVersionedFile);
  app.get(/.*/, (_req, res) => res.type('html').send('<html>spa</html>'));

  it('a missing file of a versioned folder is a 404 in plain text, never the page', async () => {
    const response = await request(app).get('/assets/EmojiStickerPanel-oldhash.js');
    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain('text/plain');
    expect((await request(app).get('/stickers/pack-v1/x.webp')).status).toBe(404);
  });

  it('any other route still gets the page: the app routes itself', async () => {
    const response = await request(app).get('/c/6ada319d4b7079faac7388aa');
    expect(response.status).toBe(200);
    expect(response.text).toContain('spa');
    expect((await request(app).get('/assetsx/thing')).status).toBe(200);
  });
});
