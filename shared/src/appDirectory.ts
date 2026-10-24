import { APP_CATEGORIES, APP_CATEGORY_LABEL, type AppCategory } from './botManifest.js';
import type { DirectoryApp } from './bots.js';
import { LILACHAT_WEB_URL } from './spaceSections.js';

/**
 * The apps directory of a space (design e-24, like Slack's): the chips, the
 * search and the lines of the detail. PURE: the app and the web draw it.
 */
export type DirectoryFilter = 'all' | 'installed' | AppCategory;
type Installation = NonNullable<DirectoryApp['installation']>;

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
/** Lima is UTC-5 all year: the date the person reads is that day there. */
const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000;
const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function directoryChips(apps: readonly DirectoryApp[]): { key: DirectoryFilter; label: string }[] {
  const installed = apps.filter((app) => app.installation).length;
  const categories = APP_CATEGORIES.filter((category) => apps.some((app) => app.category === category));
  return [{ key: 'all', label: 'Todas' }, { key: 'installed', label: `Instaladas (${installed})` }, ...categories.map((key) => ({ key, label: APP_CATEGORY_LABEL[key] }))];
}

export function filterDirectory(apps: readonly DirectoryApp[], params: { filter: DirectoryFilter; query: string }): DirectoryApp[] {
  const words = plain(params.query.trim());
  return apps.filter((app) => {
    if (params.filter === 'installed' && !app.installation) return false;
    if (params.filter !== 'all' && params.filter !== 'installed' && app.category !== params.filter) return false;
    if (!words) return true;
    const haystack = plain([app.name, app.description ?? '', app.category ? APP_CATEGORY_LABEL[app.category] : ''].join(' '));
    return haystack.includes(words);
  });
}

/** What an app can and cannot do today, the same for every app (§c and §c-bis of the bots API). */
export const APP_PERMISSIONS = {
  can: ['Publicar en los canales públicos del espacio y en los que la agreguen', 'Responder a quien la menciona, le escribe o usa sus comandos'],
  cannot: ['Leer chats personales', 'Leer canales privados donde no la agregaron'],
} as const;

/** The installed apps nobody here has a 1:1 with yet: the «Apps» section lists them under the chats (design e-23). */
export function installedWithoutChat(apps: readonly DirectoryApp[], chats: readonly { appId?: string }[]): DirectoryApp[] {
  return apps.filter((app) => app.installation && !chats.some((chat) => chat.appId === app.appId));
}

/** «Activa en 3 canales y 12 mensajes directos»; nothing while it is in no chat. */
export function appActivityLine(installation: Pick<Installation, 'channels' | 'directs'>): string {
  const parts = [installation.channels > 0 ? plural(installation.channels, 'canal', 'canales') : '', installation.directs > 0 ? plural(installation.directs, 'mensaje directo', 'mensajes directos') : ''].filter(Boolean);
  return parts.length ? `Activa en ${parts.join(' y ')}` : '';
}

/** «Instalada por José Zamora · 23 oct». */
export function appInstalledByLine(installation: Pick<Installation, 'installedBy' | 'installedAt'>): string {
  const day = new Date(new Date(installation.installedAt).getTime() + LIMA_OFFSET_MS);
  const date = `${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}`;
  return installation.installedBy ? `Instalada por ${installation.installedBy} · ${date}` : `Instalada el ${date}`;
}

/**
 * Where agentes sends the person back after installing (José, 23/10, like
 * Slack and Bitbucket: the web only signs in and authorizes). Android opens
 * the app on it (App Link); the web opens the same space and app.
 */
export const appReturnLink = (spaceId: string, clientId: string): string => `${LILACHAT_WEB_URL}/s/${spaceId}/apps/${encodeURIComponent(clientId)}`;

/** A regex, not `URL`: React Native's is incomplete. A full address must be Lilachat's; a bare path is the web's own. */
const RETURN_LINK = /^(?:https:\/\/lilachat\.constroad\.com)?\/s\/([0-9a-f]{24})\/apps\/([A-Za-z0-9_-]{4,64})(\/chat)?(?:[/?#]|$)/i;

/** The 1:1 with an app (pending 49): what a product sends when an answer is only for whoever asked. */
export const appChatLink = (spaceId: string, clientId: string): string => `${appReturnLink(spaceId, clientId)}/chat`;

export function appReturnFromLink(url: string | null | undefined): { spaceId: string; clientId: string; chat?: true } | null {
  const match = RETURN_LINK.exec(url ?? '');
  return match ? { spaceId: match[1]!.toLowerCase(), clientId: match[2]!, ...(match[3] ? { chat: true as const } : {}) } : null;
}
