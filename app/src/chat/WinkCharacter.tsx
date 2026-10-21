import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { DANCES, WINK_ART, loopsFor, type CharacterWink, type WinkArt } from '@lilachat/shared';

/** The characters are drawn in a 240 × 320 viewBox. */
const ART_WIDTH = 240;
const ART_RATIO = 320 / 240;

const svgOf = (art: WinkArt, markup: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${art.viewBox}">${art.defs ? `<defs>${art.defs}</defs>` : ''}${markup}</svg>`;

/** One track of a dance, repeated `loops` times (finite: an endless loop keeps the JS thread busy). */
function useLoop(values: readonly number[] | undefined, loopMs: number, loops: number, animate: boolean): SharedValue<number> {
  const value = useSharedValue(values?.[0] ?? 0);
  useEffect(() => {
    if (!animate || !values || values.length < 2) return;
    const step = loopMs / (values.length - 1);
    value.value = values[0]!;
    value.value = withRepeat(withSequence(...values.slice(1).map((next) => withTiming(next, { duration: step, easing: Easing.inOut(Easing.quad) }))), loops, false);
  }, [animate, values, loopMs, loops, value]);
  return value;
}

function PartLayer(props: { art: WinkArt; index: number; size: number; rotate: readonly number[] | undefined; loopMs: number; loops: number }) {
  const part = props.art.parts[props.index]!;
  const angle = useLoop(props.rotate, props.loopMs, props.loops, true);
  const scale = props.size / ART_WIDTH;
  const xml = useMemo(() => svgOf(props.art, part.markup), [props.art, part.markup]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transformOrigin: [part.pivot[0] * scale, part.pivot[1] * scale, 0] }, style]}>
      <SvgXml xml={xml} width={props.size} height={props.size * ART_RATIO} />
    </Animated.View>
  );
}

/**
 * A wink character (José, 21/10: full body, and the body moves, not just a
 * turn): one SVG layer per part, each turning around its joint with its
 * dance (`DANCES`), and the whole character swaying and hopping. Still
 * (`animate` off, the «Guiños» tiles) it is ONE layer: a dozen tiles of seven
 * layers each would parse a hundred SVGs at once.
 */
export function WinkCharacter({ wink, size, animate, durationMs }: { wink: CharacterWink; size: number; animate: boolean; durationMs?: number }) {
  const art = WINK_ART[wink.id];
  const dance = DANCES[wink.dance];
  const loops = loopsFor(durationMs ?? wink.durationMs, dance.loopMs);
  const sway = useLoop(dance.whole?.x, dance.loopMs, loops, animate);
  const hop = useLoop(dance.whole?.y, dance.loopMs, loops, animate);
  const scale = size / ART_WIDTH;
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: sway.value * scale }, { translateY: hop.value * scale }] }));
  const still = useMemo(() => (art ? svgOf(art, art.parts.map((part) => part.markup).join('')) : ''), [art]);
  if (!art) return null;
  if (!animate) {
    return (
      <View style={{ width: size, height: size * ART_RATIO }}>
        <SvgXml xml={still} width={size} height={size * ART_RATIO} />
      </View>
    );
  }
  return (
    <Animated.View pointerEvents="none" style={[{ width: size, height: size * ART_RATIO }, style]}>
      {art.parts.map((part, index) => (
        <PartLayer key={part.part} art={art} index={index} size={size} rotate={dance.parts[part.part]?.rotate} loopMs={dance.loopMs} loops={loops} />
      ))}
    </Animated.View>
  );
}
