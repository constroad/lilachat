import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Pressable, Text, Vibration, View } from 'react-native';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { Heart, Play, Vibrate } from 'lucide-react-native';
import { WinkCharacter } from './WinkCharacter';
import { funSeenFloor, rememberFunSeen, rememberRowPlayed, rowPlayedSeq, useFunLedgerReady } from './funSeen';
import { getSocket } from './socketClient';
import { chatsEnMemoria, suscribirChatsEnMemoria } from './chatsGuardados';
import { funAvailable } from './funAvailable';
import { playWinkCues, shakeScreen, startWink, stopFun } from './FunScreen';
import { closeEmojiPanel } from './emojiPanel';
import { FUN_LIVE_MS, NUDGE_SHAKE, formatClock, funMessageToPlay, funToPlayInRow, highestSeq, shouldPlayFun, winkById, winkCardLines, winkTileIsProp, type FunPlace, type FunToPlay, type WinkId } from '@lilachat/shared';
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
type ReplayListener = (fun: FunToPlay) => void;
const replayListeners = new Set<ReplayListener>();
export function replayWink(seq: number, wink: WinkId): void {
  replayListeners.forEach((listener) => listener({ seq, kind: 'guino', wink, mine: true }));
}
/** «Ver otra vez» on a nudge (José, 21/10: «no hay forma de reproducir el zumbido» without sending another). */
export function replayNudge(seq: number): void {
  replayListeners.forEach((listener) => listener({ seq, kind: 'zumbido', mine: true }));
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
 * wink pops it. Not while that chat is open (the chat plays it), not muted,
 * and only while it is live and not played here yet (pending 107: the list
 * reloads, remounts and recycles rows, and an old nudge shook them again).
 */
export function useFunInRow(chat: { id: string; muted?: boolean; lastMessage: { seq: number; kind?: string; senderId: string; at?: string; deletedAt?: string } | null }, me: string, open: boolean) {
  const reducedMotion = useReducedMotion();
  const offset = useSharedValue(0);
  const scale = useSharedValue(1);
  const ready = useFunLedgerReady();
  const { lastMessage, id } = chat;
  useEffect(() => {
    if (open || !ready || !lastMessage) return;
    const arrived = funToPlayInRow({ last: lastMessage, me, playedSeq: rowPlayedSeq(id), now: Date.now() });
    if (!arrived) return;
    rememberRowPlayed(id, lastMessage.seq);
    console.log(`[fun] ${arrived} ${lastMessage.seq} plays in the row of ${id}`);
    const how = shouldPlayFun({ muted: chat.muted === true, reducedMotion, place: 'row' });
    if (how.vibrate) Vibration.vibrate(arrived === 'zumbido' ? NUDGE_VIBRATION : WINK_VIBRATION);
    if (!how.animate) return;
    if (arrived === 'zumbido') shakeRow(offset);
    else scale.value = withSequence(...[POP_SCALE, 1, POP_SCALE, 1].map((value) => withTiming(value, { duration: POP_STEP_MS })));
  }, [lastMessage, id, me, open, ready, chat.muted, reducedMotion, offset, scale]);
  return useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }, { scale: scale.value }] }));
}

/**
 * Plays nudges and winks of the open chat: the one that came while it was
 * closed plays once on opening (`afterSeq` = what I had read), and each new one
 * when it arrives. A nudge shakes the WHOLE screen, a wink plays over it
 * (`FunScreen`). In the open chat it always plays, a muted one only without
 * sound; «Ver otra vez» plays it whole (`shouldPlayFun`). What I had read is
 * taken once, when the chat opens: the list marks it read right away, and
 * reading it later made the wink count as already seen. What this phone already
 * played (saved, `funSeen`) raises that floor, so nothing replays after a
 * restart; until it is read from storage nothing plays.
 */
export function useFunPlayback(params: { messages: readonly { seq: number; kind?: string; senderId: string; wink?: string; at?: string }[]; me: string; chatId: string; afterSeq: number }): void {
  const muted = useChatMuted(params.chatId);
  const reducedMotion = useReducedMotion();
  const seen = useRef<number | null>(null);
  const readAtOpen = useRef(params.afterSeq).current;
  const ready = useFunLedgerReady();
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
  const { messages, me, chatId } = params;
  useEffect(() => {
    if (!ready || messages.length === 0) return;
    // The first look at the chat plays only what someone sent me; mine plays when it goes, live.
    const opening = seen.current === null;
    seen.current ??= funSeenFloor(chatId, readAtOpen);
    // Mine plays live only if it was just sent: the history that arrives after opening is not live.
    const fun = funMessageToPlay(messages, me, seen.current, { mineToo: !opening, mineSince: Date.now() - FUN_LIVE_MS });
    seen.current = Math.max(seen.current, highestSeq(messages));
    rememberFunSeen(chatId, seen.current);
    if (!fun) return;
    // One line per automatic play: «it played again» is answered by logcat (pending 107).
    console.log(`[fun] ${fun.kind} ${fun.seq} plays in chat ${chatId}`);
    play(fun, 'chat');
  }, [ready, messages, me, chatId, readAtOpen, play]);
  useEffect(() => {
    const listener: ReplayListener = (fun) => play(fun, 'replay');
    replayListeners.add(listener);
    return () => {
      replayListeners.delete(listener);
    };
  }, [play]);
  // Leaving the chat ends what plays (José, 21/10: «incluso fuera del chat se reproduce»).
  useEffect(() => stopFun, []);
}

