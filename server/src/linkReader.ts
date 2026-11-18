import { cleanLinkUrl, commentBaitOf, linkPlatformOf, type LinkCard } from '@lilachat/shared';
import { fetchPublicHtml, finalUrlOf, traerVistaPrevia } from './traerVistaPrevia.js';
import { decodificar, etiquetasMeta } from './vistaPrevia.js';

/**
 * The card of a link saved in a notes chat (José, 18/11): who posted it, what
 * it says and its thumbnail. Each network hands this out differently to a
 * robot, measured on 18/11:
 * - Instagram gives a reel only «Name (@handle) • Reel»; the caption comes from
 *   the public captioned embed (`/embed/captioned/`), in the body.
 * - Facebook puts «stats | caption | page» in `og:title` and the caption in
 *   `og:description`.
 * - YouTube and TikTok answer oEmbed (title and channel).
 */
const MAX_TEXT = 600;
const MAX_AUTHOR = 120;

/** The card the generic preview reader returns (oEmbed or `og:` tags). */
type FetchedPreview = Awaited<ReturnType<typeof traerVistaPrevia>>;

export type LinkReaderDeps = {
  fetchHtml: (url: string, options?: { wholeBody?: boolean }) => Promise<string | null>;
  fetchPreview: (url: string) => Promise<FetchedPreview>;
  /** Follows a short link to the page it stands for. */
  resolveUrl: (url: string) => Promise<string>;
};

const defaultDeps: LinkReaderDeps = { fetchHtml: fetchPublicHtml, fetchPreview: traerVistaPrevia, resolveUrl: finalUrlOf };

const tidy = (text: string | undefined, max: number): string | undefined => {
  const clean = decodificar(text ?? '').replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, max) : undefined;
};

export function instagramEmbedUrl(raw: string): string | null {
  const match = /\/(p|reels?|tv)\/([\w-]+)/.exec(new URL(raw).pathname);
  if (!match) return null;
  const kind = match[1] === 'p' ? 'p' : match[1] === 'tv' ? 'tv' : 'reel';
  return `https://www.instagram.com/${kind}/${match[2]}/embed/captioned/`;
}

export function parseInstagramEmbed(html: string): { username?: string; caption?: string } {
  const block = /class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments"/.exec(html)?.[1];
  if (!block) return {};
  const username = /class="CaptionUsername"[^>]*>([^<]+)<\/a>/.exec(block)?.[1]?.trim();
  const body = block.replace(/<a class="CaptionUsername"[\s\S]*?<\/a>/, '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ');
  const caption = tidy(body, MAX_TEXT);
  return { ...(username ? { username } : {}), ...(caption ? { caption } : {}) };
}

/** «Capi (@capi.al.grano)» from the reel title, «Name (@handle)» from a post title, or «@handle». */
export function instagramAuthor(title: string | undefined, username: string | undefined): string | undefined {
  const reel = title ? /^(.+?\(@[\w.]+\))\s*•/.exec(title)?.[1] : undefined;
  if (reel) return reel.trim();
  const post = title ? /^(.+?) (?:en|on) Instagram:/.exec(title)?.[1]?.trim() : undefined;
  if (post && username) return `${post} (@${username})`.slice(0, MAX_AUTHOR);
  return username ? `@${username}` : post;
}

const FACEBOOK_STATS = /(reproducciones|reacciones|views|reactions|comentarios|comments)/i;

export function parseFacebookMeta(meta: Map<string, string>): { author?: string; text?: string; imageUrl?: string } {
  const parts = decodificar(meta.get('og:title') ?? '').split(' | ').map((part) => part.trim()).filter(Boolean);
  if (parts.length > 0 && FACEBOOK_STATS.test(parts[0]!)) parts.shift();
  if (parts.length < 2) return {};
  const author = tidy(parts[parts.length - 1], MAX_AUTHOR);
  const text = tidy(meta.get('og:description'), MAX_TEXT) ?? tidy(parts.slice(0, -1).join(' | '), MAX_TEXT);
  const image = meta.get('og:image');
  return { ...(author ? { author } : {}), ...(text ? { text } : {}), ...(image && /^https:\/\//.test(image) ? { imageUrl: decodificar(image) } : {}) };
}

type CardContent = Pick<LinkCard, 'author' | 'text' | 'imageUrl'>;

async function readInstagram(url: string, deps: LinkReaderDeps): Promise<CardContent> {
  const embedUrl = instagramEmbedUrl(url);
  const [embedHtml, preview] = await Promise.all([embedUrl ? deps.fetchHtml(embedUrl) : null, deps.fetchPreview(url)]);
  const embed = embedHtml ? parseInstagramEmbed(embedHtml) : {};
  return { author: instagramAuthor(preview?.titulo, embed.username), text: embed.caption, imageUrl: preview?.imagen };
}

async function readFacebook(url: string, deps: LinkReaderDeps): Promise<CardContent> {
  const html = await deps.fetchHtml(url, { wholeBody: false });
  return html ? parseFacebookMeta(etiquetasMeta(html)) : {};
}

/** YouTube and TikTok by oEmbed (author in `descripcion`); a web page by its `og:` tags. */
async function readByPreview(url: string, oembed: boolean, deps: LinkReaderDeps): Promise<CardContent> {
  const preview = await deps.fetchPreview(url);
  if (!preview) return {};
  const text = oembed ? preview.titulo : [preview.titulo, preview.descripcion].filter(Boolean).join(' · ');
  return { author: oembed ? tidy(preview.descripcion, MAX_AUTHOR) : tidy(preview.sitio, MAX_AUTHOR), text: tidy(text, MAX_TEXT), imageUrl: preview.imagen };
}

/** TikTok's oEmbed only answers for `/@user/video/<id>`: a shared short link (vt.tiktok.com) is followed first. */
async function readTikTok(url: string, deps: LinkReaderDeps): Promise<CardContent> {
  const target = /\/video\/\d+/.test(url) ? url : cleanLinkUrl(await deps.resolveUrl(url));
  const content = await readByPreview(target, true, deps);
  // A video without caption gets «TikTok · <sound>» as title, and no author: the handle is in the URL.
  const text = content.text && !/^TikTok( · |$)/.test(content.text) ? content.text : undefined;
  const handle = /\/@([\w.]+)\//.exec(target)?.[1];
  return { ...content, text, author: content.author ?? (handle ? `@${handle}` : undefined) };
}

function readContent(url: string, platform: LinkCard['platform'], deps: LinkReaderDeps): Promise<CardContent> {
  if (platform === 'instagram') return readInstagram(url, deps);
  if (platform === 'facebook') return readFacebook(url, deps);
  if (platform === 'tiktok') return readTikTok(url, deps);
  return readByPreview(url, platform === 'youtube', deps);
}

const defined = <T extends object>(value: T): Partial<T> => Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as Partial<T>;

export async function readLinkCard(raw: string, deps: LinkReaderDeps = defaultDeps): Promise<LinkCard> {
  const url = cleanLinkUrl(raw);
  const { platform, format } = linkPlatformOf(url);
  const content = await readContent(url, platform, deps).catch((error) => {
    console.error(`[links] could not read ${platform}:`, (error as Error)?.message ?? error);
    return {} as CardContent;
  });
  const status = content.text || content.author ? 'ready' : 'unreadable';
  const commentBait = commentBaitOf(content.text) ?? undefined;
  return { url, platform, format, status, ...defined(content), ...(commentBait ? { commentBait } : {}) };
}
