/**
 * Videos from YouTube, TikTok, Instagram and Facebook played inside Lilachat
 * (pending 6), with each site's own embed player: nothing is downloaded or
 * re-hosted. What is not recognized opens in the browser as before. PURE.
 */
export type VideoProvider = 'youtube' | 'tiktok' | 'instagram' | 'facebook';
export type VideoEmbed = { provider: VideoProvider; embedUrl: string; aspect: number; label: string };

const WIDE = 16 / 9;
const TALL = 9 / 16;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const NUMERIC_ID = /^\d{6,25}$/;
const INSTAGRAM_CODE = /^[A-Za-z0-9_-]{5,40}$/;
const LABEL: Record<VideoProvider, string> = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook' };

const embed = (provider: VideoProvider, embedUrl: string, aspect: number): VideoEmbed => ({ provider, embedUrl, aspect, label: LABEL[provider] });

/** «42», «1m30s» or «90s» → seconds; anything else → null. */
function startSeconds(raw: string | null): number | null {
  if (!raw) return null;
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(raw);
  if (!match || !match[0]) return null;
  const seconds = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  return seconds > 0 ? seconds : null;
}

function youtube(url: URL, host: string): VideoEmbed | null {
  const path = url.pathname.split('/').filter(Boolean);
  let id: string | undefined;
  let aspect = WIDE;
  if (host === 'youtu.be') id = path[0];
  else if (path[0] === 'watch') id = url.searchParams.get('v') ?? undefined;
  else if (path[0] === 'shorts' || path[0] === 'live' || path[0] === 'embed') {
    id = path[1];
    if (path[0] === 'shorts') aspect = TALL;
  }
  if (!id || !YOUTUBE_ID.test(id)) return null;
  const start = startSeconds(url.searchParams.get('t') ?? url.searchParams.get('start'));
  return embed('youtube', `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0${start ? `&start=${start}` : ''}`, aspect);
}

function tiktok(url: URL): VideoEmbed | null {
  const path = url.pathname.split('/').filter(Boolean);
  const id = path[1] === 'video' ? path[2] : undefined;
  return id && NUMERIC_ID.test(id) ? embed('tiktok', `https://www.tiktok.com/embed/v2/${id}`, TALL) : null;
}

function instagram(url: URL): VideoEmbed | null {
  const [kind, code] = url.pathname.split('/').filter(Boolean);
  if (!kind || !code || !['p', 'reel', 'tv'].includes(kind) || !INSTAGRAM_CODE.test(code)) return null;
  return embed('instagram', `https://www.instagram.com/${kind}/${code}/embed`, kind === 'p' ? 4 / 5 : TALL);
}

function facebook(url: URL, host: string): VideoEmbed | null {
  const path = url.pathname.split('/').filter(Boolean);
  const isReel = path[0] === 'reel' && NUMERIC_ID.test(path[1] ?? '');
  const isVideo = host === 'fb.watch' || (path.includes('videos') && NUMERIC_ID.test(path[path.indexOf('videos') + 1] ?? '')) || (path[0] === 'watch' && NUMERIC_ID.test(url.searchParams.get('v') ?? ''));
  if (!isReel && !isVideo) return null;
  const href = `${url.origin}${url.pathname}${path[0] === 'watch' ? url.search : ''}`;
  return embed('facebook', `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(href)}&show_text=false`, isReel ? TALL : WIDE);
}

/** The embed player for a video link, or null to open it in the browser. */
export function videoEmbedFor(link: string): VideoEmbed | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
  if (host === 'youtube.com' || host === 'youtu.be' || host === 'music.youtube.com') return youtube(url, host);
  if (host === 'tiktok.com') return tiktok(url);
  if (host === 'instagram.com') return instagram(url);
  if (host === 'facebook.com' || host === 'fb.watch') return facebook(url, host);
  return null;
}

/** The only origins the web lets into a frame besides its own (its CSP `frame-src`). */
export const VIDEO_EMBED_ORIGINS = ['https://www.youtube-nocookie.com', 'https://www.tiktok.com', 'https://www.instagram.com', 'https://www.facebook.com'] as const;

/** The page the player lives in: its origin is sent as the referrer, which YouTube now asks of embeds. */
export const VIDEO_PLAYER_ORIGIN = 'https://lilachat.constroad.com';

const escapeAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** A black page with only the site's player in it: no scripts of ours. */
export function videoPlayerHtml(video: VideoEmbed): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100%;height:100%}</style></head><body><iframe src="${escapeAttribute(video.embedUrl)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>`;
}

/** The biggest box with the video's shape that fits in the space (whole pixels). */
export function fitVideo(aspect: number, box: { width: number; height: number }): { width: number; height: number } {
  const byWidth = { width: box.width, height: Math.round(box.width / aspect) };
  return byWidth.height <= box.height ? byWidth : { width: Math.round(box.height * aspect), height: box.height };
}
