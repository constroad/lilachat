import { useEffect, useRef, useState } from 'react';
import { Vibrate } from 'lucide-react';
import { highestSeq, nudgeToShake } from '@lilachat/shared';

/** How long the panel shakes (spec, backlog 3: about 600 ms). */
const SHAKE_MS = 600;
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

/**
 * Shakes the open chat when the other person's nudge arrives (backlog 3); never
 * for what was already there. With «reduce motion» it only buzzes.
 */
export function useNudgeShake(messages: readonly { seq: number; kind?: string; senderId: string }[] | null, me: string): boolean {
  const [shaking, setShaking] = useState(false);
  const seen = useRef<number | null>(null);
  useEffect(() => {
    if (!messages) return;
    if (seen.current === null) {
      seen.current = highestSeq(messages);
      return;
    }
    const nudge = nudgeToShake(messages, me, seen.current);
    seen.current = Math.max(seen.current, highestSeq(messages));
    if (nudge === null) return;
    buzz();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    setShaking(true);
    const stop = setTimeout(() => setShaking(false), SHAKE_MS);
    return () => clearTimeout(stop);
  }, [messages, me]);
  return shaking;
}

/** «Ana te mandó un zumbido» / «Mandaste un zumbido», centered like the group notices. */
export function NudgeLine({ mine, author }: { mine: boolean; author?: string }) {
  return (
    <div data-testid="linea-zumbido" className="my-1.5 flex justify-center">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[13px] font-semibold text-primary">
        <Vibrate size={14} />
        {mine ? 'Mandaste un zumbido' : author ? `${author} te mandó un zumbido` : 'Te mandaron un zumbido'}
      </span>
    </div>
  );
}
