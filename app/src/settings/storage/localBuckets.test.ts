import { describe, expect, it } from 'vitest';
import { localBucketOf, sumBuckets } from './localBuckets';

/** Pending 13: what Lilachat keeps on the phone, in groups a person understands. */
describe('localBucketOf', () => {
  it('photos and videos already seen', () => {
    expect(localBucketOf('image_manager_disk_cache', true)).toBe('seen');
    expect(localBucketOf('ExpoVideoCache', true)).toBe('seen');
    expect(localBucketOf('notice-thumbs', true)).toBe('seen');
  });

  it('downloaded voice notes', () => {
    expect(localBucketOf('voz', true)).toBe('voice');
  });

  it('documents opened or saved', () => {
    expect(localBucketOf('pdf-pages', true)).toBe('documents');
    expect(localBucketOf('Presupuesto obra.pdf', false)).toBe('documents');
    expect(localBucketOf('Lilachat-2026-10-22-0814-60.mp4', false)).toBe('documents');
  });

  it('temporary copies: picked photos, camera, recordings, sticker drafts, downloaded updates', () => {
    expect(localBucketOf('ImagePicker', true)).toBe('temporary');
    expect(localBucketOf('Camera', true)).toBe('temporary');
    expect(localBucketOf('apks', true)).toBe('temporary');
    expect(localBucketOf('sticker-1792520396752.webp', false)).toBe('temporary');
    expect(localBucketOf('sticker-cutout-1792537312698.png', false)).toBe('temporary');
  });

  it('leaves alone what is not ours to clear: the browser engine, the network cache', () => {
    expect(localBucketOf('WebView', true)).toBeNull();
    expect(localBucketOf('http-cache', true)).toBeNull();
  });
});

describe('sumBuckets', () => {
  it('adds up the sizes per group', () => {
    expect(sumBuckets([{ bucket: 'seen', bytes: 10 }, { bucket: 'seen', bytes: 5 }, { bucket: 'voice', bytes: 2 }, { bucket: null, bytes: 99 }])).toEqual({ seen: 15, voice: 2, documents: 0, temporary: 0 });
  });
});
