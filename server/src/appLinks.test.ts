import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildApp } from './app.js';

/** Pending 47 (José, 22/10): Android verifies the join links against this file. */
describe('assetlinks.json', () => {
  it('names the app’s package and its release key, as JSON', async () => {
    const response = await request(buildApp({})).get('/.well-known/assetlinks.json').expect(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body[0].target).toEqual({
      namespace: 'android_app',
      package_name: 'com.lilachat.app',
      sha256_cert_fingerprints: ['82:C7:94:02:2A:D6:22:F6:FD:EE:04:F1:FA:B9:ED:49:8E:BB:5F:82:24:A1:74:DA:C4:29:36:62:D0:4A:24:C9'],
    });
    expect(response.body[0].relation).toEqual(['delegate_permission/common.handle_all_urls']);
  });
});
