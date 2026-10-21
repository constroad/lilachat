import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Pressable, Text, Vibration, View } from 'react-native';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { Heart, Vibrate } from 'lucide-react-native';
import { getSocket } from './socketClient';
import { chatsEnMemoria, suscribirChatsEnMemoria } from './chatsGuardados';
import { playWinkCues, shakeScreen, startWink } from './FunScreen';
import { closeEmojiPanel } from './emojiPanel';
import { NUDGE_SHAKE, formatClock, funArrivedInRow, funMessageToPlay, funNoticeText, highestSeq, shouldPlayFun, winkById, type FunPlace, type FunToPlay, type WinkId } from '@lilachat/shared';
import { useColores } from '../ui/tema';

const SEND_TIMEOUT_MS = 8000;
/** A row of the chat list shakes softer than the whole screen (`NUDGE_SHAKE` is for the screen). */
const ROW_SHAKE_DP = 12;
/** About 2 s of pulses, as long as the shake (José, 21/10: «bájalo a 2 seg»). */
const NUDGE_VIBRATION = [0, 230, 100, 230, 100, 230, 100, 230, 100, 230, 100, 230];
/** A wink in the chat list: the row pops twice. */
const POP_SCALE = 1.03;
const POP_STEP_MS = 120;
const WINK_VIBRATION = [0, 60, 60, 60];

/** A nudge or a wink straight to the server, with its refusal (limit, group setting) told back. */
async function sendFun(chatId: string, payload: { kind: 'zumbido' } | { kind: 'guino'; wink: WinkId }, what: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const socket = getSocket();
  if (!socket?.connected) return { ok: false, reason: `Sin conexión: ${what} no salió.` };
  try {
    const ack = (await socket.timeout(SEND_TIMEOUT_MS).emitWithAck('msg.send', { chatId, clientKey: `${payload.kind}-${Date.now().toString(36)}`, ...payload })) as { ok?: boolean; message?: string };
    return ack?.ok ? { ok: true } : { ok: false, reason: ack?.message ?? `${what} no salió.` };
  } catch {
    return { ok: false, reason: `${what} no salió. Prueba de nuevo.` };
  }
}

/** The MSN nudge (backlog 3). */
export const sendNudge = (chatId: string) => sendFun(chatId, { kind: 'zumbido' }, 'El zumbido');
/** A wink (José, 21/10). */
export const sendWink = (chatId: string, wink: WinkId) => sendFun(chatId, { kind: 'guino', wink }, 'El guiño');

/** «Ver otra vez» in a wink's line asks the open chat to play it again. */
type ReplayListener = (seq: number, wink: WinkId) => void;
const replayListeners = new Set<ReplayListener>();
export function replayWink(seq: number, wink: WinkId): void {
  replayListeners.forEach((listener) => listener(seq, wink));
}

/** Whether I muted this chat, live from the chat list. */
function useChatMuted(chatId: string): boolean {
  return useSyncExternalStore(suscribirChatsEnMemoria, () => chatsEnMemoria()?.find((chat) => chat.id === chatId)?.muted === true);
}

/** The same 2-second path as the screen, smaller and only sideways for one row (José, 21/10: «en la lista solo en el eje x»). */
function shakeRow(offset: SharedValue<number>): void {
  offset.value = withSequence(...NUDGE_SHAKE.path.map((x) => withTiming(x * ROW_SHAKE_DP, { duration: NUDGE_SHAKE.stepMs })));
}

/**
 * The row of the chat list when a nudge or wink arrives (José, 21/10: «en la
 * lista de chats el card item no se mueve»): a nudge shakes it and vibrates, a
 * wink pops it. Not while that chat is open (the chat plays it), not muted.
 */
export function useFunInRow(chat: { id: string; muted?: boolean; lastMessage: { seq: number; kind?: string; senderId: string } | null }, me: string, open: boolean) {
  const reducedMotion = useReducedMotion();
  const offset = useSharedValue(0);
  const scale = useSharedValue(1);
  const lastSeq = useRef<number | undefined>(undefined);
  const { lastMessage } = chat;
  useEffect(() => {
    const arrived = open ? null : funArrivedInRow(lastSeq.current, lastMessage, me);
    lastSeq.current = lastMessage?.seq ?? lastSeq.current ?? 0;
    if (!arrived) return;
    const how = shouldPlayFun({ muted: chat.muted === true, reducedMotion, place: 'row' });
    if (how.vibrate) Vibration.vibrate(arrived === 'zumbido' ? NUDGE_VIBRATION : WINK_VIBRATION);
    if (!how.animate) return;
    if (arrived === 'zumbido') shakeRow(offset);
    else scale.value = withSequence(...[POP_SCALE, 1, POP_SCALE, 1].map((value) => withTiming(value, { duration: POP_STEP_MS })));
  }, [lastMessage, me, open, chat.muted, reducedMotion, offset, scale]);
  return useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }, { scale: scale.value }] }));
}

