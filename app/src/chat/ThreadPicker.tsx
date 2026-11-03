import { View } from 'react-native';
import { Sheet } from '../ui/Sheet';
import { EmojiStickerPanel } from './stickers/EmojiStickerPanel';

/** Height of the sheet (dp): the tabs and a keyboard-sized grid. */
const SHEET_HEIGHT = 380;

/**
 * Emojis and stickers inside a thread (José, 20/10: «in a thread I can't send
 * a sticker»), like Slack's picker: a sheet over the thread, so nothing in it
 * moves. An emoji goes into the text and the sheet closes; a sticker is sent
 * to the thread (and to the chat if «También enviar al chat» is on).
 */
export function ThreadPicker(props: {
  visible: boolean;
  jwt: string;
  chatId: string;
  chatName: string;
  root: number;
  alsoInChat: boolean;
  onEmoji: (emoji: string) => void;
  onBackspace: () => void;
  onStickerSent: () => void;
  onClose: () => void;
}) {
  return (
    // Only the handle drags: the grid inside scrolls.
    <Sheet visible={props.visible} onClose={props.onClose} testID="selector-hilo" dragArea="handle" bottomRoom={0}>
      <View style={{ height: SHEET_HEIGHT }}>
        <EmojiStickerPanel
          jwt={props.jwt}
          chatId={props.chatId}
          chatName={props.chatName}
          withStickers
          onPickEmoji={props.onEmoji}
          onBackspace={props.onBackspace}
          thread={{ hiloDe: props.root, enElChat: props.alsoInChat }}
          onStickerSent={props.onStickerSent}
        />
      </View>
    </Sheet>
  );
}
