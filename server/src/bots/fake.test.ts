import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { startFake, type RunningFake } from '../../../tools/bots-fake/lilachat-bots-fake.mjs';

/** The fake agentes runs in its CI keeps the contract's shapes (`specs/BOTS-API.spec.md` §e). */
const REDIRECT = 'http://localhost:3999/canales/lilachat/vuelta';
const VERIFIER = 'v'.repeat(64);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');
let fake: RunningFake;
let hook: Server;
const received: { headers: Record<string, string | string[] | undefined>; body: string }[] = [];
const base = () => `http://127.0.0.1:${fake.port}`;
const call = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${base()}${path}`, init);
  return { status: response.status, body: (await response.json().catch(() => ({}))) as Record<string, unknown> };
};

beforeAll(async () => {
  hook = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      received.push({ headers: req.headers, body });
      res.end();
    });
  });
  await new Promise<void>((resolve) => hook.listen(0, '127.0.0.1', resolve));
  fake = await startFake({ port: 0, redirectUri: REDIRECT, webhookUrl: `http://127.0.0.1:${(hook.address() as AddressInfo).port}/events`, retryDelaysMs: [50] });
});
afterAll(async () => {
  await fake.close();
  hook.close();
});
beforeEach(() => {
  fake.reset();
  received.length = 0;
});

async function install(): Promise<{ token: string; signing: string; installationId: string }> {
  const authorize = await fetch(`${base()}/instalar-app?client_id=lca_test&redirect_uri=${encodeURIComponent(REDIRECT)}&state=state-0123456789abcdef&code_challenge=${CHALLENGE}&code_challenge_method=S256`, { redirect: 'manual' });
  const back = new URL(authorize.headers.get('location')!);
  expect(back.searchParams.get('state')).toBe('state-0123456789abcdef');
  const token = await call('/api/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'authorization_code', code: back.searchParams.get('code'), redirect_uri: REDIRECT, client_id: 'lca_test', client_secret: 'lcx_test', code_verifier: VERIFIER }) });
  expect(token.status).toBe(200);
  expect(token.body).toMatchObject({ token_type: 'Bearer', space: { name: 'Espacio de prueba' } });
  return { token: String(token.body.access_token), signing: String(token.body.signing_secret), installationId: String(token.body.installation_id) };
}

describe('the bots fake', () => {
  it('installs with code + PKCE, and the code works once', async () => {
    const { token } = await install();
    expect(token).toMatch(/^lcb_/);
    expect((await call('/api/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'authorization_code', code: 'lco_nope', redirect_uri: REDIRECT, client_id: 'lca_test', client_secret: 'lcx_test', code_verifier: VERIFIER }) })).body.error).toBe('invalid_grant');
  });

  it('publishes with the same answers as the server: 201, the same message for the same key, 403, 404 and 400', async () => {
    const { token } = await install();
    const bot = (body: unknown) => call('/api/bots/messages', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const first = await bot({ channel_id: 'ch_planta', text: 'Pedido listo', idempotency_key: 'k1' });
    expect(first.status).toBe(201);
    expect((await bot({ channel_id: 'ch_planta', text: 'Pedido listo', idempotency_key: 'k1' })).body).toEqual(first.body);
    expect((await bot({ channel_id: 'ch_gerencia', text: 'x', idempotency_key: 'k2' })).body.error).toBe('not_in_channel');
    expect((await bot({ user: { phone: '51911111111' }, text: 'x', idempotency_key: 'k3' })).body.error).toBe('user_not_found');
    expect((await bot({ channel_id: 'ch_planta', idempotency_key: 'k4', checklist: { title: 'T', items: [{ text: 'a', assignee_phone: '51911111111' }] } })).body).toMatchObject({ error: 'assignee_not_member', phone: '51911111111' });
    expect((await bot({ user: { phone: '51987654321' }, card: { title: '¿Confirmas?', actions: [{ id: 'confirm', label: 'Confirmar', value: 'p' }] }, idempotency_key: 'k5' })).status).toBe(201);
  });

  it('emits signed events, with the installation in a header and the same delivery id as the event id', async () => {
    const { signing, installationId } = await install();
    fake.emit('button.click', { action: { id: 'confirm', value: 'p' }, user: { phone: '51987654321' } });
    const start = Date.now();
    while (received.length === 0 && Date.now() - start < 3000) await new Promise((resolve) => setTimeout(resolve, 20));
    const event = received[0]!;
    expect(event.headers['x-lilachat-installation']).toBe(installationId);
    expect(event.headers['x-lilachat-signature']).toBe(`v1=${createHmac('sha256', signing).update(`${event.headers['x-lilachat-timestamp']}.${event.body}`).digest('hex')}`);
    expect(JSON.parse(event.body)).toMatchObject({ type: 'button.click', event_id: event.headers['x-lilachat-delivery'] });
  });

  it('revoking kills the token', async () => {
    const { token } = await install();
    expect((await call('/api/oauth/revoke', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })).status).toBe(200);
    expect((await call('/api/bots/me', { headers: { Authorization: `Bearer ${token}` } })).status).toBe(401);
  });
});
