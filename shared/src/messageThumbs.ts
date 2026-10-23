import { LILACHAT_WEB_URL } from './spaceSections.js';
import { winkById } from './winks.js';

/**
 * The small image a message shows in the chat list and in its notification
 * (pending 57, José 22/10: a sticker or a wink arrived as the word «Sticker»).
 * PURE: the server makes the path absolute.
 */
type ThumbSource = { kind?: string; deletedAt?: string | Date | null; media?: { url?: string; thumbUrl?: string; mime?: string } | null };

export function listThumbPath(message: ThumbSource): string | undefined {
  const media = message.media;
  if (message.deletedAt || !media) return undefined;
  if (media.thumbUrl) return media.thumbUrl;
  // An image is its own preview (photo, sticker, GIF); anything else needs a generated one.
  return media.mime?.startsWith('image/') && media.url ? media.url : undefined;
}

/**
 * A wink's tile, served by the web (`web/public/guinos`): the character, or the
 * piece of a wink without one. `origin` empty = the same site (the web itself).
 */
export function winkTileUrl(winkId: string | undefined, origin: string = LILACHAT_WEB_URL): string | undefined {
  const wink = winkById(winkId);
  if (!wink || wink.kind !== 'character') return undefined;
  return `${origin}/guinos/${wink.tile ?? wink.id}-tile.webp`;
}
