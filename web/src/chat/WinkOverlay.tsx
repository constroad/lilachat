import { useEffect, useMemo, useRef } from 'react';
import { winkParticles, type CharacterWink, type Wink, type WinkParticle } from '@lilachat/shared';
import { WinkCharacter } from './WinkCharacter';

/** The character's width on screen (px). */
const HERO_PX = 260;
/** The first emoji winks (José, 21/10: «deja los emojis, están bien»). */
const EMOJI_PX = 120;
const HERO_FADE_MS = 400;

/**
 * A wink playing over the WHOLE window (José, 21/10, like MSN: «ocupa toda la
 * pantalla»): the character dances in the middle and the particles follow the
 * same seeded choreography as the app (Web Animations API). It never takes
 * clicks (`pointer-events: none`): the chat stays usable.
 */
export function WinkOverlay({ play, onDone }: { play: { seq: number; wink: Wink } | null; onDone: () => void }) {
  useEffect(() => {
    if (!play) return;
    const timer = setTimeout(onDone, play.wink.durationMs);
    return () => clearTimeout(timer);
  }, [play, onDone]);
  const particles = useMemo(() => (play ? winkParticles(play.wink, play.seq) : []), [play]);
  if (!play) return null;
  return (
    <div data-testid={`guino-en-pantalla-${play.wink.id}`} className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {particles.map((particle, index) => (
        <FlyingGlyph key={`${play.seq}-${index}`} particle={particle} />
      ))}
      {play.wink.kind === 'character' ? <Hero key={play.seq} wink={play.wink} durationMs={play.wink.durationMs} /> : <EmojiHero key={play.seq} glyph={play.wink.hero} durationMs={play.wink.durationMs} />}
    </div>
  );
}

function FlyingGlyph({ particle }: { particle: WinkParticle }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;
    const { width, height } = parent.getBoundingClientRect();
    const at = (x: number, y: number, turn: number, scale: number) => `translate(${x * width - particle.size / 2}px, ${y * height - particle.size / 2}px) rotate(${turn}deg) scale(${scale})`;
    const animation = element.animate(
      [
        { transform: at(particle.fromX, particle.fromY, 0, 0.4), opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { opacity: 1, offset: 0.8 },
        { transform: at(particle.toX, particle.toY, particle.rotate, 0.9), opacity: 0 },
      ],
      { duration: particle.durationMs, delay: particle.delayMs, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', fill: 'both' }
    );
    return () => animation.cancel();
  }, [particle]);
  return (
    <span ref={ref} className="absolute left-0 top-0 select-none leading-none" style={{ fontSize: particle.size }}>
      {particle.glyph}
    </span>
  );
}

/** The character in the middle: it pops in, dances its whole body and fades at the end. */
function Hero({ wink, durationMs }: { wink: CharacterWink; durationMs: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof element.animate !== 'function') return;
    const fadeFrom = (durationMs - HERO_FADE_MS) / durationMs;
    const animation = element.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1.08)', opacity: 1, offset: 0.08 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.14 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: fadeFrom },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
      ],
      { duration: durationMs, easing: 'ease-out', fill: 'both' }
    );
    return () => animation.cancel();
  }, [durationMs]);
  return (
    <div ref={ref} className="absolute left-1/2 top-1/2">
      <WinkCharacter wink={wink} size={HERO_PX} animate durationMs={durationMs} />
    </div>
  );
}

/** One of the first winks: the big emoji pops in, wiggles and fades. */
function EmojiHero({ glyph, durationMs }: { glyph: string; durationMs: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof element.animate !== 'function') return;
    const fadeFrom = (durationMs - HERO_FADE_MS) / durationMs;
    const animation = element.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0) rotate(0deg)', opacity: 1 },
        { transform: 'translate(-50%, -50%) scale(1.2) rotate(-10deg)', offset: 0.12 },
        { transform: 'translate(-50%, -50%) scale(1) rotate(10deg)', offset: 0.22 },
        { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1, offset: fadeFrom },
        { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 0 },
      ],
      { duration: durationMs, easing: 'ease-out', fill: 'both' }
    );
    return () => animation.cancel();
  }, [durationMs]);
  return (
    <span ref={ref} className="absolute left-1/2 top-1/2 select-none text-center leading-none" style={{ fontSize: EMOJI_PX * 0.8, width: EMOJI_PX }}>
      {glyph}
    </span>
  );
}
