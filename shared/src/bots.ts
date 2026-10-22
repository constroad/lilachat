import { normalizePeruPhone } from './phone.js';
import { validateChecklist } from './checklists.js';

/**
 * What a bot (Lila, through agentes) sends to `POST /api/bots/messages`
 * (`specs/BOTS-API.spec.md` §b): a text, a card with up to three actions, or
 * a checklist whose tasks name their person by phone, to a channel or to a
 * 1:1 with a member. PURE: the server validates with this and nothing else.
 * The wire is snake_case; what comes out is the server's camelCase.
 */
export type CardTone = 'ok' | 'warn' | 'error' | 'info' | 'neutral';
export type CardActionStyle = 'primary' | 'secondary' | 'danger';
export type CardAction = { id: string; label: string; style: CardActionStyle; value: string };
export type BotCard = {
  kicker?: string;
  title: string;
  status?: { label: string; tone: CardTone };
  fields: { label: string; value: string }[];
  link?: { label: string; url: string };
  actions?: CardAction[];
};
export type BotChecklist = { title: string; othersCanMark: boolean; items: { text: string; assigneePhone?: string; dueAt?: string }[] };
export type BotTarget = { channelId: string } | { userPhone: string } | { userId: string };
export type BotPost = { target: BotTarget; text?: string; card?: BotCard; checklist?: BotChecklist; threadOf?: number; idempotencyKey: string };
export type BotPostError = { ok: false; error: 'invalid_request'; message: string };

export const BOT_LIMITS = { text: 4000, idempotencyKey: 120, fields: 12, actions: 3, actionValue: 2000, kicker: 60, title: 120, status: 24, label: 40, value: 120, linkLabel: 24, actionLabel: 24, actionId: 40, url: 500 };
const TONES: readonly CardTone[] = ['ok', 'warn', 'error', 'info', 'neutral'];
const STYLES: readonly CardActionStyle[] = ['primary', 'secondary', 'danger'];
const ACTION_ID = /^[a-z0-9_-]+$/;

const line = (value: unknown, max: number): string => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});
const refuse = (message: string): BotPostError => ({ ok: false, error: 'invalid_request', message });

function validateActions(raw: unknown): { ok: true; actions: CardAction[] } | { ok: false; message: string } {
  const list = Array.isArray(raw) ? raw : [];
  if (list.length > BOT_LIMITS.actions) return { ok: false, message: `La tarjeta lleva hasta ${BOT_LIMITS.actions} acciones.` };
  const actions: CardAction[] = [];
  for (const item of list) {
    const action = record(item);
    const id = typeof action.id === 'string' ? action.id : '';
    if (!ACTION_ID.test(id) || id.length > BOT_LIMITS.actionId) return { ok: false, message: 'El id de una acción va con a-z, 0-9, guion o guion bajo, hasta 40.' };
    if (actions.some((other) => other.id === id)) return { ok: false, message: `La acción «${id}» está repetida.` };
    const label = line(action.label, BOT_LIMITS.actionLabel);
    if (!label) return { ok: false, message: 'Cada acción necesita una etiqueta.' };
    const value = typeof action.value === 'string' ? action.value : '';
    if (value.length > BOT_LIMITS.actionValue) return { ok: false, message: `El valor de una acción lleva hasta ${BOT_LIMITS.actionValue} caracteres.` };
    const style = STYLES.includes(action.style as CardActionStyle) ? (action.style as CardActionStyle) : 'secondary';
    actions.push({ id, label, style, value });
  }
  return { ok: true, actions };
}

export function validateBotCard(raw: unknown): { ok: true; card: BotCard } | { ok: false; message: string } {
  const card = record(raw);
  const title = line(card.title, BOT_LIMITS.title);
  if (!title) return { ok: false, message: 'La tarjeta necesita un título.' };
  const rawFields = Array.isArray(card.fields) ? card.fields : [];
  if (rawFields.length > BOT_LIMITS.fields) return { ok: false, message: `La tarjeta lleva hasta ${BOT_LIMITS.fields} campos.` };
  const fields = rawFields.map((field) => ({ label: line(record(field).label, BOT_LIMITS.label), value: line(record(field).value, BOT_LIMITS.value) })).filter((field) => field.label && field.value);
  const status = record(card.status);
  const statusLabel = line(status.label, BOT_LIMITS.status);
  if (statusLabel && status.tone !== undefined && !TONES.includes(status.tone as CardTone)) return { ok: false, message: `El tono del estado es uno de: ${TONES.join(', ')}.` };
  const link = record(card.link);
  const url = line(link.url, BOT_LIMITS.url);
  if (url && !url.startsWith('https://')) return { ok: false, message: 'El enlace de la tarjeta debe empezar con https://.' };
  const actions = validateActions(card.actions);
  if (!actions.ok) return actions;
  const kicker = line(card.kicker, BOT_LIMITS.kicker);
  return {
    ok: true,
    card: {
      ...(kicker ? { kicker } : {}),
      title,
      ...(statusLabel ? { status: { label: statusLabel, tone: (status.tone as CardTone | undefined) ?? 'neutral' } } : {}),
      fields,
      ...(url ? { link: { label: line(link.label, BOT_LIMITS.linkLabel) || 'Abrir', url } } : {}),
      ...(actions.actions.length ? { actions: actions.actions } : {}),
    },
  };
}

