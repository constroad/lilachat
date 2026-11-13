import { describe, expect, it } from 'vitest';
import { liveCameraFits, recorderTypeOf, shotNameOf, stampOfFile, withStamp } from './shotStamp';

/**
 * José 12/11: the same camera everywhere, the PWA on a phone too. A browser on a phone opens
 * Lilachat's camera with the live stamp; a computer, or a field that takes the gallery, keeps the
 * file picker.
 */
describe('liveCameraFits', () => {
  it('opens on a phone browser with a camera, for a field that is not the gallery', () => {
    // Act
    const phone = liveCameraFits({ media: true, coarse: true }, {});
    // Assert
    expect(phone).toBe(true);
  });

  it('keeps the picker on a computer, without camera access, or for a gallery field', () => {
    // Act
    const cases = [liveCameraFits({ media: true, coarse: false }, {}), liveCameraFits({ media: false, coarse: true }, {}), liveCameraFits({ media: true, coarse: true }, { gallery: true })];
    // Assert
    expect(cases).toEqual([false, false, false]);
  });
});

describe('recorderTypeOf', () => {
  it('prefers MP4 (an iPhone), then WebM (Android Chrome)', () => {
    // Act
    const iphone = recorderTypeOf((type) => type.startsWith('video/mp4'));
    const android = recorderTypeOf((type) => type.startsWith('video/webm'));
    // Assert
    expect(iphone).toBe('video/mp4');
    expect(android).toBe('video/webm');
  });

  it('says none when the browser records nothing', () => {
    // Act
    const none = recorderTypeOf(() => false);
    // Assert
    expect(none).toBeNull();
  });
});

describe('a shot carries its stamp', () => {
  it('names the file by its kind and keeps the stamp beside it, not inside the bytes', () => {
    // Arrange
    const stamp = { timemark: true as const, point: null, logo: true, takenAt: '2026-11-12T22:34:00.000Z' };
    const file = withStamp(new File(['x'], shotNameOf('video/webm;codecs=vp9', 1_794_540_000_000), { type: 'video/webm' }), stamp);
    // Act
    const read = stampOfFile(file);
    const plain = stampOfFile(new File(['y'], 'otra.jpg'));
    // Assert
    expect(file.name).toBe('video-1794540000000.webm');
    expect(shotNameOf('image/jpeg', 5)).toBe('foto-5.jpg');
    expect(read).toEqual(stamp);
    expect(plain).toBeUndefined();
  });
});
