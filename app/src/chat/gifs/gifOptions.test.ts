import { afterEach, describe, expect, it, vi } from 'vitest';

const alert = vi.fn();
const toast = vi.fn();
vi.mock('react-native', () => ({ Alert: { alert }, ToastAndroid: { show: toast, SHORT: 0 } }));
const openChatGifInEditor = vi.fn(async (): Promise<string | null> => null);
vi.mock('../stickers/chatGifEditor', () => ({ openChatGifInEditor }));

const { showGifOptions } = await import('./gifOptions');
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
