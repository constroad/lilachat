import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Bell, CalendarDays, FileText, MapPin, Minus, Plus } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useMargenes } from '../ui/useMargenes';
import { alarmCountdown, alarmKicker, alarmWhen, nextSnooze, noteWithoutAdvance, SNOOZE_DEFAULT } from './alarmView';

/**
 * The alert's own palette (Stitch a-01/a-02, José 25/10 vía agentes): deep
 * guinda fading to almost black, with a dim copper glow top right. Fixed on
 * purpose: it rings over the lock screen and does not follow the app's theme.
 */
const ALARM = {
  guinda: '#5B0F2E',
  wine: '#2A0714',
  night: '#0B0507',
  copper: '#8A4A2A',
  warm: '#E3A57C',
  white: '#FFFFFF',
} as const;
const COUNTDOWN_TICK_MS = 30_000;

/** The organic blur behind it: radial blots that melt into each other, not a straight two-color gradient. */
function AlarmBackdrop() {
  return (
    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="center" cx="50%" cy="58%" rx="75%" ry="60%">
          <Stop offset="0" stopColor={ALARM.guinda} stopOpacity="1" />
          <Stop offset="0.55" stopColor={ALARM.wine} stopOpacity="1" />
          <Stop offset="1" stopColor={ALARM.night} stopOpacity="1" />
        </RadialGradient>
        <RadialGradient id="glow" cx="88%" cy="14%" rx="45%" ry="28%">
          <Stop offset="0" stopColor={ALARM.copper} stopOpacity="0.55" />
          <Stop offset="1" stopColor={ALARM.copper} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill="url(#center)" />
      <Rect x="0" y="0" width="100" height="100" fill="url(#glow)" />
    </Svg>
  );
}

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), COUNTDOWN_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

type Props = {
  title: string;
  note: string;
  chat: string;
  startsAt?: string;
  place?: string;
  canRead: boolean;
  /** Builds before 0.1.175 only snooze 10 minutes: no − and + there. */
  canChooseSnooze: boolean;
  onPlace: () => void;
  onRead: () => void;
  onDismiss: () => void;
  onSnooze: (minutes: number) => void;
};

/** Full screen over the lock screen: what, when, how long until it starts, and «Descartar» or «Posponer». */
export function AlarmScreen(props: Props) {
  const margins = useMargenes();
  const now = useNow();
  const [snooze, setSnooze] = useState(props.canChooseSnooze ? SNOOZE_DEFAULT : 10);
  const kicker = alarmKicker({ startsAt: props.startsAt, hasPlace: Boolean(props.place), now });
  const when = alarmWhen(props.startsAt, now);
  const countdown = alarmCountdown(props.startsAt, now);
  const note = noteWithoutAdvance(props.note);
  const KickerIcon = kicker === 'Evento' ? CalendarDays : Bell;
  return (
    <View testID="recordatorio-pantalla-completa" style={{ flex: 1, backgroundColor: ALARM.night }}>
      <StatusBar style="light" />
      <AlarmBackdrop />
      <View className="flex-1 justify-between px-7" style={{ paddingTop: margins.cabecera + 96, paddingBottom: margins.pie + 20 }}>
        <View className="items-center">
          <View className="flex-row items-center gap-2">
            <KickerIcon size={16} color={ALARM.white} opacity={0.8} />
            <Text className="text-[13px] font-semibold uppercase tracking-[3px] text-white/80">{kicker}</Text>
          </View>
          <Text testID="recordatorio-titulo" className="mt-5 text-center text-[32px] font-bold leading-[38px] text-white" numberOfLines={4}>{props.title}</Text>
          {when ? <Text className="mt-4 text-[18px] text-white/90">{when}</Text> : null}
          {countdown ? <Text testID="recordatorio-cuenta" className="mt-1.5 text-[16px] font-semibold" style={{ color: ALARM.warm }}>{countdown}</Text> : null}
          {props.place ? (
            <Pressable testID="btn-recordatorio-ubicacion" accessibilityRole="button" accessibilityLabel={`Cómo llegar a ${props.place}`} onPress={props.onPlace} className="mt-4 min-h-[44px] max-w-full flex-row items-center gap-2 px-3">
              <MapPin size={18} color={ALARM.white} opacity={0.8} />
              <Text className="shrink text-[16px] text-white/85" numberOfLines={2}>{props.place}</Text>
            </Pressable>
          ) : null}
          {note ? <Text className="mt-4 text-center text-[15px] leading-[22px] text-white/70" numberOfLines={4}>{note}</Text> : null}
          {props.chat ? <Text className="mt-2 text-center text-[13px] text-white/55">{props.chat}</Text> : null}
        </View>
        <View className="items-center gap-4">
          {props.canRead ? (
            <Pressable testID="btn-recordatorio-ver" onPress={props.onRead} className="min-h-[44px] flex-row items-center gap-2 px-3">
              <FileText size={16} color={ALARM.white} opacity={0.7} />
              <Text className="text-[15px] text-white/70 underline">Ver recordatorio</Text>
            </Pressable>
          ) : null}
          <Pressable testID="btn-recordatorio-listo" accessibilityRole="button" onPress={props.onDismiss} className="min-h-[60px] w-full items-center justify-center rounded-full border border-white/25 bg-white/10">
            <Text className="text-[18px] font-semibold text-white">Descartar</Text>
          </Pressable>
          <View className="flex-row items-center gap-5">
            {props.canChooseSnooze ? <RoundGlass testID="btn-posponer-menos" label="Menos minutos" onPress={() => setSnooze((minutes) => nextSnooze(minutes, -1))} Icon={Minus} /> : null}
            <Pressable testID="btn-recordatorio-posponer" accessibilityRole="button" onPress={() => props.onSnooze(snooze)} className="min-h-[48px] justify-center px-2">
              <Text className="text-[16px] font-semibold text-white">Posponer {snooze} min</Text>
            </Pressable>
            {props.canChooseSnooze ? <RoundGlass testID="btn-posponer-mas" label="Más minutos" onPress={() => setSnooze((minutes) => nextSnooze(minutes, 1))} Icon={Plus} /> : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function RoundGlass(props: { testID: string; label: string; onPress: () => void; Icon: typeof Plus }) {
  return (
    <Pressable testID={props.testID} accessibilityRole="button" accessibilityLabel={props.label} onPress={props.onPress} className="h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-white/10">
      <props.Icon size={20} color={ALARM.white} />
    </Pressable>
  );
}
