import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Heart, Vibrate } from 'lucide-react';
import { NUDGE_SHAKE, formatClock, funArrivedInRow, funMessageToPlay, funNoticeText, highestSeq, shouldPlayFun, winkById, type FunToPlay, type Wink, type WinkId, type WinkSound } from '@lilachat/shared';
import { WinkOverlay } from './WinkOverlay';

/** A wink in the chat list pops its row (`.wink-pop`). */
const POP_MS = 480;
const BUZZ_HZ = 140;
const BUZZ_S = 0.35;
const WINK_VOLUME = 0.7;

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

/** The wink's sound: the same files as the app (`public/sonidos`). Blocked autoplay just stays quiet. */
function playWinkSound(sound: WinkSound): void {
  const audio = new Audio(`${import.meta.env.BASE_URL}sonidos/wink-${sound}.wav`);
  audio.volume = WINK_VOLUME;
  void audio.play().catch(() => undefined);
}

/** «Ver otra vez» in a wink's line asks the open chat to play it again. */
type ReplayListener = (seq: number, wink: WinkId) => void;
const replayListeners = new Set<ReplayListener>();
export function replayWink(seq: number, wink: WinkId): void {
  replayListeners.forEach((listener) => listener(seq, wink));
}

const prefersReducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/**
 * The nudge shakes the WHOLE window sideways, wide enough to read as a shake
 * like MSN (José, 21/10: «se mezcla como si fuera un error de scroll»). The
 * same path as the app (`NUDGE_SHAKE`).
 */
function shakeWholeScreen(): void {
  const root = document.getElementById('root');
  root?.animate?.(
    NUDGE_SHAKE.path.map((x) => ({ transform: `translateX(${x * NUDGE_SHAKE.amplitude}px)` })),
    { duration: NUDGE_SHAKE.path.length * NUDGE_SHAKE.stepMs, easing: 'linear' }
  );
}

/**
 * Plays nudges and winks in the open chat (backlog 3, José 21/10): the one that
 * came while it was closed plays once when it opens (`afterSeq` = what I had
 * read), and each new one on arrival. A muted chat stays still and quiet; with
 * «reduce motion» it only sounds.
 */
export function useFunPlayback(params: { messages: readonly { seq: number; kind?: string; senderId: string; wink?: string }[] | null; me: string; chatId: string; muted: boolean; afterSeq: number }): { overlay: ReactNode } {
  const [playing, setPlaying] = useState<{ seq: number; wink: Wink } | null>(null);
  const seen = useRef<{ chatId: string; seq: number } | null>(null);
  const { messages, me, chatId, muted, afterSeq } = params;
  const play = useCallback(
    (fun: FunToPlay) => {
      const how = shouldPlayFun({ muted, reducedMotion: prefersReducedMotion() });
      if (fun.kind === 'zumbido') {
        if (how.sound) buzz();
        if (how.animate) shakeWholeScreen();
        return;
      }
      const wink = winkById(fun.wink);
      if (!wink) return;
      if (how.sound) playWinkSound(wink.sound);
      if (how.animate) setPlaying({ seq: fun.seq, wink });
    },
    [muted]
  );
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    if (seen.current?.chatId !== chatId) seen.current = { chatId, seq: afterSeq };
    const fun = funMessageToPlay(messages, me, seen.current.seq);
    seen.current.seq = Math.max(seen.current.seq, highestSeq(messages));
    if (fun) play(fun);
  }, [messages, me, chatId, afterSeq, play]);
  useEffect(() => {
    const listener: ReplayListener = (seq, wink) => play({ seq, kind: 'guino', wink, mine: true });
    replayListeners.add(listener);
    return () => {
      replayListeners.delete(listener);
    };
  }, [play]);
  const stop = useCallback(() => setPlaying(null), []);
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
    const how = shouldPlayFun({ muted: muted === true, reducedMotion: prefersReducedMotion() });
    if (how.sound) {
      if (arrived === 'zumbido') buzz();
      else playWinkSound(winkById(lastMessage?.wink)?.sound ?? 'pop');
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
