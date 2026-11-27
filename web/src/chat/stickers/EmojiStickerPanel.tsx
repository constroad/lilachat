import { useState } from 'react';
import { ImagePlay, Smile, Sparkles, Sticker } from 'lucide-react';
import type { GifResult, LibrarySticker, WinkId } from '@lilachat/shared';
import { WinkPanel } from '../WinkPanel';
import { GifPanel } from '../gifs/GifPanel';
import { useGifsAvailable } from '../gifs/gifsApi';
import PanelDeEmojis from '../PanelDeEmojis';
import { StickerPanel } from './StickerPanel';
import { CreateStickerWeb } from './CreateStickerWeb';
import { CreateStickerFromVideo } from './CreateStickerFromVideo';
import { useStickers } from './useStickers';
import { StickerSoundDialog } from './StickerSoundDialog';
import { StickerExportDialog } from './StickerExportDialog';
import { stickerSourceOf, type StickerSource } from './videoSticker';
import { giphyGifFile, stickerVideoFile, type StickerThread } from './stickersApi';
import { lastPanelTab, type PanelTab } from '@lilachat/shared';

/** `thread`: from a thread (20/10) the sticker goes to it; `onSent` lets the thread close its picker. */
export type StickerChat = { jwt: string; me: string; chatId: string; chatName: string; thread?: StickerThread; onSent?: () => void; replyToSeq?: number };

/**
 * The emoji button panel on the web (design `s1-web-stickers`): Emoji ·
 * Stickers · GIF · Guiños tabs (icons only), like the app and WhatsApp Web. Without `chat` (a secret chat)
 * only Emoji is left. Loaded when opened (`lazy` in the Composer).
 */
export default function EmojiStickerPanel({ onPickEmoji, chat, winks }: { onPickEmoji: (emoji: string) => void; chat?: StickerChat; winks?: { recipient: string; onSend: (wink: WinkId) => void; onNudge?: () => void } }) {
  // GIPHY only when the server has its key (backlog 37); never in a secret chat (no `chat`).
  const gifs = useGifsAvailable(chat?.jwt) && Boolean(chat);
  const tabs: { key: PanelTab; label: string; Icon: typeof Smile }[] = [
    { key: 'emoji', label: 'Emoji', Icon: Smile },
    ...(chat ? [{ key: 'stickers' as const, label: 'Stickers', Icon: Sticker }] : []),
    ...(gifs ? [{ key: 'gifs' as const, label: 'GIF', Icon: ImagePlay }] : []),
    ...(winks ? [{ key: 'winks' as const, label: 'Guiños', Icon: Sparkles }] : []),
  ];
  // It opens on the tab used last (José, 21/10), if this chat offers it.
  const [tab, setTabState] = useState<PanelTab>(() => lastPanelTab(readStoredTab(), tabs.map((one) => one.key)));
  const setTab = (next: PanelTab) => {
    setTabState(next);
    storeTab(next);
  };
  return (
    <div className="rounded-xl border border-outline/15 bg-surface p-2">
      {tabs.length > 1 ? (
        // Icons only, in one capsule, like the app and WhatsApp (pending 59); the name stays as tooltip and for readers.
        <div role="tablist" className="mb-2 flex h-10 overflow-hidden rounded-full border border-outline/20">
          {tabs.map(({ key, label, Icon }) => (
            <button key={key} type="button" role="tab" title={label} aria-label={label} data-testid={`pestana-panel-${key}`} aria-selected={tab === key} onClick={() => setTab(key)} className={`flex flex-1 items-center justify-center ${tab === key ? 'bg-primary/15 text-primary' : 'text-on-surface-variant hover:bg-background'}`}>
              {key === 'gifs' ? <span className="rounded border-[1.5px] border-current px-1 text-[10px] font-extrabold tracking-wider">GIF</span> : <Icon size={18} />}
            </button>
          ))}
        </div>
      ) : null}
      {tab === 'stickers' && chat ? <Stickers chat={chat} /> : tab === 'gifs' && chat ? <Gifs chat={chat} /> : tab === 'winks' && winks ? <WinkPanel recipient={winks.recipient} onSend={winks.onSend} onNudge={winks.onNudge} /> : <PanelDeEmojis onElegir={onPickEmoji} />}
    </div>
  );
}

