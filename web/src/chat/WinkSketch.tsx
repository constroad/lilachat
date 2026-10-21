import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { WINK_ART, WINK_PROPS, actorBox, type RigPart, type Sketch, type SketchActor, type WinkArt, type WinkArtPart } from '@lilachat/shared';
import { actorFrames, partFrames } from './sketchFrames';

type Screen = { width: number; height: number };

const artOf = (actor: SketchActor): WinkArt => ('character' in actor.art ? WINK_ART[actor.art.character] : WINK_PROPS[actor.art.prop]);

/**
 * A wink sketch over the whole window (José, 21/10: «se trata de que sean
 * graciosos»): every actor (a character or a prop) follows the shared
 * timeline (`WINK_SKETCHES`), sampled into keyframes, and its parts turn
 * around their joints; the eyes and the mouth ride on the head.
 */
export function WinkSketch({ sketch }: { sketch: Sketch }) {
  const ref = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState<Screen | null>(null);
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect();
    if (box) setScreen({ width: box.width, height: box.height });
  }, []);
  return (
    <div ref={ref} className="absolute inset-0">
      {screen ? sketch.actors.map((actor, index) => <ActorView key={index} actor={actor} screen={screen} durationMs={sketch.durationMs} />) : null}
    </div>
  );
}

function ActorView({ actor, screen, durationMs }: { actor: SketchActor; screen: Screen; durationMs: number }) {
  const art = artOf(actor);
  const box = actorBox(art.viewBox, actor.fit, screen);
  const ref = useRef<HTMLDivElement>(null);
  const parts = useRef(new Map<RigPart, SVGGElement>());
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof element.animate !== 'function') return;
    const options: KeyframeAnimationOptions = { duration: durationMs, easing: 'linear', fill: 'both' };
    const running = [element.animate(actorFrames(actor, box, screen, durationMs), options)];
    for (const [part, keys] of Object.entries(actor.parts ?? {}) as [RigPart, NonNullable<SketchActor['parts']>[RigPart]][]) {
      const frames = partFrames(keys, durationMs);
      const group = parts.current.get(part);
      if (frames && group) running.push(group.animate(frames, options));
    }
    return () => running.forEach((animation) => animation.cancel());
  }, [actor, box.width, box.height, screen, durationMs]);
  const register = (part: RigPart) => (element: SVGGElement | null) => {
    if (element) parts.current.set(part, element);
    else parts.current.delete(part);
  };
  const draw = (part: WinkArtPart) => (
    <g key={part.part} ref={register(part.part)} style={{ transformBox: 'view-box', transformOrigin: `${part.pivot[0]}px ${part.pivot[1]}px` }}>
      <g dangerouslySetInnerHTML={{ __html: part.markup }} />
      {art.parts.filter((child) => child.parent === part.part).map(draw)}
    </g>
  );
  return (
    <div ref={ref} className="absolute left-0 top-0 opacity-0" style={{ width: box.width, height: box.height }}>
      <svg viewBox={art.viewBox} width={box.width} height={box.height} preserveAspectRatio={actor.fit === 'width' ? 'none' : undefined} aria-hidden="true">
        {art.defs ? <defs dangerouslySetInnerHTML={{ __html: art.defs }} /> : null}
        {art.parts.filter((part) => !part.parent).map(draw)}
      </svg>
    </div>
  );
}
