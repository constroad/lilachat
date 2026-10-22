#!/usr/bin/env node
/**
 * Fake of Lilachat's bots API for agentes' CI (`specs/BOTS-API.spec.md` §e).
 * One file, Node >= 18, no dependencies, everything in memory. Same routes,
 * same shapes and same signatures as the real server; `/instalar-app`
 * approves by itself (add `deny=1` to the URL to get `access_denied`).
 *
 *   PORT=4100 CLIENT_ID=lca_test CLIENT_SECRET=lcx_test \
 *   REDIRECT_URI=http://localhost:3000/canales/lilachat/vuelta \
 *   WEBHOOK_URL=http://localhost:3000/v1/channels/lilachat/events \
 *   node lilachat-bots-fake.mjs
 *
 * Test controls: POST /__fake/emit { type, data } signs and sends an event to
 * WEBHOOK_URL (with the real retries); GET /__fake/messages lists what the bot
 * published; GET /__fake/deliveries the events and their attempts; POST
 * /__fake/reset starts over. Optional: SPACE_NAME, CHANNELS and MEMBERS (JSON),
 * RETRY_DELAYS_MS ("10000,60000,300000,1800000").
 */
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const DEFAULT_CHANNELS = [
  { id: 'ch_general', name: 'general', visibility: 'public' },
  { id: 'ch_planta', name: 'planta', visibility: 'public' },
  { id: 'ch_gerencia', name: 'gerencia', visibility: 'private' },
];
const DEFAULT_MEMBERS = [
  { id: 'u_jose', name: 'José Zamora', phone: '51902049935', role: 'owner', title: 'Gerente' },
  { id: 'u_ana', name: 'Ana Torres', phone: '51987654321', role: 'member', title: 'Residente de obra', area: 'Obra' },
];
const MESSAGES_PER_MINUTE = 60;
const ACTION_ID = /^[a-z0-9_-]{1,40}$/;

const secret = (prefix) => `${prefix}${randomBytes(32).toString('base64url')}`;
const sign = (signingSecret, timestamp, body) => `v1=${createHmac('sha256', signingSecret).update(`${timestamp}.${body}`).digest('hex')}`;
const localPhone = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '').replace(/^0+/, '');
  const local = digits.startsWith('51') && digits.length === 11 ? digits.slice(2) : digits;
  return /^9\d{8}$/.test(local) ? `51${local}` : '';
};

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      if (!raw) return resolve({});
      if (String(req.headers['content-type'] ?? '').includes('application/x-www-form-urlencoded')) return resolve(Object.fromEntries(new URLSearchParams(raw)));
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

function validateCard(card) {
  if (!card || typeof card.title !== 'string' || !card.title.trim()) return 'La tarjeta necesita un título.';
  if ((card.fields ?? []).length > 12) return 'La tarjeta lleva hasta 12 campos.';
  if (card.link?.url && !String(card.link.url).startsWith('https://')) return 'El enlace de la tarjeta debe empezar con https://.';
  const actions = card.actions ?? [];
  if (actions.length > 3) return 'La tarjeta lleva hasta 3 acciones.';
  for (const action of actions) {
    if (!ACTION_ID.test(String(action.id ?? ''))) return 'El id de una acción va con a-z, 0-9, guion o guion bajo, hasta 40.';
    if (!String(action.label ?? '').trim()) return 'Cada acción necesita una etiqueta.';
    if (String(action.value ?? '').length > 2000) return 'El valor de una acción lleva hasta 2000 caracteres.';
  }
  if (new Set(actions.map((action) => action.id)).size !== actions.length) return 'Hay acciones repetidas.';
  return null;
}