/** What «Crear» opened: the photo editor or the clip one (video or GIF), with the chosen file. */
type Creating = { source: StickerSource; file: File };

function Stickers({ chat }: { chat: StickerChat }) {
  const stickers = useStickers(chat.jwt, chat.me);
  const [creating, setCreating] = useState<Creating | null>(null);
  const [notice, setNotice] = useState('');
  const [soundFor, setSoundFor] = useState<LibrarySticker | null>(null);
  const [exportFor, setExportFor] = useState<LibrarySticker | null>(null);
  const target = { ...chat.thread, replyToSeq: chat.replyToSeq };
  const create = (file: File) => {
    const source = stickerSourceOf(file);
    setNotice(source ? '' : 'Elige una foto, un video o un GIF.');
    if (source) setCreating({ source, file });
  };
  const close = () => setCreating(null);
  return (
    <>
      <StickerPanel
        library={stickers.library}
        recents={stickers.recents}
        packs={stickers.packs}
        error={notice || stickers.error}
        onSend={(sticker) => void stickers.send(chat.chatId, sticker, target).then((sent) => sent && chat.onSent?.())}
        onCreate={create}
        onToggleFavorite={(sticker) => void stickers.toggleFavorite(sticker)}
        onRemove={(sticker) => void stickers.remove(sticker)}
        onSound={setSoundFor}
        onRemoveSound={(sticker) => void stickers.setSound(sticker, { sound: { kind: 'none' }, audio: null }).then((done) => !done.ok && setNotice(done.message))}
        onExport={setExportFor}
      />
      {soundFor ? <StickerSoundDialog sticker={soundFor} onSave={stickers.setSound} voiceDoor={stickers.voiceDoor} onClose={() => setSoundFor(null)} /> : null}
      {exportFor ? <StickerExportDialog sticker={exportFor} makeVideo={() => stickerVideoFile(chat.jwt, exportFor.id)} onClose={() => setExportFor(null)} /> : null}
      {creating?.source === 'clip' ? <CreateStickerFromVideo chatName={chat.chatName} initialClip={creating.file} onClose={close} onSave={stickers.saveVideo} voiceDoor={stickers.voiceDoor} onSend={(sticker) => stickers.send(chat.chatId, sticker, target)} /> : null}
      {creating?.source === 'photo' ? <CreateStickerWeb chatName={chat.chatName} initialPhoto={creating.file} onClose={close} onSave={stickers.save} onSend={(sticker) => stickers.send(chat.chatId, sticker, target)} onRemove={stickers.remove} /> : null}
    </>
  );
}

/**
 * The GIF tab (José 27/11, design sa-04): a click sends the GIF as always; its «Sticker con sonido» opens the clip
 * editor with that GIF, without sending it first.
 */
function Gifs({ chat }: { chat: StickerChat }) {
  const stickers = useStickers(chat.jwt, chat.me);
  const [clip, setClip] = useState<File | null>(null);
  const [notice, setNotice] = useState('');
  const target = { ...chat.thread, replyToSeq: chat.replyToSeq };
  const openEditor = async (gif: GifResult) => {
    setNotice('');
    const fetched = await giphyGifFile(chat.jwt, gif.id);
    if (fetched.ok) setClip(fetched.file);
    else setNotice(fetched.message);
  };
  return (
    <div className="h-80">
      <GifPanel jwt={chat.jwt} chatId={chat.chatId} target={target} onSent={chat.onSent} onSoundSticker={(gif) => void openEditor(gif)} notice={notice} />
      {clip ? <CreateStickerFromVideo chatName={chat.chatName} initialClip={clip} onClose={() => setClip(null)} onSave={stickers.saveVideo} voiceDoor={stickers.voiceDoor} onSend={(sticker) => stickers.send(chat.chatId, sticker, target)} /> : null}
    </div>
  );
}

const PANEL_TAB_KEY = 'lilachat.panel.pestana';

function readStoredTab(): string | null {
  try {
    return window.localStorage.getItem(PANEL_TAB_KEY);
  } catch {
    return null;
  }
}

function storeTab(tab: PanelTab): void {
  try {
    window.localStorage.setItem(PANEL_TAB_KEY, tab);
  } catch (error) {
    console.warn('[panel] no se pudo recordar la pestaña:', error instanceof Error ? error.message : error);
  }
}

