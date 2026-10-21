import { Pressable, View } from 'react-native';
import { Modal } from '../ui/Modal';
import { useMargenes } from '../ui/useMargenes';
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
  const margins = useMargenes();
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable testID="cerrar-selector-hilo" accessibilityLabel="Cerrar" onPress={props.onClose} className="flex-1 bg-black/30" />
      <View testID="selector-hilo" className="rounded-t-2xl bg-surface" style={{ height: SHEET_HEIGHT + margins.pie, paddingBottom: margins.pie }}>
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
    </Modal>
  );
}
