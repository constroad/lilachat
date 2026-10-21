import { useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { WINK_ART, WINK_PROPS, actorBox, actorTracks, isStillTrack, partTracks, type Ease, type PartKey, type Sketch, type SketchActor, type Track, type WinkArt, type WinkArtPart } from '@lilachat/shared';

type Screen = { width: number; height: number };
/** A track ready for the UI thread: the eases as numbers (0 smooth, 1 linear, 2 in, 3 out). */
type WorkletTrack = { ats: number[]; values: number[]; eases: number[] };

const EASE_CODES: Record<Ease, number> = { smooth: 0, linear: 1, in: 2, out: 3 };
const forWorklet = (track: Track): WorkletTrack => ({ ats: track.ats, values: track.values, eases: track.eases.map((ease) => EASE_CODES[ease]) });

/** `sampleTrack` of shared, on the UI thread: each segment arrives at its key with that key's ease. */
function sample(at: number, track: WorkletTrack): number {
  'worklet';
  const { ats, values, eases } = track;
  if (at <= ats[0]!) return values[0]!;
  for (let index = 1; index < ats.length; index += 1) {
    if (at <= ats[index]!) {
      const share = (at - ats[index - 1]!) / (ats[index]! - ats[index - 1]!);
      const ease = eases[index]!;
      const eased = ease === 1 ? share : ease === 2 ? share * share : ease === 3 ? 1 - (1 - share) * (1 - share) : share * share * (3 - 2 * share);
      return values[index - 1]! + (values[index]! - values[index - 1]!) * eased;
    }
  }
  return values[values.length - 1]!;
}

const artOf = (actor: SketchActor): WinkArt => ('character' in actor.art ? WINK_ART[actor.art.character] : WINK_PROPS[actor.art.prop]);
const svgOf = (art: WinkArt, markup: string, stretch: boolean) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${art.viewBox}"${stretch ? ' preserveAspectRatio="none"' : ''}>${art.defs ? `<defs>${art.defs}</defs>` : ''}${markup}</svg>`;

/**
 * A wink sketch over the whole screen (José, 21/10: winks are meant to be
 * funny, not everybody dancing): every actor (a character or a prop)
 * follows the shared timeline (`WINK_SKETCHES`) from ONE progress value, each
 * property interpolated on the UI thread; its parts turn around their joints
 * and the eyes and the mouth ride on the head. A part the sketch never moves
 * is a still layer.
 */
export function WinkSketch({ sketch, screen }: { sketch: Sketch; screen: Screen }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    // Reanimated would end it at once with the phone's «remove animations» on (Samsung's battery saver): a wink is content, it plays.
    progress.value = withTiming(1, { duration: sketch.durationMs, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
  }, [sketch, progress]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {sketch.actors.map((actor, index) => (
        <ActorView key={index} actor={actor} screen={screen} progress={progress} />
      ))}
    </View>
  );
}

function ActorView({ actor, screen, progress }: { actor: SketchActor; screen: Screen; progress: SharedValue<number> }) {
  const art = artOf(actor);
  const box = actorBox(art.viewBox, actor.fit, screen);
  const tracks = useMemo(() => {
    const all = actorTracks(actor.keys);
    return { x: forWorklet(all.x), y: forWorklet(all.y), scale: forWorklet(all.scale), sx: forWorklet(all.sx), sy: forWorklet(all.sy), rotate: forWorklet(all.rotate), opacity: forWorklet(all.opacity) };
  }, [actor]);
  const { width, height } = screen;
  const style = useAnimatedStyle(() => {
    const at = progress.value;
    const scale = sample(at, tracks.scale);
    return {
      opacity: sample(at, tracks.opacity),
      transform: [
        { translateX: sample(at, tracks.x) * width - box.width / 2 },
        { translateY: sample(at, tracks.y) * height - box.height / 2 },
        { rotate: `${sample(at, tracks.rotate)}deg` },
        { scaleX: scale * sample(at, tracks.sx) },
        { scaleY: scale * sample(at, tracks.sy) },
      ],
    };
  });
  const [, , viewWidth = 1, viewHeight = 1] = art.viewBox.split(/\s+/).map(Number);
  // Pixels per viewBox unit (different on each axis only for a stretched actor).
  const units = { x: box.width / viewWidth, y: box.height / viewHeight };
  const draw = (part: WinkArtPart) => (
    <PartLayer key={part.part} art={art} part={part} box={box} units={units} stretch={actor.fit === 'width'} keys={actor.parts?.[part.part]} progress={progress}>
      {art.parts.filter((child) => child.parent === part.part).map(draw)}
    </PartLayer>
  );
  return <Animated.View style={[styles.actor, { width: box.width, height: box.height }, style]}>{art.parts.filter((part) => !part.parent).map(draw)}</Animated.View>;
}

function PartLayer(props: { art: WinkArt; part: WinkArtPart; box: Screen; units: { x: number; y: number }; stretch: boolean; keys: readonly PartKey[] | undefined; progress: SharedValue<number>; children: ReactNode }) {
  const { art, part, box, units, stretch, keys, progress } = props;
  const xml = useMemo(() => svgOf(art, part.markup, stretch), [art, part.markup, stretch]);
  const tracks = useMemo(() => {
    const all = partTracks(keys);
    const moves = !Object.values(all).every(isStillTrack) || all.rotate.values[0] !== 0 || all.scale.values[0] !== 1 || all.scaleY.values[0] !== 1 || all.opacity.values[0] !== 1;
    return moves ? { rotate: forWorklet(all.rotate), scale: forWorklet(all.scale), scaleY: forWorklet(all.scaleY), opacity: forWorklet(all.opacity) } : null;
  }, [keys]);
  const style = useAnimatedStyle(() => {
    if (!tracks) return {};
    const at = progress.value;
    const grow = sample(at, tracks.scale);
    return { opacity: sample(at, tracks.opacity), transform: [{ rotate: `${sample(at, tracks.rotate)}deg` }, { scaleX: grow }, { scaleY: grow * sample(at, tracks.scaleY) }] };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: [part.pivot[0] * units.x, part.pivot[1] * units.y, 0] }, style]}>
      <SvgXml xml={xml} width={box.width} height={box.height} />
      {props.children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ actor: { position: 'absolute', left: 0, top: 0 } });
