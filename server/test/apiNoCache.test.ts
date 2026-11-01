import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

/**
 * 01/11: José's phone answered every GET /api/workspaces with a 304 against an
 * ETag the phone's HTTP cache kept; the copy it had was empty, so the app got
 * no spaces (and before 20d9eb0f, the whole app fell). The API's JSON is never
 * stored nor revalidated: every answer carries its body.
 */
describe('the API JSON is never cached', () => {
  it('no ETag and Cache-Control: no-store', async () => {
    // Act
    const response = await request(buildApp()).get('/api/health');
    // Assert
    expect(response.headers.etag).toBeUndefined();
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('a conditional request still gets the body, never a 304', async () => {
    // Arrange
    const app = buildApp();
    // Act
    const response = await request(app).get('/api/health').set('If-None-Match', '*');
    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
  });
});
