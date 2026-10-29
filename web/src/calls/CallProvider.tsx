import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { CallState } from '@lilachat/shared';
import { CallOverlay } from './CallOverlay';
import { CallLinkFollower } from './CallLinkFollower';
import { startCallTone } from './callTones';
import { useWebCall, type IncomingOffer } from './useWebCall';
import type { GroupCallRoom } from '@lilachat/shared';
import { useWebGroupCall } from './group/useWebGroupCall';
import { GroupCallOverlay, GroupCallStrip, GroupRingCard } from './group/GroupCallOverlay';

type Calls = {
  /** Call from a chat: that chat, with that name, with or without video. */
  call: (chatId: string, peerName: string, video: boolean) => void;
  /** There is a call in course: the buttons do not start another. */
  busy: boolean;
  /** Pending 56: start or join the call of a group or channel. */
  callGroup: (chatId: string, chatName: string, video: boolean) => void;
  groupRooms: ReadonlyMap<string, GroupCallRoom>;
  refreshGroupRoom: (chatId: string) => void;
  me: string;
};

const CallsContext = createContext<Calls>({ call: () => undefined, busy: false, callGroup: () => undefined, groupRooms: new Map(), refreshGroupRoom: () => undefined, me: '' });
export const useCalls = (): Calls => useContext(CallsContext);

/** How long «Llamada terminada» shows before closing; an error stays longer, to be read. */
const CLOSE_AFTER_END_MS = 1_500;
const CLOSE_AFTER_ERROR_MS = 5_000;
const NOTICE_ICON = '/icons/icon-192.png';

/** The ring while it rings; the «tuu… tuu» while I call. */
function useCallTones(state: CallState | null): void {
  // Once the other side says «answering» (backlog 114) the tones stop: it is connecting.
  const ringing = state && (state.fase === 'sonando' || state.fase === 'llamando') && state.answeringAt === undefined ? state.fase : null;
  const tone = ringing === 'sonando' ? 'incoming' : ringing === 'llamando' ? 'outgoing' : null;
  useEffect(() => {
    if (!tone) return;
    // `startCallTone` returns the function that stops it: the effect's cleanup.
    return startCallTone(tone);
  }, [tone]);
}

/**
 * An incoming call with the tab out of sight: a system notice that stays until
 * it is touched or the ring stops. Its click only focuses the tab (`sw.js`):
 * reloading it would drop the call.
 */
function useIncomingCallNotice(ringing: boolean, chatId: string | null, title: string): void {
  useEffect(() => {
    if (!ringing || !chatId || typeof Notification === 'undefined') return;
    if (document.visibilityState !== 'hidden' || Notification.permission !== 'granted') return;
    const tag = `llamada-${chatId}`;
    let fallback: Notification | null = null;
    const options: NotificationOptions = { body: 'Abre Lilachat para contestar.', icon: NOTICE_ICON, tag, requireInteraction: true, data: { call: true } };
    const shown = navigator.serviceWorker?.getRegistration().then((registration) => {
      if (registration) return registration.showNotification(title, options).then(() => registration);
      fallback = new Notification(title, options);
      return undefined;
    });
    return () => {
      fallback?.close();
      void shown?.then((registration) => registration?.getNotifications({ tag })).then((notices) => notices?.forEach((notice) => notice.close())).catch(() => undefined);
    };
  }, [ringing, chatId, title]);
}

/**
 * The calls of the web SESSION, over whatever is open (like the app's
 * `ProveedorDeLlamadas`): it listens from the moment there is a session, and
 * the chat comes from the offer.
 */
export function CallProvider(props: { jwt: string; me: string; connected: boolean; nameOf: (offer: IncomingOffer) => string; photoOf?: (chatId: string) => string | undefined; chatNameOf?: (chatId: string) => string | undefined; children: ReactNode }) {
  const webCall = useWebCall({ jwt: props.jwt, connected: props.connected, nameOf: props.nameOf });
  const { state, session, error, close, call } = webCall;
  useCallTones(state);
  const ringing = state?.fase === 'sonando';
  useIncomingCallNotice(ringing, session?.chatId ?? null, session ? `${session.videoCall ? 'Videollamada' : 'Llamada'} de ${session.peerName}` : '');
  // A call that ended without the close being touched (missed, the other hung up) closes alone.
  const ended = state?.fase === 'terminada';
  useEffect(() => {
    if (!ended) return;
    const timer = window.setTimeout(close, error ? CLOSE_AFTER_ERROR_MS : CLOSE_AFTER_END_MS);
    return () => window.clearTimeout(timer);
  }, [ended, error, close]);
  const group = useWebGroupCall({ jwt: props.jwt, me: props.me, connected: props.connected });
  const busy = Boolean(state && state.fase !== 'terminada') || group.call !== null;
  const { join: joinGroup, rooms: groupRooms, refreshRoom: refreshGroupRoom } = group;
  const value = useMemo<Calls>(
    () => ({ call: (chatId, peerName, video) => void call(chatId, peerName, video), busy, callGroup: (chatId, chatName, video) => void joinGroup(chatId, chatName, video), groupRooms, refreshGroupRoom, me: props.me }),
    [call, busy, joinGroup, groupRooms, refreshGroupRoom, props.me]
  );
  const ringName = group.ring ? (props.chatNameOf?.(group.ring.chatId) ?? 'Grupo') : '';
  return (
    <CallsContext.Provider value={value}>
      {props.children}
      {/* A call link that opened the web (pending 42) waits for the session, here. */}
      <CallLinkFollower jwt={props.jwt} onCall={value.call} />
      {state && session ? <CallOverlay call={webCall} peerPhoto={props.photoOf?.(session.chatId)} /> : null}
      <GroupCallOverlay group={group} me={props.me} />
      {group.ring && !busy ? (
        <GroupRingCard title={ringName} subtitle={`${group.ring.fromName?.trim() || 'Alguien'} inició una ${group.ring.video ? 'videollamada' : 'llamada'} grupal`} video={group.ring.video} onIgnore={group.ignoreRing} onJoin={() => void joinGroup(group.ring!.chatId, ringName, group.ring!.video)} />
      ) : null}
      {group.error ? (
        <div role="alert" data-testid="error-llamada-grupal" className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-on-surface px-4 py-2.5 text-[14px] text-background shadow-xl">
          {group.error}
          <button type="button" onClick={group.clearError} className="font-semibold underline">Cerrar</button>
        </div>
      ) : null}
    </CallsContext.Provider>
  );
}

/** The strip «Unirse» over a group chat while its call goes on (pending 56). */
export function GroupCallStripFor(props: { chatId: string; chatName: string }) {
  const { groupRooms, refreshGroupRoom, callGroup, busy, me } = useCalls();
  useEffect(() => {
    refreshGroupRoom(props.chatId);
  }, [props.chatId, refreshGroupRoom]);
  const room = groupRooms.get(props.chatId) ?? null;
  return <GroupCallStrip room={room} me={me} busy={busy} onJoin={() => callGroup(props.chatId, props.chatName, room?.video ?? false)} />;
}
