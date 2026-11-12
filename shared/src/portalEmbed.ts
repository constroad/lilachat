/**
 * Portal's editor 2.0 framed in Lilachat web (José 11/11: every member edits,
 * only admins delete, earlier versions restorable; Portal's contract of the
 * same day). On a window of 1024 px or more a report Portal marks
 * `editor: 'v2'` opens there; the phone and the APK keep the form. Portal
 * mints a link per member and request (`#t=<token>` in the fragment, 12 h);
 * both sides talk by `postMessage`, version 1. PURE: server and web.
 */
export const PORTAL_EMBED_ORIGINS = { production: 'https://www.constroad.com', development: 'http://localhost:3000' } as const;
/** Portal's canvas threshold: narrower, the report keeps the form. */
export const EMBED_MIN_WIDTH_PX = 1024;
export const EMBED_VERSION = 1;
const PREFIX = 'portal-embed:';
const EMBED_PATH = /^\/embed\/report\/[A-Za-z0-9_-]{1,64}$/;
const TOKEN = /^#t=[A-Za-z0-9._~-]{1,4096}$/;

export type EmbedLink = { url: string; expiresAt: string };
export type EmbedEvent =
  | { type: 'ready' } | { type: 'dirty'; dirty: boolean } | { type: 'saved'; reportId: string; savedAt: string }
  | { type: 'published'; reportId: string; pdfUrl?: string } | { type: 'closed' } | { type: 'error'; code: string };
export type EmbedCommand = { type: `${typeof PREFIX}close-request`; version: typeof EMBED_VERSION } | { type: `${typeof PREFIX}theme`; version: typeof EMBED_VERSION; mode: 'light' | 'dark' };

type Raw = Record<string, unknown>;
const record = (value: unknown): Raw | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : null);
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

function parsedUrl(value: unknown): URL | null {
  try {
    return typeof value === 'string' ? new URL(value) : null;
  } catch {
    return null;
  }
}

/** Portal's answer `{url, expires_at}` (or this module's own `expiresAt`), only from an origin the caller frames, on the embed path, with its token. */
export function embedLinkOf(raw: unknown, origins: readonly string[]): EmbedLink | null {
  const answer = record(raw);
  const url = parsedUrl(answer?.url);
  const expiresAt = text(answer?.expires_at ?? answer?.expiresAt);
  if (!url || !expiresAt || Number.isNaN(Date.parse(expiresAt))) return null;
  if (!origins.includes(url.origin) || !EMBED_PATH.test(url.pathname) || url.search || !TOKEN.test(url.hash)) return null;
  return { url: url.href, expiresAt };
}

const https = (value: unknown): string | undefined => (typeof value === 'string' && value.startsWith('https://') ? value : undefined);

function eventBody(kind: string, message: Raw): EmbedEvent | null {
  if (kind === 'ready' || kind === 'closed') return { type: kind };
  if (kind === 'dirty') return typeof message.dirty === 'boolean' ? { type: 'dirty', dirty: message.dirty } : null;
  const reportId = text(message.reportId);
  if (kind === 'saved') {
    const savedAt = text(message.savedAt);
    return reportId && savedAt ? { type: 'saved', reportId, savedAt } : null;
  }
  if (kind === 'published') {
    const pdfUrl = https(message.pdfUrl);
    return reportId ? { type: 'published', reportId, ...(pdfUrl ? { pdfUrl } : {}) } : null;
  }
  const code = kind === 'error' ? text(message.code) : null;
  return code ? { type: 'error', code } : null;
}

/** One of Portal's messages, or null for anything else (another version, another sender's shape). The caller checks the origin and the source. */
export function embedEventOf(data: unknown): EmbedEvent | null {
  const message = record(data);
  const type = text(message?.type);
  if (!message || !type?.startsWith(PREFIX) || message.version !== EMBED_VERSION) return null;
  return eventBody(type.slice(PREFIX.length), message);
}

export const embedCloseRequest = (): EmbedCommand => ({ type: `${PREFIX}close-request`, version: EMBED_VERSION });
export const embedTheme = (mode: 'light' | 'dark'): EmbedCommand => ({ type: `${PREFIX}theme`, version: EMBED_VERSION, mode });

/** A report Portal edits in its canvas, on a window wide enough for it. */
export const opensEmbed = (windowWidth: number, report: { editor?: 'v2' }): boolean => windowWidth >= EMBED_MIN_WIDTH_PX && report.editor === 'v2';

const ERROR_LINES: Record<string, string> = {
  'not-found': 'Este informe ya no está en el Portal.',
  forbidden: 'No tienes permiso para editar este informe.',
};
export const EMBED_FAILED = 'No se pudo abrir el editor del Portal.';
/** What the person reads for Portal's error code; `expired` never shows: the link is asked again. */
export const embedErrorLine = (code: string): string => ERROR_LINES[code] ?? EMBED_FAILED;

/** What the server answers the web. */
export type EmbedBody = { embed?: EmbedLink; message?: string };
export const reportEmbedPath = (spaceId: string, clientId: string, serviceId: string, reportId: string): string =>
  `/workspaces/${spaceId}/clients/${encodeURIComponent(clientId)}/services/${encodeURIComponent(serviceId)}/reports/${encodeURIComponent(reportId)}/embed`;
