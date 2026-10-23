import { validateBotCommands, type BotCommand } from './botCommands.js';

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
};

export const MANIFEST_LIMITS = { key: 32, name: 40, url: 500, appsPerDeveloper: 20, description: 120, features: 6, feature: 140, developer: 60 };
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
  return { ok: true, manifest: { key, name, ...(avatarUrl ? { avatarUrl } : {}), redirectUri, webhookUrl, ...(installUrl ? { installUrl } : {}), ...(commands ? { commands } : {}), ...about } };
}

const ELLIPSIS = '…';

/** Too long: cut at the last whole word that fits with «…» (no dangling comma); a text without spaces is cut hard. */
function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  // One character more than fits, to know whether the cut falls right on a space.
  const room = text.slice(0, max - ELLIPSIS.length + 1);
  const lastSpace = room.lastIndexOf(' ');
  const head = lastSpace > 0 ? room.slice(0, lastSpace) : text.slice(0, max - ELLIPSIS.length);
  return `${head.replace(/[\s,;:.\-–—]+$/, '')}${ELLIPSIS}`;
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
