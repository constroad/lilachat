import { useMemo, useRef, useState, type MutableRefObject } from 'react';
import { PanResponder, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { VideoThumbnail } from 'expo-video';
import { msOfDistance, resizeTrim, slideTrim, trimFrame, trimSummary, type TrimEdge, type TrimWindow } from './videoStickerTrim';

const STRIP_HEIGHT = 56;
/** The handles' touch area (the visible bar is thinner): with the strip's height, past 44 dp. */
const HANDLE_TOUCH = 28;
const HANDLE_BAR = 6;
/** Narrower than this, the window has no room for its «6 s» chip. */
const CHIP_MIN_WIDTH = 48;

type Drag = 'move' | TrimEdge;
type Latest = { trim: TrimWindow; width: number; videoMs: number; onChange: (trim: TrimWindow) => void; onCommit: (trim: TrimWindow) => void };

/** One finger on the window (to slide it) or on a handle (to stretch it); the scroll behind does not steal it. */
function useTrimDrag(kind: Drag, latest: MutableRefObject<Latest>) {
  return useMemo(() => {
    let origin: TrimWindow | null = null;
    const moved = (dx: number): TrimWindow => {
      const { width, videoMs, trim } = latest.current;
      const from = origin ?? trim;
      const delta = msOfDistance(dx, width, videoMs);
      return kind === 'move' ? slideTrim(from, delta, videoMs) : resizeTrim(from, kind, delta, videoMs);
    };
    const finish = (dx: number) => {
      latest.current.onCommit(moved(dx));
      origin = null;
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        origin = latest.current.trim;
      },
      onPanResponderMove: (_event, gesture) => latest.current.onChange(moved(gesture.dx)),
      onPanResponderRelease: (_event, gesture) => finish(gesture.dx),
      onPanResponderTerminate: (_event, gesture) => finish(gesture.dx),
    }).panHandlers;
  }, [kind, latest]);
}

/**
 * «Recorte del video» (José 26/11, design ss-01): the video's frames in a
 * strip and the chosen window over them, up to 6 seconds. `onChange` follows
 * the finger; `onCommit` comes when it lets go (the preview jumps there).
 */
export function VideoTrimStrip(props: { videoMs: number; trim: TrimWindow; frames: readonly VideoThumbnail[]; onChange: (trim: TrimWindow) => void; onCommit: (trim: TrimWindow) => void }) {
  const [width, setWidth] = useState(0);
  const latest = useRef<Latest>({ ...props, width });
  latest.current = { trim: props.trim, width, videoMs: props.videoMs, onChange: props.onChange, onCommit: props.onCommit };
  const moveHandlers = useTrimDrag('move', latest);
  const startHandlers = useTrimDrag('start', latest);
  const endHandlers = useTrimDrag('end', latest);
  const frame = trimFrame(props.trim, width, props.videoMs);
  const summary = trimSummary(props.trim);
  const frameWidth = props.frames.length > 0 ? width / props.frames.length : 0;

  return (
    <View testID="sticker-video-tramo" accessibilityLabel={`Tramo del video: ${summary.range}`} className="overflow-visible" style={{ height: STRIP_HEIGHT }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View className="absolute inset-0 flex-row overflow-hidden rounded-xl bg-surface-variant">
        {props.frames.map((source, index) => (
          <Image key={index} source={source} style={{ width: frameWidth, height: STRIP_HEIGHT }} contentFit="cover" />
        ))}
      </View>
      <View pointerEvents="none" className="absolute bottom-0 left-0 top-0 rounded-l-xl bg-black/45" style={{ width: frame.left }} />
      <View pointerEvents="none" className="absolute bottom-0 right-0 top-0 rounded-r-xl bg-black/45" style={{ left: frame.left + frame.width }} />
      <View {...moveHandlers} testID="sticker-video-ventana" className="absolute items-center justify-center rounded-xl border-[3px] border-primary" style={{ left: frame.left, width: frame.width, top: 0, bottom: 0 }}>
        {frame.width >= CHIP_MIN_WIDTH ? (
          <View className="rounded-md bg-primary px-1.5 py-0.5">
            <Text className="text-[11px] font-bold text-on-primary">{summary.length.replace(' seleccionados', '')}</Text>
          </View>
        ) : null}
      </View>
      <TrimHandle testID="sticker-video-inicio" label="Mover el inicio del tramo" center={frame.left} handlers={startHandlers} />
      <TrimHandle testID="sticker-video-fin" label="Mover el final del tramo" center={frame.left + frame.width} handlers={endHandlers} />
    </View>
  );
}

function TrimHandle(props: { testID: string; label: string; center: number; handlers: ReturnType<typeof useTrimDrag> }) {
  return (
    <View {...props.handlers} testID={props.testID} accessibilityLabel={props.label} className="absolute items-center justify-center" style={{ left: props.center - HANDLE_TOUCH / 2, width: HANDLE_TOUCH, top: 0, bottom: 0 }}>
      <View className="items-center justify-center rounded-full bg-primary" style={{ width: HANDLE_BAR * 2, height: STRIP_HEIGHT * 0.6 }}>
        <View className="rounded-full bg-on-primary" style={{ width: 2, height: STRIP_HEIGHT * 0.3 }} />
      </View>
    </View>
  );
}
