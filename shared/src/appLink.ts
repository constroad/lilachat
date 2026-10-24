/**
 * «Conectado como … / Desconectar» (pending 59; agentes f02cb99, 24/10): the
 * account a person connected is per app, like Slack. Lilachat asks the app
 * through its signed webhook (`link.status`, `link.revoke`) and keeps nothing.
 */
export type AppLink = { linked: true; label: string } | { linked: false } | { unknown: true };

const LABEL_MAX = 80;

/** The app's answer to `link.status`; anything else (an older app, a broken body) hides the row. */
export function linkOfReply(body: unknown): AppLink {
  if (!body || typeof body !== 'object') return { unknown: true };
  const reply = body as { linked?: unknown; label?: unknown };
  if (reply.linked === false) return { linked: false };
  if (reply.linked === true && typeof reply.label === 'string' && reply.label.trim()) return { linked: true, label: reply.label.trim().slice(0, LABEL_MAX) };
  return { unknown: true };
}

/** `link.revoke` worked only when the app says `{ ok: true }`. */
export const revokedOfReply = (body: unknown): boolean => Boolean(body && typeof body === 'object' && (body as { ok?: unknown }).ok === true);

/** The line of the row: who I am in the app, or how I get connected. */
export function appLinkLine(link: AppLink, appName: string): string | null {
  if ('unknown' in link) return null;
  return link.linked ? `Conectado como ${link.label}` : `Sin conectar. ${appName} te lo pide la primera vez que la usas.`;
}
