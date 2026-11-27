import { Alert, ToastAndroid } from 'react-native';
import { openChatGifInEditor, openGiphyGifInEditor } from '../stickers/chatGifEditor';

type ChatGif = { jwt: string; chatId: string; seq: number; url: string };

/** A chat's GIF opens the sticker editor, where a sound can be added (José 26/11); a failure is said, never thrown. */
export async function convertGifToSticker(gif: ChatGif): Promise<void> {
  const problem = await openChatGifInEditor(gif);
  if (problem) ToastAndroid.show(problem, ToastAndroid.SHORT);
}

/**
 * A tap on a GIF of the chat, mine or someone's (José, 22/10: the option has
 * to show up right on the message, floating): its options, like a sticker's.
 */
export function showGifOptions(params: ChatGif & { onOpen: () => void }): void {
  const { onOpen, ...gif } = params;
  Alert.alert('GIF', undefined, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Ver en grande', onPress: onOpen },
    { text: 'Convertir en sticker animado', onPress: () => void convertGifToSticker(gif) },
  ]);
}

type GiphyGif = { jwt: string; chatId: string; gifId: string };

/**
 * «+ Sonido» on a GIF of the GIF tab (José 27/11: «cuando lo toco se agrega de frente a los chats»): it opens the
 * sticker editor with that GIF, never sends it. `onBusy` gets the GIF being downloaded (null when done), so its tile
 * can say it is loading; a tap while one is opening does nothing. A failure is said, never thrown.
 */
export function createGiphySoundStickerOpener(onBusy: (gifId: string | null) => void) {
  let busy = false;
  return async (gif: GiphyGif): Promise<void> => {
    if (busy) return;
    busy = true;
    onBusy(gif.gifId);
    const problem = await openGiphyGifInEditor(gif);
    busy = false;
    onBusy(null);
    if (problem) ToastAndroid.show(problem, ToastAndroid.SHORT);
  };
}
