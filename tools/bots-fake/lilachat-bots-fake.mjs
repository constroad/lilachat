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
 * RETRY_DELAYS_MS ("10000,60000,300000,1800000"), NOTICE_TOPICS (JSON, the
 * topics of the fake's own app; a manifest app brings its own).
 *
 * R160 (§c-ter, §c-quater): `/__fake/emit` with `shortcut.invoked` or
 * `form.submitted` waits for the answer in the body (3 s), like
 * `/__fake/command`, and returns `{ command_id, outcome, response?, errors? }`.
 * In `form.submitted`, a value "@photo" becomes a signed photo URL that answers
 * 200 image/jpeg for 15 minutes.
 *
 * Pending 21 (§157): PUT /api/bots/clients/:clientId creates the client's
 * channel (`client_<id>`) and answers live/archived_since; POST
 * /api/bots/messages takes `client` (with thread_of, kind and refs). GET
 * /__fake/clients lists them.
 */
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const CLIENT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const CLIENT_KIND = /^[a-z_]{1,32}\.[a-z_]{1,32}$/;
const CLIENT_SERVICE_STATUSES = ['pending', 'in_progress', 'completed', 'rejected'];
const CLIENT_LIVE_DAYS = 90;
const DAY_MS = 86_400_000;

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
const TOPIC_KEY = /^[a-z][a-z0-9_-]*$/;
const OBJECT_KEY = /^[a-z][a-z0-9_-]+$/;
const SIGNED_TTL_MS = 15 * 60_000;
const ANSWER_TIMEOUT_MS = 3_000;
/** A real 1×1 JPEG: what a form's photo downloads as. */
const PHOTO = Buffer.from('/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAAaADAAQAAAABAAAAAQAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAAQABAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8A/fyiiigD/9k=', 'base64');

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
    noticeTopics: options.noticeTopics ?? (process.env.NOTICE_TOPICS ? JSON.parse(process.env.NOTICE_TOPICS) : []),
  };
  const fileKey = randomBytes(32);
  let state;
  const reset = () => {
    state = { codes: new Map(), installation: null, messages: [], deliveries: [], minute: { start: Date.now(), used: 0 }, seq: 0, joined: new Set(config.channels.filter((c) => c.visibility === 'public').map((c) => c.id)), commands: [], runs: new Map(), commandResponses: [], apps: new Map(), installedClientId: null, topicChannels: {}, files: new Map(), clients: new Map() };
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
    let channelId = typeof body.channel_id === 'string' && body.channel_id ? body.channel_id : null;
    const topic = body.topic === undefined ? null : String(body.topic);
    const user = body.user && typeof body.user === 'object' ? body.user : null;
    const client = body.client === undefined ? null : String(body.client);
    if ([channelId, topic, user, client].filter((one) => one !== null).length !== 1) return [400, { error: 'invalid_request', message: 'Indica un destino: channel_id, topic, user o client, uno solo.' }];
    if (client !== null) {
      if (!CLIENT_ID.test(client)) return [400, { error: 'invalid_request', message: 'client es el id del cliente (letras, números, _ o -, hasta 64).' }];
      if (!state.clients.has(client)) return [404, { error: 'client_not_found', message: `Ese cliente no tiene canal: manda primero PUT /api/bots/clients/${client} con su estado.` }];
    }
    if (body.kind !== undefined && (typeof body.kind !== 'string' || !CLIENT_KIND.test(body.kind))) return [400, { error: 'invalid_request', message: 'kind va como «order.created» (minúsculas, con un punto) y refs como { service_id?, record_id? }.' }];
    if (topic !== null) {
      if (!TOPIC_KEY.test(topic)) return [400, { error: 'invalid_request', message: 'topic va en minúsculas (a-z, 0-9, _ o -), como en el manifiesto.' }];
      const routed = channelOfTopic(topic);
      if (Array.isArray(routed)) return routed;
      channelId = routed;
    }
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
    if (client !== null) chatId = state.clients.get(client).channel.id;
    else if (channelId) {
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
    const message = { id: `msg_${randomBytes(6).toString('hex')}`, chat_id: chatId, seq: state.seq, idempotency_key: key, text: body.text, card: body.card, checklist: body.checklist, thread_of: body.thread_of, ...(body.kind ? { kind: body.kind, refs: body.refs ?? {} } : {}), at: new Date().toISOString() };
    state.messages.push(message);
    return [201, { message: { id: message.id, chat_id: message.chat_id, seq: message.seq } }];
  }

  // A channel per client (pending 21, §157): live with an order in 90 days or an open service.
  function putClient(clientId, body) {
    if (!CLIENT_ID.test(clientId)) return [400, { error: 'invalid_request', message: 'El id del cliente lleva letras, números, _ o -, hasta 64.' }];
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return [400, { error: 'invalid_request', message: 'El cliente lleva name.' }];
    const isDate = (value) => value === null || value === undefined || (typeof value === 'string' && !Number.isNaN(Date.parse(value)));
    if (!isDate(body.last_order_at)) return [400, { error: 'invalid_request', message: 'last_order_at va como fecha ISO, o null si todavía no tiene pedidos.' }];
    const services = Array.isArray(body.services) ? body.services : [];
    for (const one of services) {
      if (!one?.id || !one?.name) return [400, { error: 'invalid_request', message: 'Cada servicio lleva id y name.' }];
      if (!CLIENT_SERVICE_STATUSES.includes(one.status)) return [400, { error: 'invalid_request', message: `status va como ${CLIENT_SERVICE_STATUSES.join(', ')}.` }];
      if (one.progress !== undefined && one.progress !== null && !(Number(one.progress) >= 0 && Number(one.progress) <= 100)) return [400, { error: 'invalid_request', message: 'progress va de 0 a 100.' }];
      if (!isDate(one.closed_at)) return [400, { error: 'invalid_request', message: 'closed_at va como fecha ISO.' }];
    }
    const known = state.clients.get(clientId);
    const channel = known?.channel ?? { id: `client_${clientId}`, name };
    channel.name = name;
    const lastOrderAt = body.last_order_at ? new Date(body.last_order_at).toISOString() : null;
    const open = services.some((one) => one.status === 'pending' || one.status === 'in_progress');
    const live = open || (lastOrderAt !== null && Date.now() - Date.parse(lastOrderAt) <= CLIENT_LIVE_DAYS * DAY_MS);
    const closes = services.flatMap((one) => (one.closed_at ? [Date.parse(one.closed_at)] : []));
    if (lastOrderAt) closes.push(Date.parse(lastOrderAt) + CLIENT_LIVE_DAYS * DAY_MS);
    const archivedSince = live || closes.length === 0 ? null : new Date(Math.max(...closes)).toISOString();
    state.clients.set(clientId, { channel, state: body });
    return [known ? 200 : 201, { client: { id: clientId, channel, live, archived_since: archivedSince } }];
  }

  // Notice topics (§c-quater): the installed app's, a topic never touched goes to #general, null is «Sin canal».
  const topicsOfApp = () => state.apps.get(state.installedClientId)?.notice_topics ?? config.noticeTopics;
  const defaultChannel = () => config.channels.find((one) => one.visibility === 'public' && one.name === 'general') ?? config.channels.find((one) => one.visibility === 'public') ?? null;
  const routeOf = (key) => {
    const chosen = state.topicChannels[key];
    if (chosen === null) return null;
    return config.channels.find((one) => one.id === chosen) ?? defaultChannel();
  };
  function channelOfTopic(key) {
    const topic = topicsOfApp().find((one) => one.key === key);
    if (!topic) return [404, { error: 'topic_not_found', message: `La app no declaró el tema «${key}» en su manifiesto.` }];
    const channel = routeOf(key);
    if (!channel) return [409, { error: 'topic_without_channel', message: `El tema «${topic.name}» no tiene canal: el admin lo dejó sin canal.` }];
    if (channel.visibility !== 'public') state.joined.add(channel.id);
    return channel.id;
  }
  const topicsToWire = () => ({ topics: topicsOfApp().map((topic) => {
    const channel = routeOf(topic.key);
    return { key: topic.key, name: topic.name, channel: channel ? { id: channel.id, name: channel.name } : null };
  }) });
  function setTopics(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return [400, { error: 'invalid_request', message: 'Manda un objeto { tema: id_del_canal | null }.' }];
    const known = topicsOfApp().map((topic) => topic.key);
    for (const [key, value] of Object.entries(body)) {
      if (!known.includes(key)) return [400, { error: 'invalid_request', message: `La app no tiene el tema «${key}».` }];
      if (value !== null && typeof value !== 'string') return [400, { error: 'invalid_request', message: `El canal de «${key}» va como id o null.` }];
      if (value !== null && !config.channels.some((one) => one.id === value)) return [404, { error: 'channel_not_found', message: 'Ese canal no existe en el espacio.' }];
    }
    Object.assign(state.topicChannels, body);
    return [200, topicsToWire()];
  }

  // A form's photo (§c-ter): a signed address on the fake's own host, 15 minutes.
  const signatureOf = (payload) => createHmac('sha256', fileKey).update(payload).digest('base64url');
  function signedPhotoUrl(baseUrl) {
    const fileId = `file_${randomBytes(6).toString('hex')}`;
    state.files.set(fileId, PHOTO);
    const payload = Buffer.from(`${fileId}:${Date.now() + SIGNED_TTL_MS}`).toString('base64url');
    return `${baseUrl}/api/bots/files/${payload}.${signatureOf(payload)}`;
  }
  function readPhoto(token) {
    const [payload = '', signature = ''] = token.split('.');
    if (signature !== signatureOf(payload)) return [404, { message: 'No existe.' }];
    const [fileId, expires] = Buffer.from(payload, 'base64url').toString('utf8').split(':');
    if (Number(expires) < Date.now()) return [410, { message: 'La dirección venció.' }];
    const bytes = state.files.get(fileId);
    return bytes ? [200, bytes, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store' }] : [404, { message: 'No existe.' }];
  }

  function exchange(body) {
    if (body.grant_type !== 'authorization_code') return [400, { error: 'unsupported_grant_type', error_description: 'Solo authorization_code.' }];
    const created = state.apps.get(body.client_id);
    const known = (body.client_id === config.clientId && body.client_secret === config.clientSecret) || (created && created.secret === body.client_secret);
    if (!known) return [401, { error: 'invalid_client', error_description: 'client_id o client_secret no coinciden.' }];
    const grant = state.codes.get(body.code);
    state.codes.delete(body.code);
    if (!grant || grant.expiresAt < Date.now()) return [400, { error: 'invalid_grant', error_description: 'El código no existe, venció o ya se usó.' }];
    if (grant.redirectUri !== body.redirect_uri) return [400, { error: 'invalid_grant', error_description: 'La dirección de vuelta no es la del código.' }];
    if (createHash('sha256').update(String(body.code_verifier ?? '')).digest('base64url') !== grant.challenge) return [400, { error: 'invalid_grant', error_description: 'El code_verifier no coincide.' }];
    const token = install();
    state.installedClientId = body.client_id;
    return [200, { access_token: token, token_type: 'Bearer', installation_id: state.installation.id, space: { id: state.installation.spaceId, name: config.spaceName }, bot_user_id: state.installation.botUserId, signing_secret: state.installation.signingSecret }];
  }

  function authorizeRedirect(url) {
    const query = url.searchParams;
    const created = state.apps.get(query.get('client_id'));
    const redirectUri = created ? created.redirect_uri : config.redirectUri;
    if ((query.get('client_id') !== config.clientId && !created) || query.get('redirect_uri') !== redirectUri) return [400, { error: 'invalid_request', error_description: 'App o dirección de vuelta no registradas.' }];
    const back = new URL(redirectUri);
    back.searchParams.set('state', query.get('state') ?? '');
    if (query.get('deny') === '1') back.searchParams.set('error', 'access_denied');
    else {
      if (query.get('code_challenge_method') !== 'S256' || !query.get('code_challenge')) return [400, { error: 'invalid_request', error_description: 'Se necesita PKCE con S256.' }];
      const code = secret('lco_');
      state.codes.set(code, { challenge: query.get('code_challenge'), redirectUri, expiresAt: Date.now() + 10 * 60_000 });
      back.searchParams.set('code', code);
    }
    return [302, back.toString()];
  }

  // Slash commands (§c-bis): same rules as the server, without its dependencies.
  function registerCommands(body) {
    if (!Array.isArray(body.commands)) return [400, { error: 'invalid_request', message: 'Falta «commands»: la lista de comandos de la app.' }];
    if (body.commands.length > 25) return [400, { error: 'invalid_request', message: 'Una app registra hasta 25 comandos.' }];
    const commands = [];
    for (const entry of body.commands) {
      const name = typeof entry?.command === 'string' ? entry.command : '';
      if (!/^[a-z][a-z0-9_-]+$/.test(name) || name.length > 32) return [400, { error: 'invalid_request', message: `«${name}» no sirve como comando.` }];
      const description = typeof entry.description === 'string' ? entry.description.trim().slice(0, 100) : '';
      if (!description) return [400, { error: 'invalid_request', message: `«/${name}» necesita una descripción.` }];
      if (commands.some((one) => one.command === name)) return [400, { error: 'invalid_request', message: `El comando «/${name}» está repetido.` }];
      const hint = typeof entry.usage_hint === 'string' ? entry.usage_hint.trim().slice(0, 60) : '';
      commands.push({ command: name, description, ...(hint ? { usage_hint: hint } : {}) });
    }
    state.commands = commands;
    return [200, { commands }];
  }

  const validResponse = (body) => (body && (typeof body.text === 'string' && body.text.trim() ? true : body.card && !validateCard(body.card)));
  const record = (commandId, body, late) => {
    const responseType = body.response_type === 'in_channel' ? 'in_channel' : 'ephemeral';
    state.commandResponses.push({ command_id: commandId, response_type: responseType, text: body.text, card: body.card, late, at: new Date().toISOString() });
    return responseType;
  };

  /** One signed event whose answer is read from the body within 3 s, as the server does with commands. */
  async function callForAnswer(type, data) {
    const installation = state.installation;
    const id = randomUUID();
    const raw = JSON.stringify({ event_id: id, type, installation_id: installation.id, space_id: installation.spaceId, created_at: new Date().toISOString(), data });
    const timestamp = Date.now();
    try {
      const response = await fetch(config.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lilachat-Event': type, 'X-Lilachat-Delivery': id, 'X-Lilachat-Installation': installation.id, 'X-Lilachat-Timestamp': String(timestamp), 'X-Lilachat-Signature': sign(installation.signingSecret, timestamp, raw) }, body: raw, signal: AbortSignal.timeout(ANSWER_TIMEOUT_MS) });
      const text = await response.text();
      if (!response.ok) return { outcome: 'failed' };
      if (!text.trim()) return { outcome: 'pending' };
      return { answer: JSON.parse(text) };
    } catch {
      return { outcome: 'pending' };
    }
  }
  const memberData = (user) => user ?? { id: config.members[0]?.id, name: config.members[0]?.name, phone: config.members[0]?.phone ?? null };
  const newRun = () => {
    const commandId = `cmd_${randomBytes(6).toString('hex')}`;
    state.runs.set(commandId, { responses: 0, expiresAt: Date.now() + 15 * 60_000 });
    return commandId;
  };
  /** What an answer in the body means: a form stays open with its run; errors keep it open; the rest like a command. */
  function judge(commandId, answer) {
    if (answer && Array.isArray(answer) === false && answer.errors && typeof answer.errors === 'object') return [200, { command_id: commandId, outcome: 'errors', errors: answer.errors }];
    if (answer?.response_type === 'form') {
      if (!answer.form || typeof answer.form.id !== 'string' || typeof answer.form.title !== 'string' || answer.form.schema?.type !== 'object') return [200, { command_id: commandId, outcome: 'failed' }];
      state.runs.get(commandId).form = answer.form;
      return [200, { command_id: commandId, outcome: 'form', response: answer }];
    }
    if (!validResponse(answer)) return [200, { command_id: commandId, outcome: 'failed' }];
    state.runs.get(commandId).responses += 1;
    return [200, { command_id: commandId, outcome: record(commandId, answer, false) === 'in_channel' ? 'posted' : 'ephemeral', response: answer }];
  }

  async function invokeCommand(body) {
    if (!state.installation) return [409, { error: 'not_installed', message: 'Instala la app primero.' }];
    if (!state.commands.some((one) => one.command === body.command)) return [404, { error: 'command_not_found', message: `No hay un comando /${body.command}.` }];
    const commandId = newRun();
    const data = { command_id: commandId, command: body.command, text: String(body.text ?? ''), channel: body.channel ?? { id: config.channels[0]?.id, kind: 'channel', name: config.channels[0]?.name }, user: memberData(body.user) };
    const reply = await callForAnswer('command.invoked', data);
    return reply.answer === undefined ? [200, { command_id: commandId, outcome: reply.outcome }] : judge(commandId, reply.answer);
  }

  /** `shortcut.invoked` from the space's ⚡ (`channel: null` unless one is given) or a channel's «+». */
  async function invokeShortcut(data) {
    const commandId = newRun();
    const event = { shortcut: String(data.shortcut ?? ''), command_id: commandId, channel: data.channel === undefined ? null : data.channel, user: memberData(data.user) };
    const reply = await callForAnswer('shortcut.invoked', event);
    return reply.answer === undefined ? [200, { command_id: commandId, outcome: reply.outcome }] : judge(commandId, reply.answer);
  }

  /** `form.submitted` for a run that asked for a form (or a fresh one); "@photo" values become signed photo URLs. */
  async function submitForm(data, baseUrl) {
    const commandId = typeof data.command_id === 'string' && state.runs.has(data.command_id) ? data.command_id : newRun();
    const values = Object.fromEntries(Object.entries(data.values ?? {}).map(([name, value]) => [name, value === '@photo' ? signedPhotoUrl(baseUrl) : value]));
    const event = { form_id: String(data.form_id ?? state.runs.get(commandId).form?.id ?? ''), command_id: commandId, values, channel: data.channel === undefined ? null : data.channel, user: memberData(data.user) };
    const reply = await callForAnswer('form.submitted', event);
    return reply.answer === undefined ? [200, { command_id: commandId, outcome: reply.outcome, values }] : judge(commandId, reply.answer).map((part, index) => (index === 1 ? { ...part, values } : part));
  }

  function respondToCommand(commandId, body) {
    const run = state.runs.get(commandId);
    if (!run) return [404, { error: 'command_not_found', message: 'Ese comando no existe o es de otra app.' }];
    if (!validResponse(body)) return [400, { error: 'invalid_request', message: 'La respuesta lleva «text» o «card».' }];
    if (run.expiresAt <= Date.now()) return [410, { error: 'command_expired', message: 'Pasaron más de 15 minutos: ese comando ya no se puede responder.' }];
    if (run.responses >= 5) return [409, { error: 'too_many_responses', message: 'Un comando se responde hasta 5 veces.' }];
    run.responses += 1;
    return [200, { response_type: record(commandId, body, true) }];
  }

  // Apps by manifest (§0-bis): the fake's own client is the developer app.
  const isDeveloper = (req) => {
    const header = String(req.headers.authorization ?? '');
    const [id, secretPart] = Buffer.from(header.startsWith('Basic ') ? header.slice(6) : '', 'base64').toString('utf8').split(':');
    return id === config.clientId && secretPart === config.clientSecret;
  };
  const publicApp = (clientId, app) => ({ client_id: clientId, key: app.key, name: app.name, redirect_uri: app.redirect_uri, webhook_url: app.webhook_url, ...(app.install_url ? { install_url: app.install_url } : {}), commands: app.commands ?? [], shortcuts: app.shortcuts, installations: 0 });
  /** `shortcuts` and `notice_topics` (R160): always a list, a manifest without them removes them. */
  function manifestList(raw, max, what) {
    const list = Array.isArray(raw) ? raw : [];
    if (list.length > max) return `Una app declara hasta ${max} ${what}.`;
    const seen = new Set();
    for (const entry of list) {
      if (typeof entry?.key !== 'string' || !OBJECT_KEY.test(entry.key) || seen.has(entry.key) || typeof entry.name !== 'string' || !entry.name.trim()) return `«${entry?.key ?? ''}» necesita una «key» única en minúsculas y un «name».`;
      seen.add(entry.key);
    }
    return list.map((entry) => ({ key: entry.key, name: entry.name.trim().slice(0, 40), ...(typeof entry.description === 'string' && entry.description.trim() ? { description: entry.description.trim().slice(0, 80) } : {}), ...(typeof entry.icon === 'string' ? { icon: entry.icon } : {}) }));
  }
  function upsertApp(body) {
    if (typeof body.key !== 'string' || !/^[a-z][a-z0-9-]{1,31}$/.test(body.key)) return [400, { error: 'invalid_request', message: '«key» va en minúsculas, de 2 a 32.' }];
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 40) return [400, { error: 'invalid_request', message: 'Falta «name»: el nombre de la app, hasta 40.' }];
    if (typeof body.redirect_uri !== 'string' || typeof body.webhook_url !== 'string') return [400, { error: 'invalid_request', message: '«redirect_uri» y «webhook_url» van con https.' }];
    const shortcuts = manifestList(body.shortcuts, 10, 'atajos');
    const noticeTopics = manifestList(body.notice_topics, 10, 'temas de aviso');
    if (typeof shortcuts === 'string' || typeof noticeTopics === 'string') return [400, { error: 'invalid_request', message: typeof shortcuts === 'string' ? shortcuts : noticeTopics }];
    const fields = { key: body.key, name: body.name.trim(), redirect_uri: body.redirect_uri, webhook_url: body.webhook_url, install_url: body.install_url, ...(Array.isArray(body.commands) ? { commands: body.commands } : {}), shortcuts, notice_topics: noticeTopics.map(({ icon, ...topic }) => ({ ...topic, ...(['attendance', 'tank', 'material', 'truck', 'weather', 'cash', 'document', 'alert'].includes(icon) ? { icon } : {}) })) };
    const existing = [...state.apps.entries()].find(([, app]) => app.key === body.key);
    if (existing) return Object.assign(existing[1], fields), [200, { client_id: existing[0] }];
    if (state.apps.size >= 20) return [400, { error: 'too_many_apps', message: 'Una desarrolladora crea hasta 20 apps.' }];
    const clientId = secret('lca_').slice(0, 24);
    const clientSecret = secret('lcx_');
    state.apps.set(clientId, { ...fields, secret: clientSecret });
    return [201, { client_id: clientId, client_secret: clientSecret }];
  }
  async function routeApps(req, path) {
    if (!isDeveloper(req)) return [401, { error: 'invalid_client', message: 'client_id o client_secret no coinciden.' }];
    if (req.method === 'GET' && path === '/api/bots/apps') return [200, { apps: [...state.apps.entries()].map(([id, app]) => publicApp(id, app)) }];
    if (req.method === 'POST' && path === '/api/bots/apps') return upsertApp(await readBody(req));
    const [, clientId, action] = path.match(/^\/api\/bots\/apps\/([^/]+)(?:\/(secret))?$/) ?? [];
    const app = clientId ? state.apps.get(clientId) : null;
    if (!app) return [404, { error: 'app_not_found', message: 'Esa app no existe o no es tuya.' }];
    if (req.method === 'POST' && action === 'secret') return (app.secret = secret('lcx_')), [200, { client_secret: app.secret }];
    if (req.method === 'DELETE' && !action) return state.apps.delete(clientId), [204, {}];
    return [404, { error: 'not_found' }];
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
      if (body.type === 'shortcut.invoked' || body.type === 'form.submitted') {
        if (!state.installation) return [409, { error: 'not_installed', message: 'Instala la app primero.' }];
        return body.type === 'shortcut.invoked' ? invokeShortcut(body.data ?? {}) : submitForm(body.data ?? {}, `http://${req.headers.host}`);
      }
      const id = emit(body.type, body.data);
      return id ? [202, { delivery_id: id }] : [409, { error: 'not_installed', message: 'Instala la app primero.' }];
    }
    if (req.method === 'GET' && path === '/__fake/messages') return [200, { messages: state.messages }];
    if (req.method === 'GET' && path === '/__fake/clients') return [200, { clients: [...state.clients.entries()].map(([id, one]) => ({ id, channel: one.channel, state: one.state })) }];
    if (req.method === 'POST' && path === '/__fake/command') return invokeCommand(await readBody(req));
    if (req.method === 'GET' && path === '/__fake/command-responses') return [200, { responses: state.commandResponses }];
    if (req.method === 'GET' && path === '/__fake/deliveries') return [200, { deliveries: state.deliveries.map(({ signingSecret: _hidden, ...rest }) => rest) }];
    if (!path.startsWith('/api/')) return [404, { error: 'not_found' }];
    const photo = path.match(/^\/api\/bots\/files\/([^/]+)$/);
    if (req.method === 'GET' && photo) return readPhoto(photo[1]);
    if (path === '/api/bots/apps' || path.startsWith('/api/bots/apps/')) return routeApps(req, path);
    const bot = botOf(req);
    if (!bot) return [401, { error: 'invalid_token', message: 'El token del bot no vale o fue revocado.' }];
    if (req.method === 'POST' && path === '/api/oauth/revoke') return (state.installation = null), [200, { ok: true }];
    if (req.method === 'GET' && path === '/api/bots/me') return [200, { installation_id: bot.id, space: { id: bot.spaceId, name: config.spaceName }, bot_user_id: bot.botUserId }];
    if (req.method === 'GET' && path === '/api/bots/channels') return [200, { channels: config.channels.filter((c) => c.visibility === 'public' || state.joined.has(c.id)).map((c) => ({ ...c, is_member: state.joined.has(c.id) })) }];
    if (req.method === 'GET' && path === '/api/bots/members') return [200, { members: config.members }];
    if (req.method === 'GET' && path === '/api/bots/commands') return [200, { commands: state.commands }];
    if (req.method === 'PUT' && path === '/api/bots/commands') return registerCommands(await readBody(req));
    const clientPath = path.match(/^\/api\/bots\/clients\/([^/]+)$/);
    if (req.method === 'PUT' && clientPath) return putClient(decodeURIComponent(clientPath[1]), await readBody(req));
    if (req.method === 'GET' && path === '/api/bots/topics') return [200, topicsToWire()];
    if (req.method === 'PUT' && path === '/api/bots/topics') return setTopics(await readBody(req));
    const responded = path.match(/^\/api\/bots\/commands\/([^/]+)\/respond$/);
    if (req.method === 'POST' && responded) return respondToCommand(responded[1], await readBody(req));
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
      if (status === 204) return void res.writeHead(204).end();
      if (Buffer.isBuffer(payload)) return void res.writeHead(status, headers ?? {}).end(payload);
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
