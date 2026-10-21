import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, ReduceMotion, interpolate, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { WINK_SKETCHES, winkParticles, type SketchWinkId, type Wink, type WinkParticle } from '@lilachat/shared';
import { WinkSketch } from './WinkSketch';

const HERO_SIZE = 120;
const HERO_FADE_MS = 400;
const WIGGLE_DEG = 10;
const WIGGLE_STEP_MS = 140;
/** A wink is content: the phone's «remove animations» must not end it at once (`shouldPlayFun`). */
const ALWAYS = ReduceMotion.Never;

/**
 * A wink playing over the whole screen (José, 21/10, like MSN): its sketch (a
 * gag with a punchline, `WinkSketch`) or one of the first emoji winks, and the
 * particles following the shared choreography. It never takes touches
 * (`pointerEvents="none"`): the chat stays usable under it.
 */
export function WinkOverlay(props: { play: { seq: number; wink: Wink } | null; onDone: () => void }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const { play, onDone } = props;
  useEffect(() => {
    if (!play) return;
    const timer = setTimeout(onDone, play.wink.durationMs);
    return () => clearTimeout(timer);
  }, [play, onDone]);
  const particles = useMemo(() => (play ? winkParticles(play.wink, play.seq) : []), [play]);
  if (!play) return null;
  const measure = (event: LayoutChangeEvent) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height });
  return (
    <View testID={`guino-en-pantalla-${play.wink.id}`} pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={measure}>
      {size ? (
        <>
          {particles.map((particle, index) => (
            <FlyingGlyph key={`${play.seq}-${index}`} particle={particle} width={size.width} height={size.height} />
          ))}
          {play.wink.kind === 'character' ? (
            <WinkSketch key={play.seq} sketch={WINK_SKETCHES[play.wink.id as SketchWinkId]} screen={size} />
          ) : (
            <EmojiHero key={play.seq} glyph={play.wink.hero} durationMs={play.wink.durationMs} width={size.width} height={size.height} />
          )}
        </>
      ) : null}
    </View>
  );
}

function FlyingGlyph({ particle, width, height }: { particle: WinkParticle; width: number; height: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(particle.delayMs, withTiming(1, { duration: particle.durationMs, easing: Easing.out(Easing.quad), reduceMotion: ALWAYS }), ALWAYS);
  }, [particle, progress]);
  const style = useAnimatedStyle(() => {
    const value = progress.value;
    return {
      opacity: value === 0 ? 0 : interpolate(value, [0, 0.12, 0.8, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: interpolate(value, [0, 1], [particle.fromX * width, particle.toX * width]) - particle.size / 2 },
        { translateY: interpolate(value, [0, 1], [particle.fromY * height, particle.toY * height]) - particle.size / 2 },
        { rotate: `${value * particle.rotate}deg` },
        { scale: interpolate(value, [0, 0.2, 1], [0.4, 1, 0.9]) },
      ],
    };
  });
  return <Animated.Text style={[styles.glyph, { fontSize: particle.size }, style]}>{particle.glyph}</Animated.Text>;
}

/** The first winks: the big emoji pops in, wiggles and fades (José, 21/10: «deja los emojis, están bien»). */
function EmojiHero({ glyph, durationMs, width, height }: { glyph: string; durationMs: number; width: number; height: number }) {
  const scale = useSharedValue(0);
  const turn = useSharedValue(0);
  const opacity = useSharedValue(1);
  useEffect(() => {
    // A soft pop: with low damping the spring overshot to almost twice the size and the hero pulsed huge.
    scale.value = withSequence(ALWAYS, withSpring(1.15, { damping: 12, reduceMotion: ALWAYS }), withSpring(1, { damping: 14, reduceMotion: ALWAYS }));
    turn.value = withSequence(
      ALWAYS,
      withTiming(-WIGGLE_DEG, { duration: WIGGLE_STEP_MS, reduceMotion: ALWAYS }),
      withTiming(WIGGLE_DEG, { duration: WIGGLE_STEP_MS, reduceMotion: ALWAYS }),
      withTiming(-WIGGLE_DEG, { duration: WIGGLE_STEP_MS, reduceMotion: ALWAYS }),
      withTiming(0, { duration: WIGGLE_STEP_MS, reduceMotion: ALWAYS })
    );
    opacity.value = withDelay(durationMs - HERO_FADE_MS, withTiming(0, { duration: HERO_FADE_MS, reduceMotion: ALWAYS }), ALWAYS);
  }, [durationMs, scale, turn, opacity]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: width / 2 - HERO_SIZE / 2 }, { translateY: height / 2 - HERO_SIZE / 2 }, { scale: scale.value }, { rotate: `${turn.value}deg` }],
  }));
  return <Animated.Text style={[styles.glyph, styles.hero, style]}>{glyph}</Animated.Text>;
}

const styles = StyleSheet.create({
  glyph: { position: 'absolute', left: 0, top: 0 },
  hero: { fontSize: HERO_SIZE * 0.8, width: HERO_SIZE, height: HERO_SIZE, lineHeight: HERO_SIZE, textAlign: 'center' },
});
