/**
 * Links saved in a notes chat, sorted by category (José, 18/11: he wanted them
 * organized by topic instead of one list by date). The server stores a card on the message
 * (`link`) and Lila picks its category; the clients draw the «Por categoría»
 * view with `buildCategoryView`. PURE engine.
 */
export type LinkPlatform = 'instagram' | 'facebook' | 'youtube' | 'tiktok' | 'web';
export type LinkFormat = 'reel' | 'post' | 'video' | 'short' | 'page';
/** `pending`: the server is still reading it; `unreadable`: the network did not show it to a robot. */
export type LinkStatus = 'pending' | 'ready' | 'unreadable';

export type LinkCard = {
  /** The link without its tracking params (`cleanLinkUrl`). */
  url: string;
  platform: LinkPlatform;
  format: LinkFormat;
  status: LinkStatus;
  /** Who posted it, as the network names them («Capi (@capi.al.grano)»). */
  author?: string;
  /** The post's caption or the video's title. */
  text?: string;
  /** Absolute http(s) thumbnail. */
  imageUrl?: string;
  /** The word the post asks to comment when that is ALL it says («NICHO»). */
  commentBait?: string;
  /** `null` or missing: «Sin categoría». */
  categoryId?: string | null;
  /** Who put it there: Lila when it was saved, or a person who moved it. */
  categoryBy?: 'lila' | 'user';
};

export type LinkCategory = { id: string; name: string };
/** One link message of the chat, as the «Por categoría» view needs it. */
export type LinkNoteItem = { seq: number; at: string; link: LinkCard };

/** A notes chat keeps at most this many categories: past it, Lila leaves new links «Sin categoría». */
export const MAX_LINK_CATEGORIES = 12;
export const MAX_CATEGORY_NAME = 40;

/** Query params that only say who shared it and from where. */
const TRACKING_PARAMS = new Set(['igsh', 'igshid', 'ig_rid', 'fbclid', 'gclid', 'mibextid', 'rdid', 'sfnsn', 'si', '_t', '_r', 'is_from_webapp', 'sender_device', 'share_app_id', 'share_link_id', 'feature']);

export function cleanLinkUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key) || key.startsWith('utm_')) url.searchParams.delete(key);
  }
  return url.toString().replace(/\?$/, '').replace(/\?#/, '#');
}

const isHost = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

export function linkPlatformOf(raw: string): { platform: LinkPlatform; format: LinkFormat } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { platform: 'web', format: 'page' };
  }
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  if (isHost(host, 'instagram.com')) return { platform: 'instagram', format: /\/reels?\//.test(path) ? 'reel' : 'post' };
  if (isHost(host, 'facebook.com') || isHost(host, 'fb.watch')) return { platform: 'facebook', format: facebookFormat(host, path) };
  if (isHost(host, 'youtube.com') || host === 'youtu.be') return { platform: 'youtube', format: path.startsWith('/shorts/') ? 'short' : 'video' };
  if (isHost(host, 'tiktok.com')) return { platform: 'tiktok', format: 'video' };
  return { platform: 'web', format: 'page' };
}

function facebookFormat(host: string, path: string): LinkFormat {
  if (isHost(host, 'fb.watch') || path.startsWith('/share/v/') || path.startsWith('/watch') || path.includes('/videos/')) return 'video';
  if (path.startsWith('/share/r/') || path.startsWith('/reel/')) return 'reel';
  return 'post';
}

const PLATFORM_NAMES: Record<Exclude<LinkPlatform, 'web'>, string> = { instagram: 'INSTAGRAM', facebook: 'FACEBOOK', youtube: 'YOUTUBE', tiktok: 'TIKTOK' };
const FORMAT_NAMES: Record<LinkFormat, string> = { reel: 'REEL', post: 'PUBLICACIÓN', video: 'VIDEO', short: 'SHORT', page: '' };

/** The pill of the card: «INSTAGRAM · REEL», «TIKTOK», or the site of a web page. */
export function platformLabel(card: Pick<LinkCard, 'platform' | 'format' | 'url'>): string {
  if (card.platform === 'web') {
    try {
      return new URL(card.url).hostname.replace(/^www\./, '').toUpperCase();
    } catch {
      return 'ENLACE';
    }
  }
  const name = PLATFORM_NAMES[card.platform];
  return card.platform === 'tiktok' ? name : `${name} · ${FORMAT_NAMES[card.format]}`;
}

