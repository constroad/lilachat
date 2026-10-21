import { actorTracks, isStillTrack, partTracks, sampleTrack, type PartKey, type SketchActor } from '@lilachat/shared';

/** The web samples each sketch every 20 ms (50 frames a second): the same curves as the app, played as plain keyframes. */
export const FRAME_MS = 20;

/** The moments (0–1) of every frame, the last one exactly at the end. */
export function frameMoments(durationMs: number): number[] {
  const count = Math.max(1, Math.ceil(durationMs / FRAME_MS));
  return Array.from({ length: count + 1 }, (_, index) => index / count);
}

/**
 * An actor's keyframes on the screen: its center at `x`·width and `y`·height,
 * turned, scaled and stretched around its middle. `box` is its size at scale 1.
 */
export function actorFrames(actor: SketchActor, box: { width: number; height: number }, screen: { width: number; height: number }, durationMs: number): Keyframe[] {
  const tracks = actorTracks(actor.keys);
  return frameMoments(durationMs).map((at) => {
    const scale = sampleTrack(tracks.scale, at);
    const left = sampleTrack(tracks.x, at) * screen.width - box.width / 2;
    const top = sampleTrack(tracks.y, at) * screen.height - box.height / 2;
    return {
      offset: at,
      opacity: sampleTrack(tracks.opacity, at),
      transform: `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px) rotate(${sampleTrack(tracks.rotate, at).toFixed(2)}deg) scale(${(scale * sampleTrack(tracks.sx, at)).toFixed(4)}, ${(scale * sampleTrack(tracks.sy, at)).toFixed(4)})`,
    };
  });
}

/** A part's keyframes around its joint, or null when the sketch never moves it (it stays as drawn). */
export function partFrames(keys: readonly PartKey[] | undefined, durationMs: number): Keyframe[] | null {
  const tracks = partTracks(keys);
  if (Object.values(tracks).every(isStillTrack) && tracks.rotate.values[0] === 0 && tracks.scale.values[0] === 1 && tracks.scaleY.values[0] === 1 && tracks.opacity.values[0] === 1) return null;
  return frameMoments(durationMs).map((at) => {
    const scale = sampleTrack(tracks.scale, at);
    return { offset: at, opacity: sampleTrack(tracks.opacity, at), transform: `rotate(${sampleTrack(tracks.rotate, at).toFixed(2)}deg) scale(${scale.toFixed(4)}, ${(scale * sampleTrack(tracks.scaleY, at)).toFixed(4)})` };
  });
}