function validateBotChecklist(raw: unknown): { ok: true; checklist: BotChecklist } | BotPostError {
  const checklist = record(raw);
  const items: BotChecklist['items'] = [];
  for (const rawItem of Array.isArray(checklist.items) ? checklist.items : []) {
    const item = record(rawItem);
    const phone = typeof item.assignee_phone === 'string' && item.assignee_phone.trim() ? item.assignee_phone : undefined;
    const assigneePhone = phone ? normalizePeruPhone(phone) : undefined;
    if (phone && !assigneePhone) return refuse(`El responsable «${phone}» no es un celular de Perú.`);
    const due = typeof item.due_at === 'string' && !Number.isNaN(Date.parse(item.due_at)) ? new Date(item.due_at).toISOString() : undefined;
    items.push({ text: String(item.text ?? ''), ...(assigneePhone ? { assigneePhone } : {}), ...(due ? { dueAt: due } : {}) });
  }
  const valid = validateChecklist({ title: String(checklist.title ?? ''), items: items.map((item) => item.text) });
  if (!valid.ok) return refuse(valid.message);
  // The texts as the checklist keeps them (trimmed, empty ones out), with their person and date.
  const kept = items.filter((item) => item.text.trim()).map((item, index) => ({ ...item, text: valid.items[index]! }));
  return { ok: true, checklist: { title: valid.title, othersCanMark: checklist.others_can_mark === true, items: kept } };
}

function validateTarget(body: Record<string, unknown>): { ok: true; target: BotTarget } | BotPostError {
  const channelId = typeof body.channel_id === 'string' && body.channel_id ? body.channel_id : undefined;
  const user = body.user === undefined ? undefined : record(body.user);
  if (Boolean(channelId) === Boolean(user)) return refuse('Indica un destino: channel_id o user, uno solo.');
  if (channelId) return { ok: true, target: { channelId } };
  if (typeof user!.id === 'string' && user!.id) return { ok: true, target: { userId: user!.id } };
  const phone = normalizePeruPhone(user!.phone);
  return phone ? { ok: true, target: { userPhone: phone } } : refuse('user lleva { id } o { phone } con un celular de Perú.');
}

export function validateBotPost(raw: unknown): { ok: true; post: BotPost } | BotPostError {
  const body = record(raw);
  const target = validateTarget(body);
  if (!target.ok) return target;
  const idempotencyKey = typeof body.idempotency_key === 'string' ? body.idempotency_key.trim() : '';
  if (!idempotencyKey || idempotencyKey.length > BOT_LIMITS.idempotencyKey) return refuse(`idempotency_key es obligatorio, hasta ${BOT_LIMITS.idempotencyKey}.`);
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length > BOT_LIMITS.text) return refuse(`El texto es demasiado largo (máximo ${BOT_LIMITS.text}).`);
  const post: BotPost = { target: target.target, ...(text ? { text } : {}), idempotencyKey };
  if (body.card !== undefined) {
    const card = validateBotCard(body.card);
    if (!card.ok) return refuse(card.message);
    post.card = card.card;
  }
  if (body.checklist !== undefined) {
    const checklist = validateBotChecklist(body.checklist);
    if (!checklist.ok) return checklist;
    post.checklist = checklist.checklist;
  }
  if (Number.isInteger(body.thread_of) && Number(body.thread_of) > 0) post.threadOf = Number(body.thread_of);
  if (!post.text && !post.card && !post.checklist) return refuse('Manda un texto, una tarjeta o un checklist.');
  return { ok: true, post };
}

/** What the chat list, the notification and the search read of a card. */
export const botCardSummary = (card: Pick<BotCard, 'title' | 'status'>): string => [card.title, card.status?.label].filter(Boolean).join(' · ');

/** An app installed in a space, as Integraciones lists it (`GET /api/workspaces/:id/apps`). */
export type SpaceApp = { id: string; name: string; avatarUrl?: string; installedBy: string | null; installedAt: string; lastDelivery?: { at: string; ok: boolean; error?: string } };

/** «Instalada por José · 21 oct.»: who installed it and when. */
export function appInstalledLine(app: Pick<SpaceApp, 'installedBy' | 'installedAt'>): string {
  const day = new Date(app.installedAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' });
  return app.installedBy ? `Instalada por ${app.installedBy} · ${day}` : `Instalada el ${day}`;
}

/** If the last event did not reach the app, say it: an app that stopped hearing is the first thing to check. */
export function appDeliveryWarning(app: Pick<SpaceApp, 'lastDelivery'>): string | null {
  if (!app.lastDelivery || app.lastDelivery.ok) return null;
  return `El último aviso a la app falló${app.lastDelivery.error ? ` (${app.lastDelivery.error})` : ''}. Se reintenta solo.`;
}
