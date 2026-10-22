import { useState } from 'react';
import { ImagePlay, Smile, Sparkles, Sticker } from 'lucide-react';
import type { WinkId } from '@lilachat/shared';
import { WinkPanel } from '../WinkPanel';
import { GifPanel } from '../gifs/GifPanel';
import { useGifsAvailable } from '../gifs/gifsApi';
import PanelDeEmojis from '../PanelDeEmojis';
import { StickerPanel } from './StickerPanel';
import { CreateStickerWeb } from './CreateStickerWeb';
import { useStickers } from './useStickers';
import type { StickerThread } from './stickersApi';
import { lastPanelTab, type PanelTab } from '@lilachat/shared';

/** `thread`: from a thread (20/10) the sticker goes to it; `onSent` lets the thread close its picker. */
export type StickerChat = { jwt: string; me: string; chatId: string; chatName: string; thread?: StickerThread; onSent?: () => void; replyToSeq?: number };

/**
 * The emoji button panel on the web (design `s1-web-stickers`): Emoji ·
 * Stickers tabs, like the app and WhatsApp Web. Without `chat` (a secret chat)
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
        <div role="tablist" className="mb-2 flex gap-4 border-b border-outline/10 px-1">
          {tabs.map(({ key, label, Icon }) => (
            <button key={key} type="button" role="tab" data-testid={`pestana-panel-${key}`} aria-selected={tab === key} onClick={() => setTab(key)} className={`flex min-h-[40px] items-center gap-1.5 border-b-2 text-sm ${tab === key ? 'border-primary font-semibold text-primary' : 'border-transparent text-on-surface-variant'}`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      ) : null}
      {tab === 'stickers' && chat ? <Stickers chat={chat} /> : tab === 'gifs' && chat ? <div className="h-80"><GifPanel jwt={chat.jwt} chatId={chat.chatId} /></div> : tab === 'winks' && winks ? <WinkPanel recipient={winks.recipient} onSend={winks.onSend} onNudge={winks.onNudge} /> : <PanelDeEmojis onElegir={onPickEmoji} />}
    </div>
  );
}

function Stickers({ chat }: { chat: StickerChat }) {
  const stickers = useStickers(chat.jwt, chat.me);
  const [creating, setCreating] = useState(false);
  return (
    <>
      <StickerPanel
        library={stickers.library}
        recents={stickers.recents}
        packs={stickers.packs}
        error={stickers.error}
        onSend={(sticker) => void stickers.send(chat.chatId, sticker, { ...chat.thread, replyToSeq: chat.replyToSeq }).then((sent) => sent && chat.onSent?.())}
        onCreate={() => setCreating(true)}
        onToggleFavorite={(sticker) => void stickers.toggleFavorite(sticker)}
        onRemove={(sticker) => void stickers.remove(sticker)}
      />
      {creating ? <CreateStickerWeb chatName={chat.chatName} onClose={() => setCreating(false)} onSave={stickers.save} onSend={(sticker) => stickers.send(chat.chatId, sticker, { ...chat.thread, replyToSeq: chat.replyToSeq })} onRemove={stickers.remove} /> : null}
    </>
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