/**
 * Plays nudges and winks of the open chat: the one that came while it was
 * closed plays once on opening (`afterSeq` = what I had read), and each new one
 * when it arrives. A nudge shakes the WHOLE screen, a wink plays over it
 * (`FunScreen`). In the open chat it always plays, a muted one only without
 * sound; «Ver otra vez» plays it whole (`shouldPlayFun`). What I had read is
 * taken once, when the chat opens: the list marks it read right away, and
 * reading it later made the wink count as already seen.
 */
export function useFunPlayback(params: { messages: readonly { seq: number; kind?: string; senderId: string; wink?: string }[]; me: string; chatId: string; afterSeq: number }): void {
  const muted = useChatMuted(params.chatId);
  const reducedMotion = useReducedMotion();
  const seen = useRef<number | null>(null);
  const readAtOpen = useRef(params.afterSeq).current;
  const play = useCallback(
    (fun: FunToPlay, place: FunPlace) => {
      const how = shouldPlayFun({ muted, reducedMotion, place });
      if (fun.kind === 'zumbido') {
        if (how.vibrate) Vibration.vibrate(NUDGE_VIBRATION);
        if (how.animate) shakeScreen();
        return;
      }
      const wink = winkById(fun.wink);
      if (!wink) return;
      playWinkCues(wink, how);
      if (how.vibrate && !fun.mine) Vibration.vibrate(WINK_VIBRATION);
      if (how.animate) startWink({ seq: fun.seq, wink });
    },
    [muted, reducedMotion]
  );
  const { messages, me } = params;
  useEffect(() => {
    if (messages.length === 0) return;
    seen.current ??= readAtOpen;
    const fun = funMessageToPlay(messages, me, seen.current);
    seen.current = Math.max(seen.current, highestSeq(messages));
    if (fun) play(fun, 'chat');
  }, [messages, me, readAtOpen, play]);
  useEffect(() => {
    const listener: ReplayListener = (seq, wink) => play({ seq, kind: 'guino', wink, mine: true }, 'replay');
    replayListeners.add(listener);
    return () => {
      replayListeners.delete(listener);
    };
  }, [play]);
}

/**
 * What the chat offers: nudge and winks (both in the emoji panel). In a 1:1 always; in
 * a group only if an admin switched them on (the server checks it too); never
 * in a draft or the chat with yourself.
 */
export function useFunActions(params: { chatId: string; isGroup: boolean; isDraft: boolean; onError: (text: string) => void }): { onNudge?: () => void; onWink?: (wink: WinkId) => void } {
  const funAllowed = useSyncExternalStore(suscribirChatsEnMemoria, () => chatsEnMemoria()?.find((chat) => chat.id === params.chatId)?.funAllowed === true);
  const allowed = !params.isDraft && (!params.isGroup || funAllowed);
  const { chatId, onError } = params;
  return useMemo(
    () =>
      allowed
        ? {
            onNudge: () => void sendNudge(chatId).then((result) => result.ok || onError(result.reason)),
            onWink: (wink: WinkId) =>
              void sendWink(chatId, wink).then((result) => {
                if (result.ok) closeEmojiPanel(false);
                else onError(result.reason);
              }),
          }
        : {},
    [allowed, chatId, onError]
  );
}

/** «Ana te mandó un zumbido» / «Mandaste un zumbido», centered like the group notices. */
export function NudgeLine(props: { mine: boolean; author?: string; at?: string }) {
  const palette = useColores();
  return (
    <View testID="linea-zumbido" className="my-1.5 max-w-[88%] flex-row flex-wrap items-center justify-center gap-x-2 gap-y-0.5 self-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5">
      <View className="h-6 w-6 items-center justify-center rounded-full bg-primary">
        <Vibrate size={13} color={palette['on-primary']} />
      </View>
      <Text className="text-[13px] font-semibold text-on-surface">{props.mine ? 'Mandaste un zumbido' : `${props.author || 'Te'} ${props.author ? 'te mandó' : 'mandaron'} un zumbido`}</Text>
      {props.at ? <Text className="text-[11px] text-on-surface-variant">{formatClock(props.at)}</Text> : null}
    </View>
  );
}

/** «Ana te mandó un guiño · Corazones · Ver otra vez» (José, 21/10). */
export function WinkLine(props: { seq: number; wink?: string; mine: boolean; author?: string; at?: string }) {
  const palette = useColores();
  const known = winkById(props.wink);
  return (
    <View testID={`linea-guino-${props.seq}`} className="my-1.5 max-w-[88%] flex-row flex-wrap items-center justify-center gap-x-2 gap-y-0.5 self-center rounded-2xl border border-primary/20 bg-primary/10 px-3 py-1.5">
      <View className="h-6 w-6 items-center justify-center rounded-full bg-primary">
        <Heart size={13} color={palette['on-primary']} />
      </View>
      <Text className="flex-shrink text-[13px] font-semibold text-on-surface">{funNoticeText({ kind: 'guino', wink: props.wink, mine: props.mine, author: props.author })}</Text>
      {props.at ? <Text className="text-[11px] text-on-surface-variant">{formatClock(props.at)}</Text> : null}
      {known ? (
        <Pressable testID={`ver-guino-${props.seq}`} hitSlop={12} onPress={() => replayWink(props.seq, known.id)} className="min-h-[28px] justify-center">
          <Text className="text-[13px] font-bold text-primary underline">Ver otra vez</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
