import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Delete, ImagePlay, Smile, Sparkles, Sticker } from 'lucide-react-native';
import { lastPanelTab, type PanelTab, type WinkId } from '@lilachat/shared';
import { storePanelTab, useStoredPanelTab } from '../../ui/panelTabPref';
import { WinkPanel } from '../WinkPanel';
import { GifPanel } from '../gifs/GifPanel';
import { useGifsAvailable } from '../gifs/gifsApi';

import { PanelDeEmojis } from '../PanelDeEmojis';
import { useColores } from '../../ui/tema';
import { reportarError } from '../../ui/reportarError';
import { subjectCutout } from '../../../modules/subject-cutout/src';
import { StickerPanel } from './StickerPanel';
import { CreateSticker } from './CreateSticker';
import { useStickers } from './useStickers';
import type { StickerThread } from './stickersApi';


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
export function EmojiStickerPanel(props: {
  jwt: string;
  chatId: string;
  chatName: string;
  withStickers: boolean;
  onPickEmoji: (emoji: string) => void;
  onBackspace: () => void;
  /** From a thread (20/10): the stickers go to it; `onStickerSent` lets the thread close its sheet. */
  thread?: StickerThread;
  onStickerSent?: () => void;
  /** The message being replied to when the sticker is tapped: it quotes it (20/10). */
  replyTo?: () => number | undefined;
  /** Winks (José, 21/10): the «Guiños» tab, where nudges and winks are allowed; the nudge lives on top of it. */
  onWink?: (wink: WinkId) => void;
  onNudge?: () => void;
}) {
  const colors = useColores();
  const { onWink } = props;
  const [creating, setCreating] = useState(false);
  /** A new editor each time (its layers and brushes do not leak into the next sticker); it stays mounted to slide out. */
  const [editorSession, setEditorSession] = useState(0);
  const stickers = useStickers(props.jwt);
  // GIPHY only when the server has its key (backlog 37); never in a secret chat.
  const gifs = useGifsAvailable(props.jwt) && props.withStickers;
  const closeEditor = useCallback(() => setCreating(false), []);
  const tabs: { key: PanelTab; label: string; Icon: typeof Smile }[] = [
    { key: 'emoji', label: 'Emoji', Icon: Smile },
    ...(props.withStickers ? [{ key: 'stickers' as const, label: 'Stickers', Icon: Sticker }] : []),
    ...(gifs ? [{ key: 'gifs' as const, label: 'GIF', Icon: ImagePlay }] : []),
    ...(onWink ? [{ key: 'winks' as const, label: 'Guiños', Icon: Sparkles }] : []),
  ];
  // It opens on the tab used last (José, 21/10), if this chat offers it.
  const tab = lastPanelTab(useStoredPanelTab(), tabs.map((one) => one.key));
  const setTab = storePanelTab;
  // Opening straight on «Stickers» asks for the cutout model too.
  useEffect(() => {
    if (tab === 'stickers') prefetchCutoutModel();
  }, [tab]);
  return (
    <View style={{ flex: 1 }}>
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
      ) : tab === 'gifs' ? (
        <GifPanel jwt={props.jwt} chatId={props.chatId} />
      ) : tab === 'winks' && onWink ? (
        <WinkPanel recipient={props.chatName} onSend={onWink} onNudge={props.onNudge} />
      ) : (
        <View style={{ flex: 1 }}>
          <StickerPanel stickers={stickers} onSend={(sticker) => void stickers.send(props.chatId, sticker, { ...props.thread, replyToSeq: props.replyTo?.() }).then((sent) => sent && props.onStickerSent?.())} onCreate={() => { setEditorSession((before) => before + 1); setCreating(true); }} />
        </View>
      )}
      <CreateSticker key={editorSession} visible={creating} chatName={props.chatName} onClose={closeEditor} onSave={stickers.save} onSend={(sticker) => stickers.send(props.chatId, sticker, { ...props.thread, replyToSeq: props.replyTo?.() })} />
    </View>
  );
}
