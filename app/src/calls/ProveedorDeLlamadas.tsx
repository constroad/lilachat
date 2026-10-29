import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { nombreDeContacto } from '@lilachat/shared';
import { chatsEnMemoria } from '../chat/chatsGuardados';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { CallScreen } from './CallScreen';
import { CallPill } from './CallControls';
import { leyendaDeLlamada } from './estadoDeMedios';
import type { EstadoDeMedios } from './estadoDeMedios';
import type { CallState } from '@lilachat/shared';
import { useCall, type AutorDeLlamada } from './useCall';
import { llamadaNativa } from '../../modules/llamada-entrante/src';
import { BASE_URL } from '../api/client';
import { groupCallBanner, type GroupCallRoom } from '@lilachat/shared';
import { Pressable, Text, View } from 'react-native';
import { Users } from 'lucide-react-native';
import { useColores } from '../ui/tema';
import { useGroupCall } from './group/useGroupCall';
import { GroupCallPill, GroupCallScreen, GroupRingCard } from './group/GroupCallScreen';

type Llamadas = {
  /** Llamar desde un chat: ese chat, con ese nombre, con o sin video. */
  llamar: (chatId: string, nombre: string, conVideo: boolean) => void;
  /** There is a call on screen (ringing, dialing, active or ending): the app must not reload under it. */
  hayLlamada: boolean;
  /** Pending 56: start or join the call of a group or channel. */
  callGroup: (chatId: string, name: string, video: boolean) => void;
  /** The group's call going on now, for the strip «Unirse» over the chat. */
  groupRooms: ReadonlyMap<string, GroupCallRoom>;
  refreshGroupRoom: (chatId: string) => void;
};

const LlamadasContext = createContext<Llamadas>({ llamar: () => undefined, hayLlamada: false, callGroup: () => undefined, groupRooms: new Map(), refreshGroupRoom: () => undefined });

/** Cuánto se ve «Llamada terminada» antes de cerrarse sola. */
const CIERRE_AL_TERMINAR_MS = 1_500;

export const useLlamadas = (): Llamadas => useContext(LlamadasContext);

/**
 * Las llamadas de la SESIÓN (FL8). Antes cada `ChatScreen` tenía su propia
 * llamada y solo escuchaba su chat: una llamada sonaba únicamente si el otro
 * tenía esa conversación abierta. Ahora se escucha desde que hay sesión, la
 * pantalla de llamada se muestra encima de lo que esté abierto, y el chat sale
 * de la oferta.
 */
