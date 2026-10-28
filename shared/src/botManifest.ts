import { cutAtWord } from './textCut.js';
import { validateBotCommands, type AppShortcut, type BotCommand } from './botCommands.js';
import { isNoticeIcon, NOTICE_TOPIC_LIMITS, TOPIC_KEY, type NoticeTopic } from './noticeTopics.js';

/**
 * The manifest a developer app (agentes, with its one Lilachat credential)
 * sends to create or update one of its apps (`specs/BOTS-API.spec.md`
 * §0-bis), like Slack's app manifests: the per-app credentials come back in
 * the response, server to server, so no secret per app goes through a person
 * or Torre (José, 23/10: «como Slack con Bitbucket»). PURE.
 */
export type AppCategory = 'operacion' | 'personas' | 'finanzas' | 'laboratorio' | 'otra';
export const APP_CATEGORIES: readonly AppCategory[] = ['operacion', 'personas', 'finanzas', 'laboratorio', 'otra'];
/** What the directory's chips say (design e-24). */
export const APP_CATEGORY_LABEL: Record<AppCategory, string> = { operacion: 'Operación', personas: 'Personas', finanzas: 'Finanzas', laboratorio: 'Laboratorio', otra: 'Otras' };

export type AppManifest = {
  key: string;
  name: string;
  avatarUrl?: string;
  /** The directory's line, «Qué hace», who made it and its chip (design e-24, José 23/10). */
  description?: string;
  features?: string[];
  developer?: string;
  category?: AppCategory;
  redirectUri: string;
  webhookUrl: string;
  installUrl?: string;
  commands?: BotCommand[];
  /** The actions of the composer's «+» (R160, design e-29); always a list: without it the app has none (agentes, 23/10). */
  shortcuts: AppShortcut[];
  /** Where its notices may land, picked per topic by the space's admin (R160, design e-31); always a list. */
  noticeTopics: NoticeTopic[];
  /** What the app asks to see beyond the basics; accepted when installing (like Slack's scopes, pending 95). */
  scopes: AppScope[];
};

/** The scopes an app may ask for, with what the admin reads when installing. */
export const APP_SCOPES = {
  'users:read.email': 'Ver el correo de quien la usa, si lo verificó en Lilachat',
  // Like Slack's channels:history (pending 87): without it the app hears only its 1:1 and what names it.
  'channels:history': 'Leer los mensajes de los canales y grupos donde está, aunque no la mencionen',
} as const;
export type AppScope = keyof typeof APP_SCOPES;
const isScope = (value: unknown): value is AppScope => typeof value === 'string' && value in APP_SCOPES;

/** What a manifest asks for that the installation has not accepted yet: the detail offers «Reinstalar» (pending 95). */
export function newScopesOf(asked: readonly string[] | undefined, granted: readonly string[] | undefined): AppScope[] {
  return (asked ?? []).filter((scope): scope is AppScope => isScope(scope) && !(granted ?? []).includes(scope));
}

export const MANIFEST_LIMITS = { key: 32, name: 40, url: 500, appsPerDeveloper: 20, description: 120, features: 6, feature: 140, developer: 60, shortcuts: 10, shortcutName: 40, shortcutDescription: 80 };
const KEY = /^[a-z][a-z0-9-]+$/;
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});

/** https; http only for an agentes running on this machine. */
function address(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MANIFEST_LIMITS.url) return null;
  return /^https:\/\/[^\s]+$/.test(value) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/[^\s]*$/.test(value) ? value : null;
}

export function validateAppManifest(raw: unknown): { ok: true; manifest: AppManifest } | { ok: false; message: string } {
  const body = record(raw);
  const key = typeof body.key === 'string' ? body.key : '';
  if (!KEY.test(key) || key.length > MANIFEST_LIMITS.key) return { ok: false, message: `«key» va en minúsculas, de 2 a ${MANIFEST_LIMITS.key} (a-z, 0-9 o -), empezando con una letra.` };
  const name = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim() : '';
  if (!name || name.length > MANIFEST_LIMITS.name) return { ok: false, message: `Falta «name»: el nombre de la app, hasta ${MANIFEST_LIMITS.name}.` };
  const redirectUri = address(body.redirect_uri);
  const webhookUrl = address(body.webhook_url);
  if (!redirectUri || !webhookUrl) return { ok: false, message: '«redirect_uri» y «webhook_url» van con https.' };
  const avatarUrl = body.avatar_url === undefined ? undefined : address(body.avatar_url);
  const installUrl = body.install_url === undefined ? undefined : address(body.install_url);
  if (avatarUrl === null || installUrl === null) return { ok: false, message: '«avatar_url» e «install_url» van con https.' };
  const about = aboutFields(body);
  let commands: BotCommand[] | undefined;
  if (body.commands !== undefined) {
    const checked = validateBotCommands({ commands: body.commands });
    if (!checked.ok) return checked;
    commands = checked.commands;
  }
  const shortcuts = validateShortcuts(body.shortcuts);
  if (!Array.isArray(shortcuts)) return shortcuts;
  const noticeTopics = validateNoticeTopics(body.notice_topics);
  if (!Array.isArray(noticeTopics)) return noticeTopics;
  const scopes = [...new Set(Array.isArray(body.scopes) ? body.scopes.filter(isScope) : [])];
  return { ok: true, manifest: { key, name, ...(avatarUrl ? { avatarUrl } : {}), redirectUri, webhookUrl, ...(installUrl ? { installUrl } : {}), ...(commands ? { commands } : {}), ...about, shortcuts, noticeTopics, scopes } };
}

