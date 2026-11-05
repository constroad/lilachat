import type { CSSProperties } from 'react';
import { tamanoDeBurbuja } from '@lilachat/shared';

/**
 * A portrait photo gets the phone's frame: stretched to the bubble's width and
 * capped at 256 px, a voucher showed only a band of its middle (04/11).
 */
export function photoBubbleStyle(media: { width?: number; height?: number }): CSSProperties | undefined {
  const { width, height } = media;
  if (!width || !height) return undefined;
  if (height <= width) return { aspectRatio: `${width} / ${height}` };
  const frame = tamanoDeBurbuja(media);
  return { width: frame.ancho, height: frame.alto, maxWidth: '100%', maxHeight: 'none' };
}
