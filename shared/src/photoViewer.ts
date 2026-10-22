/**
 * What the photo viewer swipes through (José, 22/10: the stickers showed up
 * between the photos). Photos, GIFs and videos with a frame; never a sticker
 * (it is an image too), a deleted message or a file.
 */
export function opensInPhotoViewer(message: { kind?: string; deletedAt?: string | null; media?: { url?: string; thumbUrl?: string; mime?: string } | null }): boolean {
  const media = message.media;
  if (!media?.url || message.deletedAt || message.kind === 'sticker') return false;
  return Boolean(media.mime?.startsWith('image/') || media.mime?.startsWith('video/') || media.thumbUrl);
}