export function ProveedorDeLlamadas({ jwt, me, children, onOpenChat }: { jwt: string; me: string; children: ReactNode; onOpenChat?: (chatId: string) => void }) {
  // Del chat cargado; si todavía no está (se abrió desde el push, o el chat es
  // nuevo), de lo que la oferta trae de quien llama.
  const nombreDe = useCallback((chatId: string, autor?: AutorDeLlamada) => {
    const chat = chatsEnMemoria()?.find((uno) => uno.id === chatId);
    const delServidor = chat ? chat.name : autor?.nombre;
    const telefono = chat ? chat.phone : autor?.telefono;
    return nombreDeContacto({ delServidor, telefono, agenda: agendaPorTelefono() }) || 'Llamada';
  }, []);
  const llamada = useCall({ jwt, nombreDe });
  const { llamar: llamarConHook, cerrar, aplicarAviso } = llamada;

  // FL8.1: la notificación nativa de llamada. La URL del server queda guardada
  // para rechazar con la app cerrada; lo tocado antes de abrir (arranque en
  // frío) se lee una vez, y lo que se toque después llega por el evento.
  useEffect(() => {
    llamadaNativa.configurar(BASE_URL);
    const inicial = llamadaNativa.accionPendiente();
    if (inicial) aplicarAviso(inicial);
    const suscripcion = llamadaNativa.alTocar(aplicarAviso);
    return () => suscripcion.remove();
  }, [aplicarAviso]);

  // Una llamada que terminó SIN que se tocara colgar —perdida, o el otro
  // cortó— quedaba en «Llamada terminada» para siempre. Se cierra sola.
  const terminada = llamada.state?.fase === 'terminada';
  useEffect(() => {
    if (!terminada) return;
    const temporizador = setTimeout(cerrar, CIERRE_AL_TERMINAR_MS);
    return () => clearTimeout(temporizador);
  }, [terminada, cerrar]);
  const group = useGroupCall({ jwt, me });
  const [groupMinimized, setGroupMinimized] = useState(false);
  const inGroupCall = group.call !== null;
  useEffect(() => {
    if (!inGroupCall) setGroupMinimized(false);
  }, [inGroupCall]);
  const hayLlamada = llamada.state !== null || inGroupCall;
  // Pending 106: minimized, the call goes on under a pill; a call that rings, or ends, always shows.
  const [minimized, setMinimized] = useState(false);
  const fase = llamada.state?.fase;
  useEffect(() => {
    if (fase !== 'activa' && fase !== 'llamando') setMinimized(false);
  }, [fase]);
  const chatDeLaLlamada = llamada.chatId;
  const sendMessage = useMemo(
    () => (onOpenChat && chatDeLaLlamada ? () => { setMinimized(true); onOpenChat(chatDeLaLlamada); } : undefined),
    [onOpenChat, chatDeLaLlamada]
  );
  const valor = useMemo<Llamadas>(
    () => ({
      llamar: (chatId, nombre, conVideo) => void llamarConHook(chatId, nombre, conVideo),
      hayLlamada,
      callGroup: (chatId, name, video) => void group.join(chatId, name, video),
      groupRooms: group.rooms,
      refreshGroupRoom: group.refreshRoom,
    }),
    [llamarConHook, hayLlamada, group.join, group.rooms, group.refreshRoom]
  );
  const ringChatName = group.ring ? (group.ring.chatName || chatsEnMemoria()?.find((uno) => uno.id === group.ring?.chatId)?.name || '') : '';

  return (
    <LlamadasContext.Provider value={valor}>
      {children}
      {group.ring && !llamada.state && !inGroupCall ? (
        <GroupRingCard ring={group.ring} chatName={ringChatName} onIgnore={group.ignoreRing} onJoin={() => void group.join(group.ring!.chatId, ringChatName || 'Grupo', group.ring!.video)} />
      ) : null}
      {inGroupCall && groupMinimized ? <GroupCallPill group={group} onRestore={() => setGroupMinimized(false)} /> : null}
      {inGroupCall && !groupMinimized ? <GroupCallScreen group={group} me={me} onMinimize={() => setGroupMinimized(true)} /> : null}
      {llamada.state && minimized ? (
        <MinimizedCall state={llamada.state} medios={llamada.medios} video={llamada.video} peerName={llamada.peerName} onRestore={() => setMinimized(false)} />
      ) : null}
      {llamada.state && !minimized ? (
        <CallScreen
          visible
          state={llamada.state}
          medios={llamada.medios}
          peerName={llamada.peerName}
          peerPhoto={chatsEnMemoria()?.find((uno) => uno.id === llamada.chatId)?.avatarUrl}
          video={llamada.video}
          puedeAlternarVideo={llamada.conVideoDesdeElInicio}
          muted={llamada.muted}
          speaker={llamada.speaker}
          localStream={llamada.localStream}
          remoteStream={llamada.remoteStream}
          onToggleMute={llamada.alternarMute}
          noiseSuppression={llamada.noiseSuppression}
          onNoiseSuppression={llamada.setNoiseSuppression}
          onToggleSpeaker={llamada.alternarAltavoz}
          onToggleVideo={llamada.alternarVideo}
          facing={llamada.facing}
          onSwitchCamera={llamada.switchCamera}
          reaction={llamada.reaction}
          onSendReaction={llamada.sendReaction}
          onReactionDone={llamada.clearReaction}
          onAccept={llamada.contestar}
          onMinimize={() => setMinimized(true)}
          onSendMessage={sendMessage}
          notice={llamada.notice}
          // Colgar pasa a «terminada» y el efecto de arriba la cierra: un
          // instante a la vista, porque desaparecer de golpe se siente como
          // que se cortó sola.
          onHangUp={llamada.colgar}
        />
      ) : null}
    </LlamadasContext.Provider>
  );
}

/** The pill of a minimized call, with its clock ticking (pending 106). */
function MinimizedCall(props: { state: CallState; medios: EstadoDeMedios; video: boolean; peerName: string; onRestore: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <CallPill peerName={props.peerName} caption={leyendaDeLlamada({ state: props.state, medios: props.medios, video: props.video, ahora: now })} onPress={props.onRestore} />;
}

/** Over a group chat while its call goes on: who is in it, and «Unirse» (pending 56). */
export function GroupCallStrip(props: { chatId: string; chatName: string; me: string }) {
  const { groupRooms, refreshGroupRoom, callGroup, hayLlamada } = useLlamadas();
  const colors = useColores();
  useEffect(() => {
    refreshGroupRoom(props.chatId);
  }, [props.chatId, refreshGroupRoom]);
  const banner = groupCallBanner(groupRooms.get(props.chatId) ?? null, props.me);
  if (!banner) return null;
  const room = groupRooms.get(props.chatId)!;
  return (
    <View testID="franja-llamada-grupal" className="flex-row items-center gap-3 border-b border-outline-variant bg-en-linea/10 px-4 py-2">
      <Users size={18} color={colors.primary} />
      <Text className="min-w-0 flex-1 text-[14px] font-semibold text-on-surface" numberOfLines={1}>{banner.text}</Text>
      {banner.canJoin && !hayLlamada ? (
        <Pressable testID="btn-unirse-franja" accessibilityLabel="Unirse a la llamada" onPress={() => callGroup(props.chatId, props.chatName, room.video)} className="rounded-full bg-en-linea px-4 py-1.5">
          <Text className="text-[14px] font-bold text-white">Unirse</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
