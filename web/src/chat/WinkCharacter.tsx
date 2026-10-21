import { WINK_ART, WINK_PROPS, type CharacterWink, type WinkArt } from '@lilachat/shared';

/** The art of a sketch's tile: its character, or its prop for a wink without one (the water balloon). */
export function tileArt(wink: CharacterWink): WinkArt | undefined {
  return wink.tile ? WINK_PROPS[wink.tile] : WINK_ART[wink.id as keyof typeof WINK_ART];
}

/**
 * The still tile of a sketch in the «Guiños» panel. The markup is generated
 * from the Stitch sheets into `shared/winkArt` (plain shapes, tested: no
 * scripts); the sketch itself plays in `WinkSketch`.
 */
export function WinkCharacter({ wink, size }: { wink: CharacterWink; size: number }) {
  const art = tileArt(wink);
  if (!art) return null;
  const [, , width = 1, height = 1] = art.viewBox.split(' ').map(Number);
  return (
    <svg viewBox={art.viewBox} width={size} height={(size * height) / width} aria-hidden="true">
      {art.defs ? <defs dangerouslySetInnerHTML={{ __html: art.defs }} /> : null}
      <g dangerouslySetInnerHTML={{ __html: art.parts.map((part) => part.markup).join('') }} />
    </svg>
  );
}
