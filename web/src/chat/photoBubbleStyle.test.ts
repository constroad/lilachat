import { describe, expect, it } from 'vitest';
import { photoBubbleStyle } from './photoBubbleStyle';

describe('the frame of a photo in the web chat', () => {
  it('a tall stamped shot is cropped from the bottom, where its stamp is (José 13/11)', () => {
    expect(photoBubbleStyle({ width: 720, height: 1280, stamped: true })).toEqual({ width: 240, height: 320, maxWidth: '100%', maxHeight: 'none', objectPosition: 'bottom' });
  });

  it('a tall voucher takes the portrait frame instead of a band of its middle', () => {
    expect(photoBubbleStyle({ width: 359, height: 865 })).toEqual({ width: 240, height: 320, maxWidth: '100%', maxHeight: 'none' });
  });

  it('a slightly tall photo keeps its own shape', () => {
    expect(photoBubbleStyle({ width: 900, height: 1000 })).toEqual({ width: 240, height: 267, maxWidth: '100%', maxHeight: 'none' });
  });

  it('a wide or square photo stays as wide as the bubble', () => {
    expect(photoBubbleStyle({ width: 1600, height: 900 })).toEqual({ aspectRatio: '1600 / 900' });
    expect(photoBubbleStyle({ width: 1000, height: 1000 })).toEqual({ aspectRatio: '1000 / 1000' });
  });

  it('an old message without dimensions adds nothing', () => {
    expect(photoBubbleStyle({})).toBeUndefined();
    expect(photoBubbleStyle({ width: 400 })).toBeUndefined();
  });
});
