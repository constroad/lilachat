import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Delete, Smile, Sticker } from 'lucide-react-native';
import { ALTO_DEL_PANEL_DE_EMOJIS, PanelDeEmojis } from '../PanelDeEmojis';
import { useColores } from '../../ui/tema';
import { reportarError } from '../../ui/reportarError';
import { subjectCutout } from '../../../modules/subject-cutout/src';
import { StickerPanel } from './StickerPanel';
import { CreateSticker } from './CreateSticker';
import { useStickers } from './useStickers';

type Tab = 'emoji' | 'stickers';

let modelRequested = false;
/** Opening «Stickers» already asks for the cutout model: by the time a photo is picked it is usually there. */
function prefetchCutoutModel() {
  if (modelRequested || !subjectCutout) return;
  modelRequested = true;
  subjectCutout.prepare().catch((error: unknown) => reportarError('EmojiStickerPanel.prefetch', error));
}

/**
 * The panel that replaces the keyboard (design `s1-app-panel-stickers`):
 * Emoji · Stickers tabs and the backspace key, like WhatsApp. It owns the
 * «Crear sticker» editor: the result goes to «Mis stickers» and to THIS chat.
 */
export function EmojiStickerPanel(props: { jwt: string; chatId: string; chatName: string; withStickers: boolean; onPickEmoji: (emoji: string) => void; onBackspace: () => void }) {
  const colors = useColores();
  const [tab, setTab] = useState<Tab>('emoji');
  const [creating, setCreating] = useState(false);
  const stickers = useStickers(props.jwt);
  const closeEditor = useCallback(() => setCreating(false), []);
  const tabs: { key: Tab; label: string; Icon: typeof Smile }[] = [
    { key: 'emoji', label: 'Emoji', Icon: Smile },
    ...(props.withStickers ? [{ key: 'stickers' as const, label: 'Stickers', Icon: Sticker }] : []),
  ];
  return (
    <View>
      <View className="flex-row items-center border-b border-outline/10">
        {tabs.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              testID={`pestana-panel-${key}`}
              onPress={() => {
                setTab(key);
                if (key === 'stickers') prefetchCutoutModel();
              }}
              className={`min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 border-b-2 ${active ? 'border-primary' : 'border-transparent'}`}
            >
              <Icon size={18} color={active ? colors.primary : colors['on-surface-variant']} />
              <Text className={`text-[14px] ${active ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}>{label}</Text>
            </Pressable>
          );
        })}
        <Pressable testID="btn-borrar-emoji" accessibilityLabel="Borrar" onPress={props.onBackspace} className="h-11 w-14 items-center justify-center">
          <Delete size={20} color={colors['on-surface-variant']} />
        </Pressable>
      </View>
      {tab === 'emoji' ? (
        <PanelDeEmojis onElegir={props.onPickEmoji} />
      ) : (
        <View style={{ height: ALTO_DEL_PANEL_DE_EMOJIS }}>
          <StickerPanel stickers={stickers} onSend={(sticker) => void stickers.send(props.chatId, sticker)} onCreate={() => setCreating(true)} />
        </View>
      )}
      <CreateSticker visible={creating} chatName={props.chatName} onClose={closeEditor} onSave={stickers.save} onSend={(sticker) => stickers.send(props.chatId, sticker)} />
    </View>
  );
}
