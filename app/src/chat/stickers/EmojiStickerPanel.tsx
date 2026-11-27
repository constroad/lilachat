import { memo, useCallback, useEffect, useState } from 'react';
import { Pressable, Text, ToastAndroid, View } from 'react-native';
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
import { CreateVideoSticker } from './CreateVideoSticker';
import { pickStickerSource, type GalleryVideo, type PickedPhoto } from './pickStickerSource';
import { useStickers } from './useStickers';
import { useSavedStickerSheets } from './useSavedStickerSheets';
import { StickerPhotoContext } from './useStickerCutout';
import type { StickerThread } from './stickersApi';


let modelRequested = false;
/** Opening «Stickers» already asks for the cutout model: by the time a photo is picked it is usually there. */
function prefetchCutoutModel() {
  if (modelRequested || !subjectCutout) return;
  modelRequested = true;
  subjectCutout.prepare().catch((error: unknown) => reportarError('EmojiStickerPanel.prefetch', error));
}

type PanelTabItem = { key: PanelTab; label: string; Icon: typeof Smile };

/** Icons only, in one capsule, like WhatsApp (pending 59): the label stays for TalkBack. */
function PanelTabBar(props: { tabs: readonly PanelTabItem[]; active: PanelTab; onTab: (key: PanelTab) => void; onBackspace: () => void }) {
  const colors = useColores();
  return (
    <View className="flex-row items-center gap-2 border-b border-outline/10 py-1.5 pl-3">
      <View className="h-10 flex-1 flex-row overflow-hidden rounded-full border border-outline/20">
        {props.tabs.map(({ key, label, Icon }) => {
          const active = props.active === key;
          const tint = active ? colors.primary : colors['on-surface-variant'];
          return (
            <Pressable key={key} testID={`pestana-panel-${key}`} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={() => props.onTab(key)} className={`flex-1 items-center justify-center ${active ? 'bg-primary/15' : ''}`}>
              {key === 'gifs' ? (
                <View className="rounded border-[1.5px] px-1" style={{ borderColor: tint }}>
                  <Text style={{ color: tint }} className="text-[10px] font-extrabold tracking-wider">GIF</Text>
                </View>
              ) : (
                <Icon size={20} color={tint} />
              )}
            </Pressable>
          );
        })}
      </View>
      <Pressable testID="btn-borrar-emoji" accessibilityLabel="Borrar" onPress={props.onBackspace} className="h-11 w-12 items-center justify-center">
        <Delete size={20} color={colors['on-surface-variant']} />
      </Pressable>
    </View>
  );
}

/**
 * The panel that replaces the keyboard (design `s1-app-panel-stickers`):
 * Emoji · Stickers · GIF · Guiños tabs (icons only) and the backspace key, like WhatsApp. It owns the
 * «Crear sticker» editor: the result goes to «Mis stickers» and to THIS chat.
 */
export const EmojiStickerPanel = memo(function EmojiStickerPanel(props: {
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
  onWink?: (wink: WinkId, replyToSeq?: number) => void;
  onNudge?: () => void;
}) {
  const { onWink } = props;
  const [creating, setCreating] = useState(false);
  /** A new editor each time (its layers and brushes do not leak into the next sticker); it stays mounted to slide out. */
  const [editorSession, setEditorSession] = useState(0);
  const stickers = useStickers(props.jwt);
  const saved = useSavedStickerSheets(props.jwt, stickers);
  // GIPHY only when the server has its key (backlog 37); never in a secret chat.
  const gifs = useGifsAvailable(props.jwt) && props.withStickers;
  const closeEditor = useCallback(() => setCreating(false), []);
  /** «Crear» (José 26/11, design sc-01a): a photo opens the cutout editor; a video or a GIF, the one with sound. */
  const [photoForSticker, setPhotoForSticker] = useState<PickedPhoto | null>(null);
  const [videoForSticker, setVideoForSticker] = useState<GalleryVideo | null>(null);
  const create = useCallback(async () => {
    const picked = await pickStickerSource();
    if (!picked) return;
    if ('refusal' in picked) return ToastAndroid.show(picked.refusal, ToastAndroid.SHORT);
    if (picked.kind === 'clip') return setVideoForSticker(picked.clip);
    setPhotoForSticker(picked.photo);
    setEditorSession((before) => before + 1);
    setCreating(true);
  }, []);
  const tabs: PanelTabItem[] = [
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
      <PanelTabBar
        tabs={tabs}
        active={tab}
        onTab={(key) => {
          setTab(key);
          if (key === 'stickers') prefetchCutoutModel();
        }}
        onBackspace={props.onBackspace}
      />
      {tab === 'emoji' ? (
        <PanelDeEmojis onElegir={props.onPickEmoji} />
      ) : tab === 'gifs' ? (
        <GifPanel jwt={props.jwt} chatId={props.chatId} target={() => ({ ...props.thread, replyToSeq: props.replyTo?.() })} onSent={props.onStickerSent} />
      ) : tab === 'winks' && onWink ? (
        <WinkPanel recipient={props.chatName} onSend={(wink) => { onWink(wink, props.replyTo?.()); props.onStickerSent?.(); }} onNudge={props.onNudge} />
      ) : (
        <View style={{ flex: 1 }}>
          <StickerPanel stickers={stickers} onSend={(sticker) => void stickers.send(props.chatId, sticker, { ...props.thread, replyToSeq: props.replyTo?.() }).then((sent) => sent && props.onStickerSent?.())} onCreate={() => void create()} onOptions={saved.onOptions} />
        </View>
      )}
      {saved.sheets}
      {videoForSticker ? (
        <CreateVideoSticker key={videoForSticker.uri} visible video={videoForSticker} onClose={() => setVideoForSticker(null)} onSave={stickers.saveFromVideo} onSend={(sticker) => stickers.send(props.chatId, sticker, { ...props.thread, replyToSeq: props.replyTo?.() })} />
      ) : null}
      <StickerPhotoContext.Provider value={photoForSticker}>
        <CreateSticker key={editorSession} visible={creating} chatName={props.chatName} onClose={closeEditor} onSave={stickers.save} onSend={(sticker) => stickers.send(props.chatId, sticker, { ...props.thread, replyToSeq: props.replyTo?.() })} />
      </StickerPhotoContext.Provider>
    </View>
  );
});
