import { toAbsoluteMediaUrl } from './mediaClient.js';
import type { Sticker } from './stickerModel.js';

/** A sticker of «Mis stickers» as the app and the web read it. */
export function toClientSticker(sticker: Pick<Sticker, '_id' | 'url' | 'mime' | 'width' | 'height' | 'favorite' | 'createdAt' | 'animated'>) {
  return { id: String(sticker._id), url: toAbsoluteMediaUrl(sticker.url), mime: sticker.mime, width: sticker.width, height: sticker.height, favorite: sticker.favorite, at: sticker.createdAt, ...(sticker.animated ? { animated: true } : {}) };
}