/**
 * What the chat offers: nudge and winks (both in the emoji panel). In a 1:1 always; in
 * a group only if an admin switched them on (the server checks it too); never
 * in a draft or the chat with yourself.
 */
export function useFunActions(params: { chatId: string; isGroup: boolean; isDraft: boolean; detailAllows?: boolean; onError: (text: string) => void }): { onNudge?: () => void; onWink?: (wink: WinkId) => void } {
  const listAllows = useSyncExternalStore(suscribirChatsEnMemoria, () => chatsEnMemoria()?.find((chat) => chat.id === params.chatId)?.funAllowed);
  const allowed = funAvailable({ isDraft: params.isDraft, isGroup: params.isGroup, detailAllows: params.detailAllows, listAllows });
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

/**
 * Nudges and winks sit on the side of who sent them, like messages (José, 21/10:
 * centered, «no se sabe quién los mandó»): mine on the right in the bubble's
 * tint, theirs on the left.
 */
const sideOf = (mine: boolean) => (mine ? 'self-end bg-primary/10' : 'self-start bg-surface');

/** «Ana te mandó un zumbido» / «Mandaste un zumbido». */
export function NudgeLine(props: { seq: number; mine: boolean; author?: string; at?: string }) {
  const palette = useColores();
  return (
    <View testID="linea-zumbido" className={`my-1.5 max-w-[88%] flex-row flex-wrap items-center gap-x-2 gap-y-0.5 rounded-2xl border border-primary/20 px-3 py-1.5 ${sideOf(props.mine)}`}>
      <View className="h-6 w-6 items-center justify-center rounded-full bg-primary">
        <Vibrate size={13} color={palette['on-primary']} />
      </View>
      <Text className="text-[13px] font-semibold text-on-surface">{props.mine ? 'Mandaste un zumbido' : `${props.author || 'Te'} ${props.author ? 'te mandó' : 'mandaron'} un zumbido`}</Text>
      {props.at ? <Text className="text-[11px] text-on-surface-variant">{formatClock(props.at)}</Text> : null}
      <Pressable testID={`ver-zumbido-${props.seq}`} hitSlop={12} onPress={() => replayNudge(props.seq)} className="min-h-[28px] justify-center">
        <Text className="text-[13px] font-bold text-primary underline">Ver otra vez</Text>
      </Pressable>
    </View>
  );
}

/** The wink's thumbnail in its card (dp); a character (240 × 320) fits by its height, a prop (square) by its side. */
const WINK_THUMB = 64;

/**
 * A wink in the chat as a card with its THUMBNAIL (José, 21/10: a thumbnail to
 * see which wink it was): the character (or the emoji)
 * on the left, who sent it and which wink on the right, and «Ver otra vez».
 */
export function WinkLine(props: { seq: number; wink?: string; mine: boolean; author?: string; at?: string }) {
  const palette = useColores();
  const known = winkById(props.wink);
  const lines = winkCardLines({ wink: props.wink, mine: props.mine, author: props.author, time: props.at ? formatClock(props.at) : undefined });
  return (
    <View testID={`linea-guino-${props.seq}`} className={`my-2 w-[300px] max-w-[88%] flex-row items-center gap-3 rounded-2xl border border-primary/20 p-2.5 ${sideOf(props.mine)}`}>
      <View className="items-center justify-center overflow-hidden rounded-xl bg-primary/10" style={{ width: WINK_THUMB, height: WINK_THUMB }}>
        {known?.kind === 'character' ? <WinkCharacter wink={known} size={winkTileIsProp(known) ? WINK_THUMB - 12 : WINK_THUMB * 0.62} /> : known ? <Text style={{ fontSize: 30 }}>{known.hero}</Text> : <Heart size={22} color={palette.primary} />}
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-[14px] font-semibold text-on-surface">{lines.who}</Text>
        {lines.detail ? <Text className="text-[12px] text-on-surface-variant">{lines.detail}</Text> : null}
        {known ? (
          <Pressable testID={`ver-guino-${props.seq}`} hitSlop={10} onPress={() => replayWink(props.seq, known.id)} className="mt-1 h-8 flex-row items-center gap-1.5 self-start rounded-full border border-outline/20 px-3">
            <Play size={13} color={palette.primary} />
            <Text className="text-[13px] font-semibold text-primary">Ver otra vez</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
