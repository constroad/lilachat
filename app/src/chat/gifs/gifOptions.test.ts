import { afterEach, describe, expect, it, vi } from 'vitest';

const alert = vi.fn();
const toast = vi.fn();
vi.mock('react-native', () => ({ Alert: { alert }, ToastAndroid: { show: toast, SHORT: 0 } }));
const openChatGifInEditor = vi.fn(async (): Promise<string | null> => null);
const openGiphyGifInEditor = vi.fn(async (): Promise<string | null> => null);
vi.mock('../stickers/chatGifEditor', () => ({ openChatGifInEditor, openGiphyGifInEditor }));

const { createGiphySoundStickerOpener, showGifOptions } = await import('./gifOptions');
type Button = { text: string; onPress?: () => void };
const gif = { jwt: 'jwt', chatId: 'c1', seq: 9, url: 'https://lilachat.test/media/a.gif' };

afterEach(() => vi.clearAllMocks());

const pressConvert = () => (alert.mock.calls[0]![2] as Button[]).find((button) => button.text.startsWith('Convertir'))!.onPress!();

/** José, 22/10: «si toco ese mensaje debería aparecerme la opción flotante para convertir ese gif en sticker». */
describe('showGifOptions', () => {
  it('a tap on a GIF offers to convert it and to see it big', () => {
    // Act
    showGifOptions({ ...gif, onOpen: vi.fn() });
    // Assert
    const buttons = alert.mock.calls[0]![2] as Button[];
    expect(buttons.map((button) => button.text)).toEqual(['Cancelar', 'Ver en grande', 'Convertir en sticker animado']);
  });

  it('«Convertir» opens the sticker editor with that GIF (José 26/11), quietly when it opens', async () => {
    showGifOptions({ ...gif, onOpen: vi.fn() });
    pressConvert();
    await vi.waitFor(() => expect(openChatGifInEditor).toHaveBeenCalledWith(gif));
    expect(toast).not.toHaveBeenCalled();
  });

  it('«Convertir» says why when the GIF could not be opened', async () => {
    openChatGifInEditor.mockResolvedValueOnce('No se pudo descargar el GIF.');
    showGifOptions({ ...gif, onOpen: vi.fn() });
    pressConvert();
    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith('No se pudo descargar el GIF.', 0));
  });

  it('«Ver en grande» opens the viewer', () => {
    const onOpen = vi.fn();
    showGifOptions({ ...gif, onOpen });
    (alert.mock.calls[0]![2] as Button[]).find((button) => button.text === 'Ver en grande')!.onPress!();
    expect(onOpen).toHaveBeenCalled();
  });
});

/** José 27/11: «cuando lo toco se agrega de frente a los chats». «+ Sonido» opens the editor, says it is loading, and never sends. */
describe('createGiphySoundStickerOpener', () => {
  const giphy = { jwt: 'jwt', chatId: 'c1', gifId: 'abc123' };

  it('marks the GIF as opening until the editor has it, then clears it', async () => {
    // Arrange
    const busy = vi.fn();
    const open = createGiphySoundStickerOpener(busy);
    // Act
    await open(giphy);
    // Assert
    expect(openGiphyGifInEditor).toHaveBeenCalledWith(giphy);
    expect(busy.mock.calls).toEqual([['abc123'], [null]]);
    expect(toast).not.toHaveBeenCalled();
  });

  it('a second tap while the first is still downloading does nothing', async () => {
    // Arrange: the first download is slow
    let finish: (value: string | null) => void = () => undefined;
    openGiphyGifInEditor.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const open = createGiphySoundStickerOpener(vi.fn());
    // Act
    const first = open(giphy);
    await open({ ...giphy, gifId: 'other' });
    finish(null);
    await first;
    // Assert
    expect(openGiphyGifInEditor).toHaveBeenCalledTimes(1);
  });

  it('says what failed, and lets the next tap try again', async () => {
    openGiphyGifInEditor.mockResolvedValueOnce('No se pudo traer ese GIF. Inténtalo de nuevo.');
    const open = createGiphySoundStickerOpener(vi.fn());
    await open(giphy);
    await open(giphy);
    expect(toast).toHaveBeenCalledWith('No se pudo traer ese GIF. Inténtalo de nuevo.', 0);
    expect(openGiphyGifInEditor).toHaveBeenCalledTimes(2);
  });
});
