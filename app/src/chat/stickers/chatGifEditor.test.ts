import { afterEach, describe, expect, it, vi } from 'vitest';

const downloadAsync = vi.fn();
vi.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', downloadAsync }));
const reportError = vi.fn();
vi.mock('../../ui/reportarError', () => ({ reportarError: reportError }));
vi.mock('../../api/client', () => ({ BASE_URL: 'https://lilachat.test' }));

const { closeGifStickerEditor, openChatGifInEditor, openGiphyGifInEditor, pendingGifStickerForTest } = await import('./chatGifEditor');
const request = { jwt: 'jwt', chatId: 'c1', seq: 9, url: 'https://lilachat.test/media/a.gif' };

afterEach(() => {
  closeGifStickerEditor();
  vi.clearAllMocks();
});

/** José 26/11: «Convertir en sticker animado» opens the sound sticker editor with that GIF. */
describe('openChatGifInEditor', () => {
  it('downloads the GIF to the cache and opens the editor with it', async () => {
    // Arrange
    downloadAsync.mockResolvedValueOnce({ status: 200, uri: 'file:///cache/sticker-gif-c1-9.gif' });
    // Act
    const problem = await openChatGifInEditor(request);
    // Assert
    expect(problem).toBeNull();
    expect(downloadAsync).toHaveBeenCalledWith(request.url, 'file:///cache/sticker-gif-c1-9.gif');
    expect(pendingGifStickerForTest()).toEqual({ jwt: 'jwt', chatId: 'c1', gif: { uri: 'file:///cache/sticker-gif-c1-9.gif', name: 'sticker.gif', mime: 'image/gif' } });
  });

  it('says so when the server does not hand the GIF over, and opens nothing', async () => {
    downloadAsync.mockResolvedValueOnce({ status: 404, uri: 'file:///cache/x.gif' });
    await expect(openChatGifInEditor(request)).resolves.toBe('No se pudo descargar el GIF.');
    expect(pendingGifStickerForTest()).toBeNull();
  });

  it('says so without connection, and reports it', async () => {
    downloadAsync.mockRejectedValueOnce(new Error('offline'));
    await expect(openChatGifInEditor(request)).resolves.toBe('Sin conexión para descargar el GIF.');
    expect(reportError).toHaveBeenCalledWith('openChatGifInEditor', expect.any(Error));
    expect(pendingGifStickerForTest()).toBeNull();
  });

  it('never downloads a secret chat GIF', async () => {
    await expect(openChatGifInEditor({ ...request, url: 'file:///data/secret.gif' })).resolves.toBe('Un GIF de un chat secreto no se puede convertir en sticker.');
    expect(downloadAsync).not.toHaveBeenCalled();
  });

  it('closing the editor forgets the GIF', async () => {
    downloadAsync.mockResolvedValueOnce({ status: 200, uri: 'file:///cache/sticker-gif-c1-9.gif' });
    await openChatGifInEditor(request);
    closeGifStickerEditor();
    expect(pendingGifStickerForTest()).toBeNull();
  });
});

/** José 27/11 (design sa-04): from the GIF tab, a sticker with sound without sending the GIF first. */
describe('openGiphyGifInEditor', () => {
  it('brings the GIF through the server with the session and opens the editor for this chat', async () => {
    // Arrange
    downloadAsync.mockResolvedValueOnce({ status: 200, uri: 'file:///cache/sticker-giphy-abc123.gif' });
    // Act
    const problem = await openGiphyGifInEditor({ jwt: 'jwt', chatId: 'c1', gifId: 'abc123' });
    // Assert
    expect(problem).toBeNull();
    expect(downloadAsync).toHaveBeenCalledWith('https://lilachat.test/api/gifs/abc123/file', 'file:///cache/sticker-giphy-abc123.gif', { headers: { Authorization: 'Bearer jwt' } });
    expect(pendingGifStickerForTest()?.chatId).toBe('c1');
  });

  it('a GIF the server cannot give says so and opens nothing', async () => {
    downloadAsync.mockResolvedValueOnce({ status: 503, uri: '' });
    expect(await openGiphyGifInEditor({ jwt: 'jwt', chatId: 'c1', gifId: 'abc123' })).toBe('No se pudo traer ese GIF. Inténtalo de nuevo.');
    expect(pendingGifStickerForTest()).toBeNull();
    expect(await openGiphyGifInEditor({ jwt: 'jwt', chatId: 'c1', gifId: '../x' })).toBe('Ese GIF no se puede usar.');
  });
});