const oneLine = (value: unknown, max: number): string => (typeof value === 'string' ? cutAtWord(value.replace(/\s+/g, ' ').trim(), max) : '');

/** The directory's texts are optional and never refuse a manifest: what is too long is cut, what is unknown is dropped. */
function aboutFields(body: Record<string, unknown>): Pick<AppManifest, 'description' | 'features' | 'developer' | 'category'> {
  const description = oneLine(body.description, MANIFEST_LIMITS.description);
  const developer = oneLine(body.developer, MANIFEST_LIMITS.developer);
  const features = (Array.isArray(body.features) ? body.features : []).map((feature) => oneLine(feature, MANIFEST_LIMITS.feature)).filter(Boolean).slice(0, MANIFEST_LIMITS.features);
  const category = APP_CATEGORIES.includes(body.category as AppCategory) ? (body.category as AppCategory) : undefined;
  return { ...(description ? { description } : {}), ...(features.length ? { features } : {}), ...(developer ? { developer } : {}), ...(category ? { category } : {}) };
}

/** The manifest's `shortcuts`: names and descriptions cut like the directory's texts; a bad key or too many refuse it. */
function validateShortcuts(raw: unknown): AppShortcut[] | { ok: false; message: string } {
  const list = Array.isArray(raw) ? raw : [];
  if (list.length > MANIFEST_LIMITS.shortcuts) return { ok: false, message: `Una app declara hasta ${MANIFEST_LIMITS.shortcuts} atajos.` };
  const shortcuts: AppShortcut[] = [];
  for (const entry of list) {
    const item = record(entry);
    const shortcutKey = typeof item.key === 'string' ? item.key : '';
    const shortcutName = oneLine(item.name, MANIFEST_LIMITS.shortcutName);
    if (!/^[a-z][a-z0-9_-]+$/.test(shortcutKey) || shortcutKey.length > MANIFEST_LIMITS.key || !shortcutName) return { ok: false, message: `El atajo «${shortcutKey}» necesita una «key» en minúsculas (a-z, 0-9, _ o -) y un «name».` };
    const description = oneLine(item.description, MANIFEST_LIMITS.shortcutDescription);
    shortcuts.push({ key: shortcutKey, name: shortcutName, ...(description ? { description } : {}) });
  }
  return shortcuts;
}

/** The manifest's `notice_topics`: an unknown icon is dropped (a bell is drawn); a bad or repeated key refuses it. */
function validateNoticeTopics(raw: unknown): NoticeTopic[] | { ok: false; message: string } {
  const list = Array.isArray(raw) ? raw : [];
  if (list.length > NOTICE_TOPIC_LIMITS.topics) return { ok: false, message: `Una app declara hasta ${NOTICE_TOPIC_LIMITS.topics} temas de aviso.` };
  const topics: NoticeTopic[] = [];
  for (const entry of list) {
    const item = record(entry);
    const key = typeof item.key === 'string' ? item.key : '';
    const name = oneLine(item.name, NOTICE_TOPIC_LIMITS.name);
    if (!TOPIC_KEY.test(key) || key.length > NOTICE_TOPIC_LIMITS.key || !name || topics.some((topic) => topic.key === key)) return { ok: false, message: `El tema «${key}» necesita una «key» única en minúsculas (a-z, 0-9, _ o -) y un «name».` };
    const description = oneLine(item.description, NOTICE_TOPIC_LIMITS.description);
    topics.push({ key, name, ...(description ? { description } : {}), ...(isNoticeIcon(item.icon) ? { icon: item.icon } : {}), ...('default' in item && item.default === null ? { noDefault: true as const } : {}) });
  }
  return topics;
}