export function createFake(options = {}) {
  const config = {
    clientId: options.clientId ?? process.env.CLIENT_ID ?? 'lca_test',
    clientSecret: options.clientSecret ?? process.env.CLIENT_SECRET ?? 'lcx_test',
    redirectUri: options.redirectUri ?? process.env.REDIRECT_URI ?? 'http://localhost:3000/canales/lilachat/vuelta',
    webhookUrl: options.webhookUrl ?? process.env.WEBHOOK_URL ?? 'http://localhost:3000/v1/channels/lilachat/events',
    spaceName: options.spaceName ?? process.env.SPACE_NAME ?? 'Espacio de prueba',
    channels: options.channels ?? (process.env.CHANNELS ? JSON.parse(process.env.CHANNELS) : DEFAULT_CHANNELS),
    members: options.members ?? (process.env.MEMBERS ? JSON.parse(process.env.MEMBERS) : DEFAULT_MEMBERS),
    retryDelaysMs: options.retryDelaysMs ?? (process.env.RETRY_DELAYS_MS ? process.env.RETRY_DELAYS_MS.split(',').map(Number) : [10_000, 60_000, 300_000, 1_800_000]),
  };
  let state;
  const reset = () => {
    state = { codes: new Map(), installation: null, messages: [], deliveries: [], minute: { start: Date.now(), used: 0 }, seq: 0, joined: new Set(config.channels.filter((c) => c.visibility === 'public').map((c) => c.id)) };
  };
  reset();

  const install = () => {
    const token = secret('lcb_');
    state.installation = { id: `inst_${randomBytes(6).toString('hex')}`, spaceId: 'sp_fake', botUserId: 'u_bot', tokenHash: createHash('sha256').update(token).digest('hex'), signingSecret: secret('lcs_') };
    return token;
  };
  const botOf = (req) => {
    const header = String(req.headers.authorization ?? '');
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const hash = createHash('sha256').update(token).digest('hex');
    return state.installation && state.installation.tokenHash === hash ? state.installation : null;
  };

  async function attempt(delivery) {
    const timestamp = Date.now();
    let error = null;
    try {
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Lilachat-Event': delivery.type, 'X-Lilachat-Delivery': delivery.id, 'X-Lilachat-Installation': delivery.installationId, 'X-Lilachat-Timestamp': String(timestamp), 'X-Lilachat-Signature': sign(delivery.signingSecret, timestamp, delivery.body) },
        body: delivery.body,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) error = `HTTP ${response.status}`;
    } catch (failure) {
      error = failure instanceof Error ? failure.message : String(failure);
    }
    delivery.attempts.push({ at: new Date().toISOString(), error });
    const delay = config.retryDelaysMs[delivery.attempts.length - 1];
    delivery.status = error === null ? 'delivered' : delay === undefined ? 'failed' : 'pending';
    if (delivery.status === 'pending') setTimeout(() => void attempt(delivery), delay).unref();
  }

  function emit(type, data) {
    const installation = state.installation;
    if (!installation) return null;
    const id = randomUUID();
    const body = JSON.stringify({ event_id: id, type, installation_id: installation.id, space_id: installation.spaceId, created_at: new Date().toISOString(), data: data ?? {} });
    const delivery = { id, type, body, installationId: installation.id, signingSecret: installation.signingSecret, attempts: [], status: 'pending' };
    state.deliveries.push(delivery);
    void attempt(delivery);
    return id;
  }

  function postMessage(body) {
    const channelId = typeof body.channel_id === 'string' && body.channel_id ? body.channel_id : null;
    const user = body.user && typeof body.user === 'object' ? body.user : null;
    if (Boolean(channelId) === Boolean(user)) return [400, { error: 'invalid_request', message: 'Indica un destino: channel_id o user, uno solo.' }];
    const key = typeof body.idempotency_key === 'string' ? body.idempotency_key.trim() : '';
    if (!key || key.length > 120) return [400, { error: 'invalid_request', message: 'idempotency_key es obligatorio, hasta 120.' }];
    const known = state.messages.find((message) => message.idempotency_key === key);
    if (known) return [200, { message: { id: known.id, chat_id: known.chat_id, seq: known.seq } }];
    if (!body.text && !body.card && !body.checklist) return [400, { error: 'invalid_request', message: 'Manda un texto, una tarjeta o un checklist.' }];
    if (typeof body.text === 'string' && body.text.length > 4000) return [400, { error: 'invalid_request', message: 'El texto es demasiado largo (máximo 4000).' }];
    if (body.card) {
      const problem = validateCard(body.card);
      if (problem) return [400, { error: 'invalid_request', message: problem }];
    }
    for (const item of body.checklist?.items ?? []) {
      if (!item.assignee_phone) continue;
      const phone = localPhone(item.assignee_phone);
      if (!config.members.some((member) => member.phone === phone)) return [400, { error: 'assignee_not_member', message: `El responsable ${item.assignee_phone} no es miembro activo del espacio.`, phone: phone || String(item.assignee_phone) }];
    }
    let chatId;
    if (channelId) {
      const channel = config.channels.find((one) => one.id === channelId);
      if (!channel) return [404, { error: 'channel_not_found', message: 'Ese canal no existe en el espacio.' }];
      if (channel.visibility !== 'public' && !state.joined.has(channelId)) return [403, { error: 'not_in_channel', message: 'El bot no está en ese canal privado o grupo: alguien tiene que agregarlo.' }];
      chatId = channelId;
    } else {
      const member = config.members.find((one) => (user.id && one.id === user.id) || (user.phone && one.phone === localPhone(user.phone)));
      if (!member) return [404, { error: 'user_not_found', message: 'Esa persona no es miembro activo del espacio.' }];
      chatId = `dm_${member.id}`;
    }
    state.seq += 1;
    const message = { id: `msg_${randomBytes(6).toString('hex')}`, chat_id: chatId, seq: state.seq, idempotency_key: key, text: body.text, card: body.card, checklist: body.checklist, thread_of: body.thread_of, at: new Date().toISOString() };
    state.messages.push(message);
    return [201, { message: { id: message.id, chat_id: message.chat_id, seq: message.seq } }];
  }

  function exchange(body) {
    if (body.grant_type !== 'authorization_code') return [400, { error: 'unsupported_grant_type', error_description: 'Solo authorization_code.' }];
    if (body.client_id !== config.clientId || body.client_secret !== config.clientSecret) return [401, { error: 'invalid_client', error_description: 'client_id o client_secret no coinciden.' }];
    const grant = state.codes.get(body.code);
    state.codes.delete(body.code);
    if (!grant || grant.expiresAt < Date.now()) return [400, { error: 'invalid_grant', error_description: 'El código no existe, venció o ya se usó.' }];
    if (grant.redirectUri !== body.redirect_uri) return [400, { error: 'invalid_grant', error_description: 'La dirección de vuelta no es la del código.' }];
    if (createHash('sha256').update(String(body.code_verifier ?? '')).digest('base64url') !== grant.challenge) return [400, { error: 'invalid_grant', error_description: 'El code_verifier no coincide.' }];
    const token = install();
    return [200, { access_token: token, token_type: 'Bearer', installation_id: state.installation.id, space: { id: state.installation.spaceId, name: config.spaceName }, bot_user_id: state.installation.botUserId, signing_secret: state.installation.signingSecret }];
  }

  function authorizeRedirect(url) {
    const query = url.searchParams;
    if (query.get('client_id') !== config.clientId || query.get('redirect_uri') !== config.redirectUri) return [400, { error: 'invalid_request', error_description: 'App o dirección de vuelta no registradas.' }];
    const back = new URL(config.redirectUri);
    back.searchParams.set('state', query.get('state') ?? '');
    if (query.get('deny') === '1') back.searchParams.set('error', 'access_denied');
    else {
      if (query.get('code_challenge_method') !== 'S256' || !query.get('code_challenge')) return [400, { error: 'invalid_request', error_description: 'Se necesita PKCE con S256.' }];
      const code = secret('lco_');
      state.codes.set(code, { challenge: query.get('code_challenge'), redirectUri: config.redirectUri, expiresAt: Date.now() + 10 * 60_000 });
      back.searchParams.set('code', code);
    }
    return [302, back.toString()];
  }

  const allowMessage = () => {
    if (Date.now() - state.minute.start > 60_000) state.minute = { start: Date.now(), used: 0 };
    state.minute.used += 1;
    return state.minute.used <= MESSAGES_PER_MINUTE;
  };

  async function route(req, url) {
    const path = url.pathname;
    if (req.method === 'GET' && path === '/instalar-app') return authorizeRedirect(url);
    if (req.method === 'POST' && path === '/api/oauth/token') return exchange(await readBody(req));
    if (req.method === 'POST' && path === '/__fake/reset') return reset(), [200, { ok: true }];
    if (req.method === 'POST' && path === '/__fake/emit') {
      const body = await readBody(req);
      const id = emit(body.type, body.data);
      return id ? [202, { delivery_id: id }] : [409, { error: 'not_installed', message: 'Instala la app primero.' }];
    }
    if (req.method === 'GET' && path === '/__fake/messages') return [200, { messages: state.messages }];
    if (req.method === 'GET' && path === '/__fake/deliveries') return [200, { deliveries: state.deliveries.map(({ signingSecret: _hidden, ...rest }) => rest) }];
    if (!path.startsWith('/api/')) return [404, { error: 'not_found' }];
    const bot = botOf(req);
    if (!bot) return [401, { error: 'invalid_token', message: 'El token del bot no vale o fue revocado.' }];
    if (req.method === 'POST' && path === '/api/oauth/revoke') return (state.installation = null), [200, { ok: true }];
    if (req.method === 'GET' && path === '/api/bots/me') return [200, { installation_id: bot.id, space: { id: bot.spaceId, name: config.spaceName }, bot_user_id: bot.botUserId }];
    if (req.method === 'GET' && path === '/api/bots/channels') return [200, { channels: config.channels.filter((c) => c.visibility === 'public' || state.joined.has(c.id)).map((c) => ({ ...c, is_member: state.joined.has(c.id) })) }];
    if (req.method === 'GET' && path === '/api/bots/members') return [200, { members: config.members }];
    if (req.method === 'POST' && path === '/api/bots/messages') return allowMessage() ? postMessage(await readBody(req)) : [429, { error: 'rate_limited', message: 'Más de 60 mensajes por minuto.' }, { 'Retry-After': '60' }];
    const patched = path.match(/^\/api\/bots\/messages\/([^/]+)$/);
    if (req.method === 'PATCH' && patched) {
      const message = state.messages.find((one) => one.id === patched[1]);
      if (!message) return [404, { error: 'message_not_found', message: 'Ese mensaje no existe o no es de este bot.' }];
      const body = await readBody(req);
      if (body.card) {
        const problem = validateCard(body.card);
        if (problem) return [400, { error: 'invalid_request', message: problem }];
        message.card = body.card;
      }
      if (typeof body.text === 'string' && body.text.trim()) message.text = body.text.trim();
      return [200, { message: { id: message.id, chat_id: message.chat_id, seq: message.seq } }];
    }
    return [404, { error: 'not_found' }];
  }

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://fake');
    route(req, url).then(([status, payload, headers]) => {
      if (status === 302) return void res.writeHead(302, { Location: payload }).end();
      res.writeHead(status, { 'Content-Type': 'application/json', ...(headers ?? {}) }).end(JSON.stringify(payload));
    }, (error) => res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'fake_failed', message: String(error) })));
  });
  return { server, config, emit, reset, state: () => state };
}

export function startFake(options = {}) {
  const fake = createFake(options);
  const port = Number(options.port ?? process.env.PORT ?? 4100);
  return new Promise((resolve) => fake.server.listen(port, '127.0.0.1', () => resolve({ ...fake, port: fake.server.address().port, close: () => new Promise((done) => fake.server.close(done)) })));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  startFake().then((fake) => console.log(`[lilachat-bots-fake] escuchando en http://127.0.0.1:${fake.port}`));
}
