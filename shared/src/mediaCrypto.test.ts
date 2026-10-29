import { describe, expect, it } from 'vitest';
import { createMediaKey, MEDIA_CHUNK, openMediaFile, parseMediaSecret, sealedMediaSize, sealMediaFile, serializeMediaSecret } from './mediaCrypto.js';

/** Pending 67 / F12.3 (José, 29/10): the photos and videos of a secret chat travel encrypted. */
const bytesOf = (size: number) => Uint8Array.from({ length: size }, (_, index) => index % 251);

describe('sealMediaFile and openMediaFile', () => {
  it('a file of several chunks comes back the same, and the sealed size is known before sealing', () => {
    // Arrange
    const key = createMediaKey();
    const plain = bytesOf(MEDIA_CHUNK * 2 + 1234);
    // Act
    const sealed = sealMediaFile(plain, key);
    const opened = openMediaFile(sealed, key);
    // Assert
    expect(sealed.length).toBe(sealedMediaSize(plain.length));
    expect(opened).toEqual(plain);
  });

  it('an empty file and a file of exactly one chunk also work', () => {
    const key = createMediaKey();
    expect(openMediaFile(sealMediaFile(new Uint8Array(0), key), key)).toEqual(new Uint8Array(0));
    expect(openMediaFile(sealMediaFile(bytesOf(MEDIA_CHUNK), key), key)).toEqual(bytesOf(MEDIA_CHUNK));
  });

  it('refuses a changed byte, a cut file, swapped chunks and another key', () => {
    // Arrange
    const key = createMediaKey();
    const sealed = sealMediaFile(bytesOf(MEDIA_CHUNK * 2 + 10), key);
    const changed = sealed.slice();
    changed[100] = changed[100]! ^ 1;
    const chunk = MEDIA_CHUNK + 16;
    const swapped = new Uint8Array([...sealed.slice(chunk, chunk * 2), ...sealed.slice(0, chunk), ...sealed.slice(chunk * 2)]);
    // Act + Assert
    expect(() => openMediaFile(changed, key)).toThrow();
    expect(() => openMediaFile(sealed.slice(0, chunk * 2), key)).toThrow();
    expect(() => openMediaFile(swapped, key)).toThrow();
    expect(() => openMediaFile(sealed, createMediaKey())).toThrow();
  });
});

describe('the media secret inside the sealed text', () => {
  it('goes and comes back with the key, the type and the shape; ordinary text is not a media secret', () => {
    // Arrange
    const key = createMediaKey();
    const secret = { key, mime: 'image/jpeg', fileName: 'obra.jpg', sizeBytes: 2048, width: 1080, height: 1440, caption: 'Avance del km 12' };
    // Act
    const parsed = parseMediaSecret(serializeMediaSecret(secret));
    // Assert
    expect(parsed).toEqual(secret);
    expect(parseMediaSecret('hola')).toBeNull();
    expect(parseMediaSecret('{"lilachat":"media","k":"corto"}')).toBeNull();
  });
});
