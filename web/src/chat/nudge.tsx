import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Heart, Vibrate } from 'lucide-react';
import { formatClock, funArrivedInRow, funMessageToPlay, funNoticeText, highestSeq, shouldPlayFun, winkById, winkRowSound, type FunPlace, type FunToPlay, type Wink, type WinkId } from '@lilachat/shared';
import { WinkOverlay } from './WinkOverlay';
import { playWinkCues, playWinkSound, shakeWholeScreen, stopWinkSounds } from './winkSounds';

/** A wink in the chat list pops its row (`.wink-pop`). */
const POP_MS = 480;
const BUZZ_HZ = 140;
const BUZZ_S = 0.35;

/** A short low buzz with Web Audio: no file to download. */
function buzz(): void {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = BUZZ_HZ;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + BUZZ_S);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + BUZZ_S);
    oscillator.onended = () => void context.close();
  } catch {
    // Without Web Audio (or blocked until a click) the line in the chat still says it.
  }
}

/** «Ver otra vez» in a wink's line asks the open chat to play it again. */
type ReplayListener = (seq: number, wink: WinkId) => void;
const replayListeners = new Set<ReplayListener>();
export function replayWink(seq: number, wink: WinkId): void {
  replayListeners.forEach((listener) => listener(seq, wink));
}

const prefersReducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/**
 * Plays nudges and winks in the open chat (backlog 3, José 21/10): the one that
 * came while it was closed plays once when it opens (`afterSeq` = what I had
 * read, taken once when the chat opens), and each new one on arrival. In the
 * open chat it always plays, a muted one only without sound; «Ver otra vez»
 * plays it whole (`shouldPlayFun`).
 */
export function useFunPlayback(params: { messages: readonly { seq: number; kind?: string; senderId: string; wink?: string }[] | null; me: string; chatId: string; muted: boolean; afterSeq: number }): { overlay: ReactNode } {
  const [playing, setPlaying] = useState<{ seq: number; wink: Wink } | null>(null);
  const seen = useRef<{ chatId: string; seq: number } | null>(null);
  const cancelCues = useRef<() => void>(() => undefined);
  const { messages, me, chatId, muted, afterSeq } = params;
  // What I had read when THIS chat opened: marking it read later must not make its wink count as seen.
  const readAtOpen = useRef({ chatId, seq: afterSeq });
  if (readAtOpen.current.chatId !== chatId) readAtOpen.current = { chatId, seq: afterSeq };
  const play = useCallback(
    (fun: FunToPlay, place: FunPlace) => {
      const how = shouldPlayFun({ muted, reducedMotion: prefersReducedMotion(), place });
      if (fun.kind === 'zumbido') {
        if (how.sound) buzz();
        if (how.animate) shakeWholeScreen();
        return;
      }
      const wink = winkById(fun.wink);
      if (!wink) return;
      // A new wink replaces the one playing: its pending sounds and its music stop.
      cancelCues.current();
      stopWinkSounds();
      cancelCues.current = playWinkCues(wink, how);
      if (how.animate) setPlaying({ seq: fun.seq, wink });
    },
    [muted]
  );
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    if (seen.current?.chatId !== chatId) seen.current = { chatId, seq: readAtOpen.current.seq };
    const fun = funMessageToPlay(messages, me, seen.current.seq);
    seen.current.seq = Math.max(seen.current.seq, highestSeq(messages));
    if (fun) play(fun, 'chat');
  }, [messages, me, chatId, play]);
  useEffect(() => {
    const listener: ReplayListener = (seq, wink) => play({ seq, kind: 'guino', wink, mine: true }, 'replay');
    replayListeners.add(listener);
    return () => {
      replayListeners.delete(listener);
    };
  }, [play]);
  useEffect(
    () => () => {
      cancelCues.current();
      stopWinkSounds();
    },
    []
  );
  const stop = useCallback(() => {
    setPlaying(null);
    stopWinkSounds();
  }, []);
  return { overlay: <WinkOverlay play={playing} onDone={stop} /> };
}

/**
 * A nudge or wink to a chat that is NOT open (José, 21/10: a nudge moves the
 * whole screen, not only when that chat is open): a nudge
 * shakes the whole window and buzzes; a wink pops its row with its sound and
 * plays in full when that chat is opened. Not when muted.
 */
export function useFunInRow(chat: { muted?: boolean; lastMessage: { seq: number; kind?: string; senderId: string; wink?: string } | null }, me: string | undefined, open: boolean): string {
  const [effect, setEffect] = useState('');
  const lastSeq = useRef<number | undefined>(undefined);
  const { lastMessage, muted } = chat;
  useEffect(() => {
    const arrived = open || !me ? null : funArrivedInRow(lastSeq.current, lastMessage, me);
    lastSeq.current = lastMessage?.seq ?? lastSeq.current ?? 0;
    if (!arrived) return;
    const how = shouldPlayFun({ muted: muted === true, reducedMotion: prefersReducedMotion(), place: 'row' });
    if (how.sound) {
      if (arrived === 'zumbido') buzz();
      else playWinkSound(winkRowSound(winkById(lastMessage?.wink)));
    }
    if (!how.animate) return;
    if (arrived === 'zumbido') shakeWholeScreen();
    else setEffect('wink-pop');
  }, [lastMessage, me, open, muted]);
  useEffect(() => {
    if (!effect) return;
    const stop = setTimeout(() => setEffect(''), POP_MS);
    return () => clearTimeout(stop);
  }, [effect]);
  return effect;
}

/** «Ana te mandó un zumbido» / «Mandaste un zumbido», centered like the group notices. */
export function NudgeLine({ mine, author, at }: { mine: boolean; author?: string; at?: string }) {
  return (
    <div data-testid="linea-zumbido" className="my-1.5 flex justify-center">
      <span className="inline-flex max-w-[88%] flex-wrap items-center justify-center gap-x-2 gap-y-0.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[13px] font-semibold">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-on-primary"><Vibrate size={13} /></span>
        {mine ? 'Mandaste un zumbido' : author ? `${author} te mandó un zumbido` : 'Te mandaron un zumbido'}
        {at ? <span className="text-[11px] font-normal text-on-surface-variant">{formatClock(at)}</span> : null}
      </span>
    </div>
  );
}

/** «Ana te mandó un guiño · Corazones · Ver otra vez» (José, 21/10). */
export function WinkLine({ seq, wink, mine, author, at }: { seq: number; wink?: string; mine: boolean; author?: string; at?: string }) {
  const known = winkById(wink);
  return (
    <div data-testid={`linea-guino-${seq}`} className="my-1.5 flex justify-center">
      <span className="inline-flex max-w-[88%] flex-wrap items-center justify-center gap-x-2 gap-y-0.5 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-1 text-[13px] font-semibold">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-on-primary"><Heart size={13} /></span>
        {funNoticeText({ kind: 'guino', wink, mine, author })}
        {at ? <span className="text-[11px] font-normal text-on-surface-variant">{formatClock(at)}</span> : null}
        {known ? (
          <button type="button" data-testid={`ver-guino-${seq}`} onClick={() => replayWink(seq, known.id)} className="font-bold text-primary underline">
            Ver otra vez
          </button>
        ) : null}
      </span>
    </div>
  );
}
