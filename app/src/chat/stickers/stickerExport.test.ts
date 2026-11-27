import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', downloadAsync: vi.fn(), deleteAsync: vi.fn(async () => undefined) }));
vi.mock('expo-media-library/legacy', () => ({ requestPermissionsAsync: vi.fn(), saveToLibraryAsync: vi.fn() }));
vi.mock('expo-sharing', () => ({ isAvailableAsync: vi.fn(), shareAsync: vi.fn() }));
vi.mock('../../api/client', () => ({ BASE_URL: 'https://lilachat.test' }));

const { stickerExportFileName, saveStickerVideo, shareStickerPicture } = await import('./stickerExport');
const FileSystem = await import('expo-file-system/legacy');
const MediaLibrary = await import('expo-media-library/legacy');
const Sharing = await import('expo-sharing');

/** José 27/11: «exportarlo para usarlo en WhatsApp» (design sa-05). */
describe('stickerExportFileName', () => {
  it('one name per sticker and kind, safe for the disk', () => {
    expect(stickerExportFileName('6739f0c2a1b2c3d4e5f60799', 'video')).toBe('sticker-lilachat-6739f0c2a1b2c3d4e5f60799.mp4');
    expect(stickerExportFileName('pack:lila-1/dog', 'picture')).toBe('sticker-lilachat-pack_lila-1_dog.webp');
    expect(stickerExportFileName('a1', 'picture', 'image/png')).toBe('sticker-lilachat-a1.png');
  });
});

describe('saveStickerVideo', () => {
  it('asks write-only permission, downloads with the session and keeps it in the gallery', async () => {
    // Arrange
    vi.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValue({ granted: true } as never);
    vi.mocked(FileSystem.downloadAsync).mockResolvedValue({ status: 200, uri: 'file:///cache/v.mp4' } as never);
    // Act
    const saved = await saveStickerVideo('jwt', 's1');
    // Assert
    expect(saved).toEqual({ ok: true });
    expect(MediaLibrary.requestPermissionsAsync).toHaveBeenCalledWith(true);
    expect(FileSystem.downloadAsync).toHaveBeenCalledWith('https://lilachat.test/api/stickers/s1/export.mp4', 'file:///cache/sticker-lilachat-s1.mp4', { headers: { Authorization: 'Bearer jwt' } });
    expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledWith('file:///cache/v.mp4');
    expect(FileSystem.deleteAsync).toHaveBeenCalled();
  });

  it('without permission or with a refused download it says why', async () => {
    vi.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValue({ granted: false } as never);
    expect(await saveStickerVideo('jwt', 's1')).toEqual({ ok: false, reason: 'Necesitamos permiso para guardar en tu galería.' });
    vi.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValue({ granted: true } as never);
    vi.mocked(FileSystem.downloadAsync).mockResolvedValue({ status: 503, uri: '' } as never);
    expect(await saveStickerVideo('jwt', 's1')).toEqual({ ok: false, reason: 'No se pudo preparar el archivo. Inténtalo de nuevo.' });
  });
});

describe('shareStickerPicture', () => {
  it('shares the picture with its own type', async () => {
    vi.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
    vi.mocked(FileSystem.downloadAsync).mockResolvedValue({ status: 200, uri: 'file:///cache/p.webp' } as never);
    expect(await shareStickerPicture({ id: 's1', url: 'https://x/s1.webp', mime: 'image/webp' })).toEqual({ ok: true });
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/p.webp', { mimeType: 'image/webp' });
  });
});
