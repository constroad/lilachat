import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Smile, X } from 'lucide-react';
import { CALL_STICKER_MS, callReactionOf, winkById, type CallReaction } from '@lilachat/shared';
import { currentSocket } from '../useSocket';
import { WinkOverlay } from '../chat/WinkOverlay';
import { WinkPanel } from '../chat/WinkPanel';
import { STICKER_PACK_SECTIONS } from '../chat/stickers/useStickers';

type Played = { reaction: CallReaction; key: number };
const FADE_SHARE = 0.12;

/** Winks and stickers in a call (pending 98): the other's arrive by socket, mine play here too. The APK's `useCall` does the same. */
export function useCallReactions(chatId: string | null) {
  const [played, setPlayed] = useState<Played | null>(null);
  useEffect(() => {
    const socket = currentSocket();
    if (!socket || !chatId) return;
    const onReaction = (frame: { chatId?: string; reaction?: unknown }) => {
      const reaction = frame.chatId === chatId ? callReactionOf(frame.reaction) : null;
      if (reaction) setPlayed({ reaction, key: Date.now() });
    };
    socket.on('call.reaction', onReaction);
    return () => {
      socket.off('call.reaction', onReaction);
    };
  }, [chatId]);
  const send = useCallback((reaction: CallReaction) => {
    if (!chatId) return;
    currentSocket()?.emit('call.reaction', { chatId, reaction });
    setPlayed({ reaction, key: Date.now() });
  }, [chatId]);
  const clear = useCallback(() => setPlayed(null), []);
  return { played, send, clear };
}

export function CallReactionPicker(props: { peerName: string; onSend: (reaction: CallReaction) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'winks' | 'stickers'>('winks');
  const send = (reaction: CallReaction) => {
    props.onSend(reaction);
    setOpen(false);
  };
  return (
    <div className="relative">
      <button type="button" data-testid="btn-reacciones-llamada" aria-label="Guiños y stickers" aria-expanded={open} onClick={() => setOpen((was) => !was)} className="grid h-11 w-11 place-items-center rounded-full border border-outline/20 bg-surface/85 hover:bg-background"><Smile size={20} /></button>
      {open ? (
        <div data-testid="hoja-reacciones-llamada" className="absolute bottom-14 left-0 z-10 flex max-h-[360px] w-[min(400px,calc(100vw-48px))] flex-col overflow-hidden rounded-2xl border border-outline/15 bg-surface shadow-2xl">
          <div className="flex items-center gap-2 border-b border-outline/10 px-3 py-2">
            {(['winks', 'stickers'] as const).map((key) => (
              <button key={key} type="button" data-testid={`reacciones-${key === 'winks' ? 'guinos' : 'stickers'}`} aria-pressed={tab === key} onClick={() => setTab(key)} className={`rounded-full px-3 py-1 text-[13px] font-semibold ${tab === key ? 'bg-primary/10 text-primary' : 'text-on-surface-variant'}`}>{key === 'winks' ? 'Guiños' : 'Stickers'}</button>
            ))}
            <span className="flex-1" />
            <button type="button" aria-label="Cerrar" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-background"><X size={16} /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {tab === 'winks' ? <WinkPanel recipient={props.peerName} onSend={(id) => send({ kind: 'wink', id })} /> : STICKER_PACK_SECTIONS.map((pack) => (
              <div key={pack.id} className="mb-2">
                <p className="mb-1 px-1 text-[12px] font-semibold text-on-surface-variant">{pack.title}</p>
                <div className="grid grid-cols-5 gap-1">
                  {pack.stickers.map((sticker) => (
                    <button key={sticker.id} type="button" data-testid={`sticker-llamada-${sticker.id}`} aria-label="Mandar sticker" onClick={() => send({ kind: 'sticker', id: sticker.id })} className="rounded-lg p-1 hover:bg-background"><img src={sticker.url} alt="" className="aspect-square w-full object-contain" loading="lazy" /></button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** What plays over the call window: a wink with its choreography, or a sticker that rises and fades. */
export function CallReactionOverlay({ played, onDone }: { played: Played | null; onDone: () => void }) {
  const wink = played?.reaction.kind === 'wink' ? winkById(played.reaction.id) : undefined;
  const winkPlay = useMemo(() => (played && wink ? { seq: played.key, wink } : null), [played, wink]);
  if (!played) return null;
  if (played.reaction.kind === 'wink') return <WinkOverlay play={winkPlay} onDone={onDone} />;
  return <FloatingSticker key={played.key} id={played.reaction.id} onDone={onDone} />;
}

function FloatingSticker({ id, onDone }: { id: string; onDone: () => void }) {
  const url = STICKER_PACK_SECTIONS.flatMap((pack) => pack.stickers).find((sticker) => sticker.id === id)?.url;
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    image.current?.animate?.(
      [{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, offset: FADE_SHARE }, { opacity: 1, offset: 1 - FADE_SHARE }, { opacity: 0, transform: 'translateY(-40px)' }],
      { duration: CALL_STICKER_MS, easing: 'ease-out', fill: 'forwards' }
    );
    const timer = setTimeout(onDone, CALL_STICKER_MS);
    return () => clearTimeout(timer);
  }, [onDone]);
  if (!url) return null;
  return (
    <div data-testid={`sticker-en-llamada-${id}`} className="pointer-events-none absolute inset-0 z-20 grid place-items-center" aria-hidden="true">
      <img ref={image} src={url} alt="" className="h-44 w-44 object-contain" />
    </div>
  );
}
