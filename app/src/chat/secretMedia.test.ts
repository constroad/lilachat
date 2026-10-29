import { describe, expect, it } from 'vitest';
import { createMediaKey, serializeMediaSecret } from '@lilachat/shared';
import { openedFileName, UNREADABLE, withOpenedText } from './secretMedia';

/** Pending 67 / F12.3 (José, 29/10): the photos and videos of a secret chat travel encrypted. */
type Shown = { seq: number; body?: string; media?: { mediaId: string; url?: string; thumbUrl?: string; mime?: string; fileName?: string; sizeBytes?: number; width?: number; height?: number; sealed?: 'opening' | 'failed' } };
const sealedMessage: Shown = { seq: 4, media: { mediaId: 'm1', url: 'https://lilachat.constroad.com/media/chats/c1/abc123.bin', mime: 'application/octet-stream', fileName: 'sellado', sizeBytes: 316 } };
const secretText = serializeMediaSecret({ key: createMediaKey(), mime: 'image/jpeg', fileName: 'obra.jpg', sizeBytes: 300, width: 1080, height: 1440, caption: 'Avance km 12' });

describe('withOpenedText', () => {
  it('a decrypted photo takes its type, shape, caption and the local file', () => {
    // Act
    const shown = withOpenedText(sealedMessage, secretText, () => ({ uri: 'file:///cache/secreto/abc123.jpg' }));
    // Assert
    expect(shown.body).toBe('Avance km 12');
    expect(shown.media).toMatchObject({ mime: 'image/jpeg', fileName: 'obra.jpg', width: 1080, height: 1440, url: 'file:///cache/secreto/abc123.jpg', thumbUrl: 'file:///cache/secreto/abc123.jpg' });
    expect(shown.media?.sealed).toBeUndefined();
  });

  it('a decrypted voice note keeps its duration and waveform; a document keeps its name; neither gets a thumbnail (pending 118)', () => {
    // Arrange
    const voice = serializeMediaSecret({ key: createMediaKey(), mime: 'audio/mp4', fileName: 'nota.m4a', sizeBytes: 9000, durationMs: 4200, waveform: [10, 80, 30] });
    const pdf = serializeMediaSecret({ key: createMediaKey(), mime: 'application/pdf', fileName: 'contrato.pdf', sizeBytes: 50_000 });
    // Act
    const heard = withOpenedText(sealedMessage, voice, () => ({ uri: 'file:///cache/secreto/abc123.m4a' }));
    const read = withOpenedText(sealedMessage, pdf, () => ({ uri: 'file:///cache/secreto/abc123.pdf' }));
    // Assert
    expect(heard.media).toMatchObject({ mime: 'audio/mp4', durationMs: 4200, onda: [10, 80, 30], url: 'file:///cache/secreto/abc123.m4a' });
    expect(heard.media?.thumbUrl).toBeUndefined();
    expect(read.media).toMatchObject({ mime: 'application/pdf', fileName: 'contrato.pdf', url: 'file:///cache/secreto/abc123.pdf' });
    expect(read.media?.thumbUrl).toBeUndefined();
  });

  it('still decrypting shows its shape and «opening» with no server address; a failure says so', () => {
    const opening = withOpenedText(sealedMessage, secretText, () => ({}));
    const failed = withOpenedText(sealedMessage, secretText, () => ({ failed: true }));
    expect(opening.media).toMatchObject({ sealed: 'opening', width: 1080, url: undefined, thumbUrl: undefined });
    expect(failed.media?.sealed).toBe('failed');
  });

  it('plain text stays text, a sealed text that does not open says so, and the secret of a file without the file never shows its key', () => {
    const asked: string[] = [];
    const fileOf = (url: string) => {
      asked.push(url);
      return {};
    };
    expect(withOpenedText<Shown>({ seq: 1 }, 'hola', fileOf).body).toBe('hola');
    expect(withOpenedText<Shown>({ seq: 2 }, null, fileOf).body).toBe(UNREADABLE);
    expect(withOpenedText<Shown>({ seq: 3 }, secretText, fileOf).body).toBe(UNREADABLE);
    expect(asked).toEqual([]);
  });
});

describe('openedFileName', () => {
  it('keeps the stored name and puts the extension the player needs', () => {
    expect(openedFileName('https://x/media/chats/c1/abc123.bin', 'video/mp4')).toBe('abc123.mp4');
    expect(openedFileName('https://x/media/a b/f.bin?t=1', 'image/png')).toBe('f.png');
    expect(openedFileName('https://x/media/z', 'video/x-matroska')).toBe('z.mp4');
    expect(openedFileName('', 'image/jpeg')).toBeNull();
    // Documents and voice notes (secret chat): the viewer and the player need their own extension.
    expect(openedFileName('https://x/media/d1.bin', 'application/pdf')).toBe('d1.pdf');
    expect(openedFileName('https://x/media/v1.bin', 'audio/mp4')).toBe('v1.m4a');
    expect(openedFileName('https://x/media/v2.bin', 'audio/ogg')).toBe('v2.ogg');
  });
});
