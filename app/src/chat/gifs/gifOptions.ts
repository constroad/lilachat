import { Alert, ToastAndroid } from 'react-native';
import { openChatGifInEditor } from '../stickers/chatGifEditor';

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