const BAIT = /\b(?:comenta|comment|escribe|escr[ií]beme|d[eé]jame|deja)\s+(?:la palabra\s+|the word\s+)?["«“']?([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9]{2,})\b/i;
/** Below this many words besides the bait, the post says nothing else. */
const BAIT_ONLY_WORDS = 12;

/**
 * The word a post asks to comment when that is all it says («Comenta NICHO y
 * te lo paso»): its content only arrives by DM, so the card says so. A post
 * with real content that ALSO asks to comment is not flagged.
 */
export function commentBaitOf(text: string | undefined): string | null {
  if (!text) return null;
  const match = BAIT.exec(text);
  const keyword = match?.[1];
  if (!keyword || keyword !== keyword.toUpperCase()) return null;
  const rest = text
    .replace(match[0], ' ')
    .replace(/[#@][\p{L}\p{N}_.]+/gu, ' ')
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]{3,}/u.test(word));
  return rest.length < BAIT_ONLY_WORDS ? keyword.toUpperCase() : null;
}

const fold = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export type CategoryFilter = 'all' | 'none' | 'commentBait' | 'unreadable' | string;
export type CategoryChip = { id: string; name: string; count: number };
export type CategorySection = { id: string; name: string; count: number; items: LinkNoteItem[] };
export type CategoryView = {
  total: number;
  chips: CategoryChip[];
  sections: CategorySection[];
  review: { commentBait: number; unreadable: number };
};

const NO_CATEGORY = 'Sin categoría';

/**
 * The «Por categoría» view: one chip per category with its count (empty ones
 * too, so they can be picked), sections newest first, «Sin categoría» last.
 * The search folds accents and case and looks at author, text, URL and the
 * category's name; the chip counts stay those of the whole chat.
 */
export function buildCategoryView(items: readonly LinkNoteItem[], categories: readonly LinkCategory[], options: { query: string; only?: CategoryFilter }): CategoryView {
  const known = new Set(categories.map((category) => category.id));
  const bucketOf = (one: LinkNoteItem) => (one.link.categoryId && known.has(one.link.categoryId) ? one.link.categoryId : 'none');
  const counts = new Map<string, number>();
  for (const one of items) counts.set(bucketOf(one), (counts.get(bucketOf(one)) ?? 0) + 1);
  const chips: CategoryChip[] = [{ id: 'all', name: 'Todas', count: items.length }, ...categories.map((category) => ({ id: category.id, name: category.name, count: counts.get(category.id) ?? 0 }))];
  if (counts.get('none')) chips.push({ id: 'none', name: NO_CATEGORY, count: counts.get('none')! });

  const nameOf = new Map(categories.map((category) => [category.id, category.name]));
  const needle = fold(options.query.trim());
  const matches = (one: LinkNoteItem) => !needle || fold([one.link.author, one.link.text, one.link.url, nameOf.get(bucketOf(one))].filter(Boolean).join(' ')).includes(needle);
  // `at` is an ISO timestamp: plain string order is date order, without a collator per call (Hermes).
  const byNewest = (a: LinkNoteItem, b: LinkNoteItem) => (a.at < b.at ? 1 : a.at > b.at ? -1 : b.seq - a.seq);
  const newestFirst = (list: LinkNoteItem[]) => [...list].sort(byNewest);
  const found = items.filter(matches);

  const review = { commentBait: items.filter((one) => one.link.commentBait).length, unreadable: items.filter((one) => one.link.status === 'unreadable').length };
  if (options.only === 'commentBait' || options.only === 'unreadable') {
    const marked = newestFirst(found.filter((one) => (options.only === 'commentBait' ? one.link.commentBait : one.link.status === 'unreadable')));
    const name = options.only === 'commentBait' ? 'Solo piden comentar' : 'No se pudieron leer';
    return { total: items.length, chips, review, sections: marked.length ? [{ id: options.only, name, count: marked.length, items: marked }] : [] };
  }
  const order = [...categories.map((category) => ({ id: category.id, name: category.name })), { id: 'none', name: NO_CATEGORY }];
  const sections = order
    .filter((section) => !options.only || options.only === 'all' || options.only === section.id)
    .map((section) => {
      const list = newestFirst(found.filter((one) => bucketOf(one) === section.id));
      return { ...section, count: list.length, items: list };
    })
    .filter((section) => section.items.length > 0);
  return { total: items.length, chips, sections, review };
}
