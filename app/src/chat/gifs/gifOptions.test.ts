import { afterEach, describe, expect, it, vi } from 'vitest';

const alert = vi.fn();
const toast = vi.fn();
vi.mock('react-native', () => ({ Alert: { alert }, ToastAndroid: { show: toast, SHORT: 0 } }));
const saveGifSticker = vi.fn(async () => 'Sticker animado guardado en Mis stickers');
vi.mock('../stickers/useStickers', () => ({ saveGifSticker }));

const { showGifOptions } = await import('./gifOptions');
type Button = { text: string; onPress?: () => void };

afterEach(() => vi.clearAllMocks());

/** José, 22/10: «si toco ese mensaje debería aparecerme la opción flotante para convertir ese gif en sticker». */
describe('showGifOptions', () => {
  it('a tap on a GIF offers to convert it and to see it big', () => {
    // Act
    showGifOptions({ jwt: 'jwt', chatId: 'c1', seq: 9, onOpen: vi.fn() });
    // Assert
    const buttons = alert.mock.calls[0]![2] as Button[];
    expect(buttons.map((button) => button.text)).toEqual(['Cancelar', 'Ver en grande', 'Convertir en sticker animado']);
  });

  it('«Convertir» turns that GIF into my sticker and says so once', async () => {
    showGifOptions({ jwt: 'jwt', chatId: 'c1', seq: 9, onOpen: vi.fn() });
    (alert.mock.calls[0]![2] as Button[]).find((button) => button.text.startsWith('Convertir'))!.onPress!();
    await vi.waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(saveGifSticker).toHaveBeenCalledWith('jwt', { chatId: 'c1', seq: 9 });
    expect(toast).toHaveBeenCalledWith('Sticker animado guardado en Mis stickers', 0);
  });

  it('«Ver en grande» opens the viewer', () => {
    const onOpen = vi.fn();
    showGifOptions({ jwt: 'jwt', chatId: 'c1', seq: 9, onOpen });
    (alert.mock.calls[0]![2] as Button[]).find((button) => button.text === 'Ver en grande')!.onPress!();
    expect(onOpen).toHaveBeenCalled();
  });
});
