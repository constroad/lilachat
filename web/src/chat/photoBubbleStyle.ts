import type { CSSProperties } from 'react';
import { bubbleCropAnchor } from '@lilachat/shared';

/** WhatsApp Web's media width: every photo and video bubble is this wide (José 26/11). */
export const MEDIA_FRAME_WIDTH = 300;
/** The tallest frame, 4:5: a phone video is cropped, not drawn as a narrow strip. */
const TALLEST_RATIO = 0.8;
/** The widest frame, 1.91:1: a panorama does not become a thin band. */
const WIDEST_RATIO = 1.91;
/** Until the picture says its size (a WhatsApp video carries none). */
const UNKNOWN_RATIO = 4 / 3;

const asCss = (ratio: number) => String(Math.round(ratio * 10_000) / 10_000);

/**
 * The frame of a photo or video in the web chat: a fixed width, its own shape
 * between 4:5 and 1.91:1, the picture cropped to fill it.
 */
export function photoBubbleStyle(media: { width?: number; height?: number; stamped?: boolean }): CSSProperties & { aspectRatio: string } {
  const { width, height } = media;
  const ratio = width && height ? Math.min(WIDEST_RATIO, Math.max(TALLEST_RATIO, width / height)) : UNKNOWN_RATIO;
  const anchor = bubbleCropAnchor(media);
  return { width: MEDIA_FRAME_WIDTH, maxWidth: '100%', aspectRatio: asCss(ratio), ...(anchor === 'bottom' ? { objectPosition: 'bottom' } : {}) };
}
