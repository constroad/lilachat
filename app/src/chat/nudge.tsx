import { useEffect, useRef } from 'react';
import { Text, Vibration, View } from 'react-native';
import { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Vibrate } from 'lucide-react-native';
import { getSocket } from './socketClient';
import { highestSeq, nudgeToShake } from '@lilachat/shared';
import { useColores } from '../ui/tema';

const SEND_TIMEOUT_MS = 8000;
/** How far and how long the chat shakes (spec, backlog 3: ±12 dp for 600 ms). */
const SHAKE_DP = 12;
const SHAKE_STEP_MS = 75;
const VIBRATION_PATTERN = [0, 180, 90, 180];

/** The MSN nudge (backlog 3): straight to the server, with its refusal (the 10-second limit) told back. */
export async function sendNudge(chatId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const socket = getSocket();
  if (!socket?.connected) return { ok: false, reason: 'Sin conexión: el zumbido no salió.' };
  try {
    const ack = (await socket.timeout(SEND_TIMEOUT_MS).emitWithAck('msg.send', { chatId, clientKey: `zumbido-${Date.now().toString(36)}`, kind: 'zumbido' })) as { ok?: boolean; message?: string };
    return ack?.ok ? { ok: true } : { ok: false, reason: ack?.message ?? 'El zumbido no salió.' };
  } catch {
    return { ok: false, reason: 'El zumbido no salió. Prueba de nuevo.' };
  }
}

/** Shakes (and vibrates) the open chat when the other person's nudge arrives; never for what was already there. */
export function useNudgeShake(messages: readonly { seq: number; kind?: string; senderId: string }[], me: string) {
  const offset = useSharedValue(0);
  const seen = useRef<number | null>(null);
  useEffect(() => {
    if (seen.current === null) {
      seen.current = highestSeq(messages);
      return;
    }
    const nudge = nudgeToShake(messages, me, seen.current);
    seen.current = Math.max(seen.current, highestSeq(messages));
    if (nudge === null) return;
    Vibration.vibrate(VIBRATION_PATTERN);
    offset.value = withSequence(
      withTiming(-SHAKE_DP, { duration: SHAKE_STEP_MS }),
      withTiming(SHAKE_DP, { duration: SHAKE_STEP_MS }),
      withTiming(-SHAKE_DP, { duration: SHAKE_STEP_MS }),
      withTiming(SHAKE_DP, { duration: SHAKE_STEP_MS }),
      withTiming(-SHAKE_DP / 2, { duration: SHAKE_STEP_MS }),
      withTiming(SHAKE_DP / 2, { duration: SHAKE_STEP_MS }),
      withTiming(-SHAKE_DP / 4, { duration: SHAKE_STEP_MS }),
      withTiming(0, { duration: SHAKE_STEP_MS })
    );
  }, [messages, me, offset]);
  return useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
}

/** «Ana te mandó un zumbido» / «Mandaste un zumbido», centered like the group notices. */
export function NudgeLine(props: { mine: boolean; author?: string }) {
  const palette = useColores();
  return (
    <View testID="linea-zumbido" className="my-1.5 flex-row items-center gap-1.5 self-center rounded-full bg-primary/10 px-3 py-1.5">
      <Vibrate size={14} color={palette.primary} />
      <Text className="text-[13px] font-semibold text-primary">{props.mine ? 'Mandaste un zumbido' : `${props.author || 'Te'} ${props.author ? 'te mandó' : 'mandaron'} un zumbido`}</Text>
    </View>
  );
}
