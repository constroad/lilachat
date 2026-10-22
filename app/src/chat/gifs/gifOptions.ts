import { Alert, ToastAndroid } from 'react-native';
import { saveGifSticker } from '../stickers/useStickers';

/** Turns a chat's GIF into my animated sticker and says how it went (pending 37). */
export async function convertGifToSticker(jwt: string, chatId: string, seq: number): Promise<void> {
  // One notice, with the result: a «converting…» one first made Android queue it and the answer came 2 s later.
  ToastAndroid.show(await saveGifSticker(jwt, { chatId, seq }), ToastAndroid.SHORT);
}

/**
 * A tap on a GIF of the chat, mine or someone's (José, 22/10: «si toco ese
 * mensaje debería aparecerme la opción flotante para convertir ese gif en
 * sticker»): the floating options, like a sticker's.
 */
export function showGifOptions(params: { jwt: string; chatId: string; seq: number; onOpen: () => void }): void {
  Alert.alert('GIF', undefined, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Ver en grande', onPress: params.onOpen },
    { text: 'Convertir en sticker animado', onPress: () => void convertGifToSticker(params.jwt, params.chatId, params.seq) },
  ]);
}
