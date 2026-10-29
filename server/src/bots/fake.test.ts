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
/** What the fake agentes answers in the body (R160 forms); empty by default. */
let answer: (type: string) => unknown = () => null;
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
      const reply = answer(String(req.headers['x-lilachat-event']));
      if (reply === null) return void res.end();
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(reply));
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
  answer = () => null;
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

  it('slash commands like the server: register, invoke signed, answer later up to the rules', async () => {
    const { token, signing } = await install();
    const asBot = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    expect((await call('/api/bots/commands', { method: 'PUT', headers: asBot, body: JSON.stringify({ commands: [{ command: '/Clima', description: 'x' }] }) })).body.error).toBe('invalid_request');
    expect((await call('/api/bots/commands', { method: 'PUT', headers: asBot, body: JSON.stringify({ commands: [{ command: 'clima', description: 'Clima de hoy', usage_hint: '[distrito]' }] }) })).body).toEqual({ commands: [{ command: 'clima', description: 'Clima de hoy', usage_hint: '[distrito]' }] });
    expect((await call('/__fake/command', { method: 'POST', headers: asBot, body: JSON.stringify({ command: 'tanques' }) })).status).toBe(404);
    const invoked = await call('/__fake/command', { method: 'POST', headers: asBot, body: JSON.stringify({ command: 'clima', text: 'lurin' }) });
    expect(invoked.body.outcome).toBe('pending');
    const event = received.find((one) => one.headers['x-lilachat-event'] === 'command.invoked')!;
    expect(event.headers['x-lilachat-signature']).toBe(`v1=${createHmac('sha256', signing).update(`${event.headers['x-lilachat-timestamp']}.${event.body}`).digest('hex')}`);
    expect(JSON.parse(event.body).data).toMatchObject({ command_id: invoked.body.command_id, command: 'clima', text: 'lurin', user: { phone: '51902049935' } });
    const respond = (body: unknown) => call(`/api/bots/commands/${invoked.body.command_id}/respond`, { method: 'POST', headers: asBot, body: JSON.stringify(body) });
    expect((await respond({})).status).toBe(400);
    expect((await respond({ text: 'Lurín: 24 °C' })).body).toEqual({ response_type: 'ephemeral' });
    for (let index = 0; index < 4; index++) await respond({ text: `vez ${index}` });
    expect((await respond({ text: 'una más' })).body.error).toBe('too_many_responses');
    expect((await call('/__fake/command-responses')).body.responses).toHaveLength(5);
  });

  it('apps by manifest like the server: create once, install with their own secret, rotate, list, delete', async () => {
    const asDeveloper = { Authorization: `Basic ${Buffer.from('lca_test:lcx_test').toString('base64')}`, 'Content-Type': 'application/json' };
    const body = { key: 'inframaq', name: 'Inframaq', redirect_uri: REDIRECT, webhook_url: 'http://127.0.0.1:1/events', commands: [{ command: 'clima', description: 'Clima' }] };
    expect((await call('/api/bots/apps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).status).toBe(401);
    const created = await call('/api/bots/apps', { method: 'POST', headers: asDeveloper, body: JSON.stringify(body) });
    expect(created.status).toBe(201);
    expect(String(created.body.client_secret)).toMatch(/^lcx_/);
    expect((await call('/api/bots/apps', { method: 'POST', headers: asDeveloper, body: JSON.stringify({ ...body, name: 'Inframaq Planta' }) })).body).toEqual({ client_id: created.body.client_id });
    const authorize = await fetch(`${base()}/instalar-app?client_id=${created.body.client_id}&redirect_uri=${encodeURIComponent(REDIRECT)}&state=state-0123456789abcdef&code_challenge=${CHALLENGE}&code_challenge_method=S256`, { redirect: 'manual' });
    const code = new URL(authorize.headers.get('location')!).searchParams.get('code');
    const exchange = (secret: unknown) => call('/api/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: created.body.client_id, client_secret: secret, code_verifier: VERIFIER }) });
    expect((await exchange(created.body.client_secret)).status).toBe(200);
    const rotated = await call(`/api/bots/apps/${created.body.client_id}/secret`, { method: 'POST', headers: asDeveloper });
    expect(rotated.body.client_secret).not.toBe(created.body.client_secret);
    expect((await call('/api/bots/apps', { headers: asDeveloper })).body.apps).toEqual([expect.objectContaining({ client_id: created.body.client_id, name: 'Inframaq Planta' })]);
    expect((await fetch(`${base()}/api/bots/apps/${created.body.client_id}`, { method: 'DELETE', headers: asDeveloper })).status).toBe(204);
    expect((await call(`/api/bots/apps/${created.body.client_id}/secret`, { method: 'POST', headers: asDeveloper })).status).toBe(404);
  });

  it('pending 21 like the server: PUT the client creates its channel, posts by client keep kind, thread and refs', async () => {
    const { token } = await install();
    const asBot = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const putClient = (body: unknown, id = 'cli-1') => call(`/api/bots/clients/${id}`, { method: 'PUT', headers: asBot, body: JSON.stringify(body) });
    const bot = (body: unknown) => call('/api/bots/messages', { method: 'POST', headers: asBot, body: JSON.stringify(body) });
    const recent = new Date(Date.now() - 86_400_000).toISOString();
    expect((await bot({ client: 'cli-1', text: 'x', idempotency_key: 'c0' })).body.error).toBe('client_not_found');
    expect((await putClient({ name: 'Transportes Huaral', last_order_at: recent, services: [{ id: 's1', name: 'Base', status: 'done' }] })).body.error).toBe('invalid_request');
    const created = await putClient({ name: 'Transportes Huaral', last_order_at: recent, orders_total: 3, services: [] });
    expect(created).toMatchObject({ status: 201, body: { client: { id: 'cli-1', live: true, archived_since: null, channel: { name: 'Transportes Huaral' } } } });
    expect((await putClient({ name: 'Transportes Huaral', last_order_at: '2026-01-10T00:00:00Z', services: [{ id: 's1', name: 'Base', status: 'completed' }] })).body.client).toMatchObject({ live: false, archived_since: '2026-04-10T00:00:00.000Z' });
    const card = await bot({ client: 'cli-1', kind: 'order.created', refs: { record_id: 'ped-1' }, text: 'Pedido PED-1', idempotency_key: 'c1' });
    const dispatched = await bot({ client: 'cli-1', kind: 'order.dispatched', thread_of: card.body.message.seq, text: 'Salió la unidad 1', idempotency_key: 'c2' });
    expect(card.body.message.chat_id).toBe(created.body.client.channel.id);
    expect(dispatched.status).toBe(201);
    expect((await bot({ client: 'cli-1', kind: 'Pedido', text: 'x', idempotency_key: 'c3' })).body.error).toBe('invalid_request');
    expect((await call('/__fake/messages')).body.messages.slice(-2)).toMatchObject([{ kind: 'order.created', refs: { record_id: 'ped-1' } }, { kind: 'order.dispatched', thread_of: card.body.message.seq }]);
  });

  it('revoking kills the token', async () => {
    const { token } = await install();
    expect((await call('/api/oauth/revoke', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })).status).toBe(200);
    expect((await call('/api/bots/me', { headers: { Authorization: `Bearer ${token}` } })).status).toBe(401);
  });

  it('R160 like the server: topics by manifest, #general by default, null is 409; ⚡ and form answers in the body; the photo downloads', async () => {
    // Arrange: an app by manifest with its topics and actions, installed with its own secret.
    const developer = { Authorization: `Basic ${Buffer.from('lca_test:lcx_test').toString('base64')}`, 'Content-Type': 'application/json' };
    const created = await call('/api/bots/apps', { method: 'POST', headers: developer, body: JSON.stringify({ key: 'inframaq', name: 'Inframaq', redirect_uri: REDIRECT, webhook_url: 'http://127.0.0.1:1/events', shortcuts: [{ key: 'marcar_asistencia', name: 'Marcar asistencia' }], notice_topics: [{ key: 'asistencia', name: 'Asistencia', icon: 'attendance' }, { key: 'caja', name: 'Caja', icon: 'piggy' }] }) });
    const authorize = await fetch(`${base()}/instalar-app?client_id=${created.body.client_id}&redirect_uri=${encodeURIComponent(REDIRECT)}&state=state-0123456789abcdef&code_challenge=${CHALLENGE}&code_challenge_method=S256`, { redirect: 'manual' });
    const code = new URL(authorize.headers.get('location')!).searchParams.get('code');
    const token = (await call('/api/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: created.body.client_id, client_secret: created.body.client_secret, code_verifier: VERIFIER }) })).body.access_token;
    const asBot = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const post = (body: unknown) => call('/api/bots/messages', { method: 'POST', headers: asBot, body: JSON.stringify(body) });
    // Act + Assert: topics.
    expect((await call('/api/bots/topics', { headers: asBot })).body.topics).toEqual([{ key: 'asistencia', name: 'Asistencia', channel: { id: 'ch_general', name: 'general' } }, { key: 'caja', name: 'Caja', channel: { id: 'ch_general', name: 'general' } }]);
    expect((await call('/api/bots/topics', { method: 'PUT', headers: asBot, body: JSON.stringify({ asistencia: 'ch_planta', caja: null }) })).status).toBe(200);
    expect((await post({ topic: 'asistencia', text: 'Ingreso', idempotency_key: 't1' })).body).toMatchObject({ message: { chat_id: 'ch_planta' } });
    expect((await post({ topic: 'caja', text: 'S/ 10', idempotency_key: 't2' })).body.error).toBe('topic_without_channel');
    expect((await post({ topic: 'planilla', text: 'x', idempotency_key: 't3' })).status).toBe(404);
    expect((await call('/api/bots/topics', { method: 'PUT', headers: asBot, body: JSON.stringify({ planilla: 'ch_planta' }) })).status).toBe(400);
    // The ⚡: the action answers with a form, in the body.
    const form = { id: 'registrar_marca', title: 'Marcar asistencia', schema: { type: 'object', properties: { foto: { type: 'string', 'x-input': 'photo' } } } };
    answer = (type) => (type === 'shortcut.invoked' ? { response_type: 'form', form } : { response_type: 'ephemeral', text: 'Ingreso marcado', shareable: false });
    const opened = await call('/__fake/emit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'shortcut.invoked', data: { shortcut: 'marcar_asistencia' } }) });
    expect(opened.body).toMatchObject({ outcome: 'form', response: { form: { id: 'registrar_marca' } } });
    expect(JSON.parse(received.at(-1)!.body).data).toMatchObject({ shortcut: 'marcar_asistencia', command_id: opened.body.command_id, channel: null });
    // The form: "@photo" becomes a signed URL that downloads as a JPEG.
    const sent = await call('/__fake/emit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'form.submitted', data: { command_id: opened.body.command_id, values: { foto: '@photo' } } }) });
    expect(sent.body).toMatchObject({ outcome: 'ephemeral', response: { text: 'Ingreso marcado', shareable: false } });
    const photoUrl = String((JSON.parse(received.at(-1)!.body).data.values as Record<string, unknown>).foto);
    const photo = await fetch(photoUrl);
    expect([photo.status, photo.headers.get('content-type')]).toEqual([200, 'image/jpeg']);
    expect((await fetch(`${photoUrl}x`)).status).toBe(404);
    answer = () => ({ errors: { foto: 'La foto está borrosa.' } });
    expect((await call('/__fake/emit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'form.submitted', data: { command_id: opened.body.command_id, values: { foto: '@photo' } } }) })).body).toMatchObject({ outcome: 'errors', errors: { foto: 'La foto está borrosa.' } });
  });
});
