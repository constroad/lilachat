import { describe, expect, it } from 'vitest';
import { MEDIA_FRAME_WIDTH, photoBubbleStyle } from './photoBubbleStyle';

// José 26/11: «en WhatsApp se ve bien el tema de pdf, videos e imágenes»: one width, the picture fills the bubble.
describe('the frame of a photo or video in the web chat', () => {
  it('every frame is as wide as WhatsApp Web, never wider than the bubble', () => {
    expect(MEDIA_FRAME_WIDTH).toBe(300);
    expect(photoBubbleStyle({ width: 1600, height: 900 })).toMatchObject({ width: 300, maxWidth: '100%' });
  });

  it('a wide or square photo keeps its own shape', () => {
    expect(photoBubbleStyle({ width: 1600, height: 900 }).aspectRatio).toBe('1.7778');
    expect(photoBubbleStyle({ width: 1000, height: 1000 }).aspectRatio).toBe('1');
  });

  it('a tall photo or a phone video is cropped to 4:5, not drawn as a strip', () => {
    expect(photoBubbleStyle({ width: 720, height: 1280 }).aspectRatio).toBe('0.8');
    expect(photoBubbleStyle({ width: 359, height: 865 }).aspectRatio).toBe('0.8');
  });

  it('a panorama stops at 1.91:1', () => {
    expect(photoBubbleStyle({ width: 4000, height: 1000 }).aspectRatio).toBe('1.91');
  });

  it('a tall stamped shot is cropped from the bottom, where its stamp is (José 13/11)', () => {
    expect(photoBubbleStyle({ width: 720, height: 1280, stamped: true }).objectPosition).toBe('bottom');
    expect(photoBubbleStyle({ width: 720, height: 1280 }).objectPosition).toBeUndefined();
  });

  it('without dimensions (a WhatsApp video, an old message) it waits in 4:3', () => {
    expect(photoBubbleStyle({}).aspectRatio).toBe('1.3333');
    expect(photoBubbleStyle({ width: 400 }).aspectRatio).toBe('1.3333');
  });
});
