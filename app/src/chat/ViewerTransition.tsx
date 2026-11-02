import { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { endInteraction } from '../diagnostico/frameMonitor';
import { copiaLocalDe } from './colaDeArchivos';
import { photoOriginOf } from './photoOrigin';
import { fittedBox, frameTransform, interpolateRect, openingProgress, type Rect, type Size } from './zoomFromBubble';

/**
 * The photo viewer's way in and out (plan 1, F2), as Telegram's: a copy of the
 * photo flies from its bubble to the screen and back, the black behind it
 * fades, and a vertical drag shows the chat behind. A photo with no place in
 * sight (reached by swiping, a video, a file) just fades.
 */
const OPEN_MS = 250;
const CLOSE_MS = 220;
/** Decelerating, like a thrown card: fast out of the bubble, soft on landing. */
const EASE = Easing.bezier(0.2, 0, 0, 1);
/** The frame window of F0 closes when the photo lands, not when the layer mounts. */
export const VIEWER_FRAME_WINDOW = 'abrir-foto';

export type ZoomablePhoto = { seq: number; url: string; mime?: string; miniatura?: string; clientKey?: string; aspecto?: number };
type Flight = { from: Rect; to: Rect; uri: string };

const isStillPhoto = (mime?: string): boolean => (mime ?? '').startsWith('image/');

/** The copy that flies, or null when this photo has no place to fly from. `dragY` = where a drag left it. */
function flightFor(photo: ZoomablePhoto, screen: Size, dragY = 0): Flight | null {
  const from = photoOriginOf(photo.seq);
  if (!from || !isStillPhoto(photo.mime)) return null;
  const to = fittedBox(photo.aspecto ?? from.width / from.height, screen);
  const uri = (photo.clientKey && copiaLocalDe(photo.clientKey)) || photo.miniatura || photo.url;
  return { from, to: { ...to, y: to.y + dragY }, uri };
}

/**
 * Mounted with the viewer's layer, so the opening starts on its first frame.
 * `close({ fade })` plays the way out and THEN calls `onClosed`; `fade` skips
 * the flight (a zoomed photo would jump back to its full size first).
 */
export function useViewerTransition(args: { photo: ZoomablePhoto; screen: Size; onClosed: () => void }) {
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  const [flight, setFlight] = useState<Flight | null>(() => flightFor(args.photo, args.screen));
  const closing = useRef(false);
  const latest = useRef(args);
  latest.current = args;

  useEffect(() => {
    const landed = () => {
      endInteraction(VIEWER_FRAME_WINDOW);
      if (!closing.current) setFlight(null);
    };
    progress.value = withTiming(1, { duration: OPEN_MS, easing: EASE }, () => runOnJS(landed)());
  }, [progress]);

  const close = useCallback(
    (options?: { fade?: boolean }) => {
      if (closing.current) return;
      closing.current = true;
      const { photo, screen, onClosed } = latest.current;
      setFlight(options?.fade ? null : flightFor(photo, screen, drag.value));
      progress.value = withTiming(0, { duration: CLOSE_MS, easing: EASE }, () => runOnJS(onClosed)());
    },
    [progress, drag]
  );

  const height = args.screen.height;
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * openingProgress(drag.value, height) }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  return { flight, progress, drag, close, backdropStyle, fadeStyle };
}

/**
 * The flying copy: a clip laid out where the photo lands, scaled to look like
 * the bubble and back, with the photo inside scaled so it keeps its shape.
 * Transforms only: they run on the UI thread every frame without a layout pass.
 */
export function FlyingPhoto({ flight, progress }: { flight: Flight; progress: SharedValue<number> }) {
  const { from, to } = flight;
  const clipStyle = useAnimatedStyle(() => {
    const step = frameTransform(interpolateRect(from, to, progress.value), to);
    return { transform: [{ translateX: step.translateX }, { translateY: step.translateY }, { scaleX: step.scaleX }, { scaleY: step.scaleY }] };
  });
  const photoStyle = useAnimatedStyle(() => {
    const step = frameTransform(interpolateRect(from, to, progress.value), to);
    return { transform: [{ scaleX: step.innerScaleX }, { scaleY: step.innerScaleY }] };
  });
  return (
    <Animated.View pointerEvents="none" testID="visor-zoom" style={[{ position: 'absolute', left: to.x, top: to.y, width: to.width, height: to.height, overflow: 'hidden' }, clipStyle]}>
      <Animated.View style={[{ width: '100%', height: '100%' }, photoStyle]}>
        <Image source={{ uri: flight.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={0} cachePolicy="memory-disk" />
      </Animated.View>
    </Animated.View>
  );
}
