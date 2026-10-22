import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Mic, Pause, Play } from 'lucide-react-native';
import { duracionDeVoz, scrubFraction } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';
import { useColores } from '../ui/tema';
import { knobLeft, showsSpeed } from './notaDeVozMotor';

const AVATAR_DP = 46;
const KNOB_DP = 16;
/** Under the swipe-to-reply's 12 dp: a drag along the bar is taken here first, so it never turns into «Responder». */
const SCRUB_START_DP = 3;
const SCRUB_VERTICAL_FAIL_DP = 14;

export type VoiceNoteViewProps = {
  mia?: boolean;
  onda?: number[];
  sonando: boolean;
  ms: number;
  avance: number;
  velocidad: number;
  onPlay: () => void;
  onVelocidad: () => void;
  /** Tap or drag along the bar: jump to that share of the audio (backlog 34). */
  onSeek: (share: number) => void;
  /** Its length, to show the time under the finger while dragging. */
  durationS: number;
  /** The audio is still loading after the tap: a spinner, not a dead button. */
  loading?: boolean;
  /** Who recorded it: their photo with the microphone, like WhatsApp. */
  author?: { name: string; photo?: string };
};

/**
 * The bar: the wave recorded with the note, filled as it plays, with its
 * knob. Tap or drag with the gesture system (not the responder system): the
 * bubble's swipe-to-reply is a native pan and always beat the responder, so
 * moving forward or back opened «Responder» (José, 21/10).
 */
function ScrubBar(props: { mia?: boolean; flat?: boolean; onda?: number[]; avance: number; onScrub: (share: number | null) => void; onSeek: (share: number) => void }) {
  const [width, setWidth] = useState(0);
  const latest = useRef({ width, onScrub: props.onScrub, onSeek: props.onSeek });
  latest.current = { width, onScrub: props.onScrub, onSeek: props.onSeek };
  const gesture = useMemo(() => {
    const share = (x: number) => scrubFraction(x, latest.current.width);
    const drag = Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-SCRUB_START_DP, SCRUB_START_DP])
      .failOffsetY([-SCRUB_VERTICAL_FAIL_DP, SCRUB_VERTICAL_FAIL_DP])
      .hitSlop({ top: 12, bottom: 12 })
      .onStart((event) => latest.current.onScrub(share(event.x)))
      .onUpdate((event) => latest.current.onScrub(share(event.x)))
      .onEnd((event) => latest.current.onSeek(share(event.x)))
      .onFinalize(() => latest.current.onScrub(null));
    const tap = Gesture.Tap()
      .runOnJS(true)
      .hitSlop({ top: 12, bottom: 12 })
      .onEnd((event, success) => success && latest.current.onSeek(share(event.x)));
    return Gesture.Race(drag, tap);
  }, []);
  const played = props.mia ? 'bg-on-burbuja-propia' : 'bg-primary';
  const ahead = props.mia ? 'bg-on-burbuja-propia/40' : 'bg-primary/30';
  return (
    <GestureDetector gesture={gesture}>
      <View testID="barra-voz" accessibilityLabel="Ir a un punto de la nota" accessibilityRole="adjustable" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} className="h-7 justify-center">
        {props.onda?.length ? (
          <View testID="onda-voz" className="h-7 flex-row items-center justify-between">
            {props.onda.map((value, index) => (
              <View key={index} className={`w-[2.5px] rounded-full ${index / props.onda!.length < props.avance ? played : ahead}`} style={{ height: 4 + (value / 100) * 20 }} />
            ))}
          </View>
        ) : (
          <View className={`h-1 rounded-full ${ahead}`}>
            <View className={`h-1 rounded-full ${played}`} style={{ width: `${Math.min(100, props.avance * 100)}%` }} />
          </View>
        )}
        {/* A ring of the bubble's color lifts the knob off the bars (it blended in). In the Slack format there is no bubble: the screen's color. */}
        <View pointerEvents="none" className={`absolute rounded-full border-2 ${props.mia ? 'border-burbuja-propia' : props.flat ? 'border-background' : 'border-burbuja-ajena'} ${played}`} style={{ width: KNOB_DP, height: KNOB_DP, left: knobLeft(props.avance, width, KNOB_DP) }} />
      </View>
    </GestureDetector>
  );
}

/**
 * The voice note like WhatsApp's (José, 21/10): who recorded it (photo with
 * the microphone) or, while it plays, the speed; the play; the wave with its
 * knob; and the time under it. The same with or without a player.
 */
export function VoiceNoteView(props: VoiceNoteViewProps) {
  const { mia, sonando, velocidad } = props;
  const colors = useColores();
  const ink = mia ? colors['on-burbuja-propia'] : colors.primary;
  /** While the finger is on the bar, the bar and the time follow it; letting go jumps there. */
  const [dragShare, setDragShare] = useState<number | null>(null);
  const avance = dragShare ?? props.avance;
  const ms = dragShare !== null ? dragShare * props.durationS * 1000 : props.ms;
  return (
    <View testID="nota-de-voz" className="min-w-[250px] flex-row items-center gap-2 py-2 pl-2 pr-3">
      <View className="items-center justify-center" style={{ width: AVATAR_DP, height: AVATAR_DP }}>
        {showsSpeed(sonando, props.avance) ? (
          <Pressable testID="btn-velocidad-voz" accessibilityLabel={`Velocidad ${velocidad}×`} onPress={props.onVelocidad} hitSlop={6} className={`h-8 min-w-[40px] items-center justify-center rounded-full px-2 ${mia ? 'bg-white/20' : 'bg-primary/10'}`}>
            <Text className={`text-[13px] font-bold ${mia ? 'text-on-burbuja-propia' : 'text-primary'}`}>{`${String(velocidad).replace('.', ',')}×`}</Text>
          </Pressable>
        ) : props.author ? (
          <View testID="autor-voz">
            <Avatar nombre={props.author.name || 'Nota de voz'} foto={props.author.photo} tamano={AVATAR_DP} />
            <View className="absolute -bottom-0.5 -right-1">
              <Mic size={17} color={ink} strokeWidth={2.5} />
            </View>
          </View>
        ) : (
          // The Slack-format row already shows who it is beside it: here only the microphone.
          <View className={`h-10 w-10 items-center justify-center rounded-full ${mia ? 'bg-white/20' : 'bg-primary/10'}`}>
            <Mic size={20} color={ink} />
          </View>
        )}
      </View>
      <Pressable testID={sonando ? 'btn-pausar-voz' : 'btn-reproducir-voz'} accessibilityLabel={sonando ? 'Pausar' : 'Reproducir'} onPress={props.onPlay} hitSlop={8} className="h-11 w-9 items-center justify-center">
        {props.loading ? <ActivityIndicator size="small" color={ink} /> : sonando ? <Pause size={26} color={ink} fill={ink} /> : <Play size={26} color={ink} fill={ink} />}
      </Pressable>
      <View className="min-w-0 flex-1">
        <ScrubBar mia={mia} flat={!props.author} onda={props.onda} avance={avance} onScrub={setDragShare} onSeek={props.onSeek} />
        <Text className={`text-[12px] ${mia ? 'text-on-burbuja-propia-suave' : 'text-on-surface-variant'}`}>{duracionDeVoz(ms)}</Text>
      </View>
    </View>
  );
}
