import { useEffect, useRef } from 'react';
import { DANCES, WINK_ART, loopsFor, type CharacterWink, type PartMotion } from '@lilachat/shared';

/** The characters are drawn in a 240 × 320 viewBox. */
const ART_WIDTH = 240;
const ART_RATIO = 320 / 240;

/** One keyframe per value, evenly spaced over the loop. */
const frames = (values: readonly number[], toTransform: (value: number) => string): Keyframe[] => values.map((value) => ({ transform: toTransform(value) }));

/**
 * A wink character (José, 21/10: full body, and the body moves, not just a
 * turn): its parts turn around their joints following its dance
 * (`DANCES`), and the whole character sways and hops. Still (`animate` off)
 * it is the tile of the «Guiños» panel. The markup is generated from the
 * Stitch sheets into `shared/winkArt` (plain shapes, tested: no scripts).
 */
export function WinkCharacter({ wink, size, animate, durationMs }: { wink: CharacterWink; size: number; animate: boolean; durationMs?: number }) {
  const art = WINK_ART[wink.id];
  const swayRef = useRef<HTMLDivElement>(null);
  const hopRef = useRef<HTMLDivElement>(null);
  const partRefs = useRef(new Map<string, SVGGElement>());
  useEffect(() => {
    if (!animate || !art) return;
    const dance = DANCES[wink.dance];
    const options: KeyframeAnimationOptions = { duration: dance.loopMs, iterations: loopsFor(durationMs ?? wink.durationMs, dance.loopMs), easing: 'ease-in-out' };
    const scale = size / ART_WIDTH;
    const running: Animation[] = [];
    const play = (element: Element | null | undefined, values: readonly number[] | undefined, toTransform: (value: number) => string) => {
      if (element && values && typeof element.animate === 'function') running.push(element.animate(frames(values, toTransform), options));
    };
    for (const part of art.parts) {
      const motion: PartMotion | undefined = dance.parts[part.part];
      play(partRefs.current.get(part.part), motion?.rotate, (value) => `rotate(${value}deg)`);
    }
    play(swayRef.current, dance.whole?.x, (value) => `translateX(${value * scale}px)`);
    play(hopRef.current, dance.whole?.y, (value) => `translateY(${value * scale}px)`);
    return () => running.forEach((animation) => animation.cancel());
  }, [animate, art, wink, size, durationMs]);
  if (!art) return null;
  return (
    <div ref={swayRef} style={{ width: size, height: size * ART_RATIO }}>
      <div ref={hopRef}>
        <svg viewBox={art.viewBox} width={size} height={size * ART_RATIO} aria-hidden="true">
          {art.defs ? <defs dangerouslySetInnerHTML={{ __html: art.defs }} /> : null}
          {art.parts.map((part) => (
            <g
              key={part.part}
              ref={(element) => {
                if (element) partRefs.current.set(part.part, element);
                else partRefs.current.delete(part.part);
              }}
              style={{ transformBox: 'view-box', transformOrigin: `${part.pivot[0]}px ${part.pivot[1]}px` }}
              dangerouslySetInnerHTML={{ __html: part.markup }}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
