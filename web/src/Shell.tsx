import { CreateChecklistOverlay } from './agenda/CreateChecklistOverlay';
import { WEB_BUILD, webVersionLabel } from './ui/webVersion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatRail } from './chat/ChatRail';
import { ListResizeHandle } from './chat/ListResizeHandle';
import { readThemeChoice, saveThemeChoice, type ThemeChoice } from './ui/tema';
import { Bell, BellOff, Download, LogOut, UsersRound, WifiOff, X } from 'lucide-react';
import { useDismiss } from './ui/useDismiss';
import { useSinConexion } from './pwa/conexion';
import { useInstalarApp } from './pwa/instalar';
import type { Credential } from './api';
import { AgendaOverlay } from './agenda/AgendaOverlay';
import { CreateEventOverlay, CreatePollOverlay, NewChatOverlay, type ChatDestino } from './agenda/CreatePanels';
import { CrearRecordatorio } from './agenda/CrearRecordatorio';
import { ListaDeDestacados } from './chat/destacados/ListaDeDestacados';
import { callerName, type AgendaReminder } from '@lilachat/shared';
import { ChatList } from './chat/ChatList';
import { ConversacionConAcciones } from './chat/ConversacionConAcciones';
import { EmptyState } from './chat/EmptyState';
import { NuevoBorrador } from './chat/NuevoBorrador';
import { ordenarParaLaLista } from './chat/listaDeChats';
import { chatsSinLeer, tituloDeLaPestana } from './chat/tituloDeLaPestana';
import type { ChatMessage, ChatSummary } from './chat/types';
import { useChatDeLaUrl } from './chat/useChatDeLaUrl';
import { useOpenChatWhenReady } from './chat/useOpenChatWhenReady';
import { clampListWidth, LIST_DEFAULT_WIDTH, resolveVisiblePanel } from './layout';
import { useBaseLocal, useChatsLocales, useMensajesEnPantalla } from './local/useBaseLocal';
import { disablePush, enablePush, pushState } from './push';
import { puedeAbrirSocket } from './sesionLista';
import { useAccionesSobreChats } from './sync/accionesSobreChats';
import { TAMANO_DE_PAGINA, useSincronizacion } from './sync/useSincronizacion';
import { useSocket } from './useSocket';
import { ChatFontChoice, GroupsAsListChoice, PresenceChoice } from './ui/settingsChoices';
import { StorageChoice } from './storage/StorageChoice';
import { WhatsNewDialog } from './ui/WhatsNewDialog';
import { chatNameWithAgenda } from './contacts/phoneAgenda';
import { useAgendaRelay } from './contacts/useAgendaRelay';
import { AppRail } from './rail/AppRail';
import { MediaDialog } from './media/MediaDialog';
import { SpaceChatList } from './spaces/SpaceChatList';
import { useSuperadmin } from './admin/adminApi';
import { CallProvider } from './calls/CallProvider';
import { CallsHistory } from './calls/CallsDialog';
import type { IncomingOffer } from './calls/useWebCall';
import { useSpacesWeb } from './spaces/useSpacesWeb';
import { forgetPendingInChats, refreshPendingInChats } from './chat/queue/pendingInChats';
import { membersChanged } from './spaces/spaceCache';
import type { SpaceChatEvent } from './spaces/useSpacesWeb';

/** Cuánto dura un aviso corto en pantalla. */
const DURACION_DEL_AVISO_MS = 3000;

type Creando =
  | null
  | { tipo: 'chat'; kind: 'direct' | 'group' }
  | { tipo: 'borrador' | 'agenda' | 'destacados' | 'medios' | 'llamadas' }
  | { tipo: 'evento'; chat: ChatDestino | null }
  | { tipo: 'encuesta'; chat: ChatDestino | null }
  | { tipo: 'checklist'; chatId: string }
  | { tipo: 'recordatorio'; chat: { id: string; name?: string | null; kind: 'direct' | 'group' | 'notas' } | null; editando?: AgendaReminder };

type Props = {
  credential: Credential;
  refrescoResuelto: boolean;
  logout: () => void;
  manejar401: () => Promise<string | null>;
  /** El service worker tiene una versión nueva esperando (W4). */
};

/**
 * El shell de dos paneles (F6 → W1). Todo lo que se ve sale de la base local;
 * `useSincronizacion` la mantiene al día con la red y el socket.
 */
export function Shell({ credential, refrescoResuelto, logout, manejar401 }: Props) {
  const yo = credential.userId;
  const base = useBaseLocal(yo);
  const chatsGuardados = useChatsLocales(base);
  const [selectedId, abrirChat] = useChatDeLaUrl();
  const [query, setQuery] = useState('');
  const width = useAnchoDeVentana();
  const [aviso, setAviso] = useState('');
  const [creando, setCreando] = useState<Creando>(null);
  /** Ir a un mensaje de otro chat (un destacado de la lista global, 20/10). */
  const [irA, setIrA] = useState<{ chatId: string; seq: number; vez: number } | null>(null);
  const historial = useHistorialDelChat(selectedId);
  // Los avisos cortos («Copiado», «Reenviado») se van solos; «Subiendo…» y los ajustes, no.
  useEffect(() => {
    if (!aviso || aviso === 'ajustes' || aviso.startsWith('Subiendo')) return;
    const espera = setTimeout(() => setAviso(''), DURACION_DEL_AVISO_MS);
    return () => clearTimeout(espera);
  }, [aviso]);

  const eventos = useRef<Partial<ReturnType<typeof useSincronizacion>['eventos']>>({});
  /** A chat outside the personal list moved: the open space and the rail ask again. */
  const eventoDeEspacio = useRef<(event: SpaceChatEvent) => void>(() => undefined);
  const espaciosCambiaron = useRef<() => void>(() => undefined);
  const socket = useSocket({
    jwt: credential.jwt,
    // Sin JWT (abrió sin red) no hay socket; con JWT, espera a que la sesión esté resuelta.
    userId: puedeAbrirSocket({ userId: credential.jwt ? yo : null, tieneSecreto: true, refrescoResuelto }) ? yo : null,
    onMessage: (mensaje: ChatMessage) => {
      eventos.current.onMessage?.(mensaje);
      eventoDeEspacio.current({ type: 'message', chatId: mensaje.chatId, message: mensaje });
      // A new poll, event or task can wait for me: the list's markers read again (22/10).
      if (mensaje.kind === 'poll' || mensaje.kind === 'event' || mensaje.kind === 'checklist') void refreshPendingInChats(credential.jwt);
    },
    onReceipt: (acuse) => {
      eventos.current.onReceipt?.(acuse);
      eventoDeEspacio.current({ type: 'receipt', chatId: acuse.chatId, userId: acuse.userId, readSeq: acuse.readSeq });
    },
    onBorrado: (dato) => {
      eventos.current.onBorrado?.(dato);
      // A deleted card may have been something waiting for me (22/10).
      void refreshPendingInChats(credential.jwt);
    },
    onEditado: (dato) => eventos.current.onEditado?.(dato),
    onHilo: (dato) => eventos.current.onHilo?.(dato),
    onReacciones: (dato) => eventos.current.onReacciones?.(dato),
    onCambioDeChat: (dato) => {
      eventos.current.onCambioDeChat?.();
      eventoDeEspacio.current({ type: 'changed', chatId: dato.chatId });
    },
    onSpacesChanged: () => espaciosCambiaron.current(),
    onMembersChanged: (dato) => membersChanged(dato.workspaceId),
    onCardChanged: () => void refreshPendingInChats(credential.jwt),
    onSinAutorizacion: manejar401,
  });
  // The list's «something waits for you» markers (José, 22/10): on start, on closing a chat, on coming back to the tab.
  useEffect(() => {
    void refreshPendingInChats(credential.jwt);
  }, [credential.jwt, selectedId]);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshPendingInChats(credential.jwt);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      forgetPendingInChats();
    };
  }, [credential.jwt]);
  const sync = useSincronizacion({ base, yo, jwt: credential.jwt, socket: socket.socket, conectado: socket.connected, manejar401, chatAbierto: selectedId });
  eventos.current = sync.eventos;

  const mensajes = useMensajesEnPantalla(base, selectedId, historial.limite, yo);
  const sinConexion = useSinConexion(socket.connected, true);
  // El navegador ofrece instalar UNA vez al cargar: se escucha desde acá, no desde el panel.
  const instalacion = useInstalarApp();
  // The creator's users panel (José, 21/10): asked the first time Ajustes opens.
  const superadmin = useSuperadmin(credential.jwt, aviso === 'ajustes');
  useTituloConPendientes(chatsGuardados);

  // When the chat changes, and once the token is there (a reload on `/c/<chat>` mounts before it comes back).
  useOpenChatWhenReady({ chatId: selectedId, ready: Boolean(credential.jwt), open: (chatId) => void sync.abrirChat(chatId).then((pagina) => historial.alAbrir(pagina?.hayMas ?? true)) });

  const cargarAnteriores = useCallback(() => {
    const primero = mensajes?.find((uno) => !uno.estado)?.seq;
    if (!selectedId || !primero) return;
    // Ya está el primero del chat: no hay nada antes que pedir.
    if (primero <= 1) return historial.alAbrir(false);
    historial.cargar(() => sync.traerPagina(selectedId, primero));
  }, [mensajes, selectedId, historial, sync]);

  // TODOS los chats, archivados incluidos: la lista arma lo visible (W3a) y un
  // archivado abierto sigue siendo el chat de la derecha.
  const agendaPhones = useMemo(() => (chatsGuardados ?? []).map((chat) => chat.phone), [chatsGuardados]);
  const agenda = useAgendaRelay({ base, socket: socket.socket, connected: socket.connected, phones: agendaPhones });
  const withPresence = useCallback(
    (chat: ChatSummary): ChatSummary => ({
      ...chatNameWithAgenda(chat, agenda),
      online: chat.memberIds.some((miembro) => miembro !== yo && socket.online.has(miembro)),
      typingName: socket.typingByChat.get(chat.id) ?? null,
    }),
    [socket.online, socket.typingByChat, yo, agenda]
  );
  const chats = useMemo<ChatSummary[]>(() => (chatsGuardados ?? []).map(withPresence), [chatsGuardados, withPresence]);
  const espacios = useSpacesWeb({
    jwt: credential.jwt,
    myUserId: yo,
    base,
    me: { name: credential.name, phone: credential.phone },
    personalUnread: chatsSinLeer(chats),
    online: socket.online,
    selectedChatId: selectedId,
    onOpenChat: abrirChat,
    onOpenMessage: (chatId, seq) => {
      abrirChat(chatId);
      setIrA({ chatId, seq, vez: Date.now() });
    },
    onPersonalChat: (chatId) => {
      abrirChat(chatId);
      void sync.cargarChats();
    },
  });
  // Another space (or personal) shows other chats: the one open belonged to the previous one, and on a
  // phone it would keep the list hidden behind an empty conversation. Not on the first load (a /c/ link).
  const spaceShown = useRef<string | null | undefined>(undefined);
  const currentSpaceId = espacios.current?.id ?? null;
  useEffect(() => {
    if (espacios.spaces === null) return;
    if (spaceShown.current !== undefined && spaceShown.current !== currentSpaceId) abrirChat(null);
    spaceShown.current = currentSpaceId;
    // Only when the space changes; `abrirChat` is stable for the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [espacios.spaces, currentSpaceId]);
  const spaceChatsShown = useMemo(() => espacios.chats?.map(withPresence) ?? null, [espacios.chats, withPresence]);
  // Who calls: the chat as the list names it (the agenda's name), else what the offer brings.
  const callerOf = useCallback((offer: IncomingOffer) => callerName({ chatName: [...chats, ...(spaceChatsShown ?? [])].find((chat) => chat.id === offer.chatId)?.name, fromName: offer.fromName, fromPhone: offer.fromPhone }), [chats, spaceChatsShown]);
  const personales = useMemo(() => new Set(chats.map((chat) => chat.id)), [chats]);
  eventoDeEspacio.current = (event) => !personales.has(event.chatId) && espacios.onChatEvent(event);
  espaciosCambiaron.current = espacios.reloadSpaces;
  const chatsParaReenviar = useMemo(() => ordenarParaLaLista(chats), [chats]);
  const accionesSobreChats = useAccionesSobreChats({
    base,
    jwt: credential.jwt,
    socket: socket.socket,
    cargarChats: sync.cargarChats,
    invalidarCargas: sync.invalidarCargas,
    renovarSesion: manejar401,
    onAviso: setAviso,
    alQuitar: (chatId) => chatId === selectedId && abrirChat(null),
  });


  const enEspacio = espacios.chatById(selectedId);
  const selected = chats.find((chat) => chat.id === selectedId) ?? (enEspacio ? withPresence(enEspacio) : null);
  const panel = resolveVisiblePanel({ width, selectedChatId: selectedId });
  const listLayout = useListLayout(width);
  const alCrear = (chatId: string) => {
    setCreando(null);
    abrirChat(chatId);
    void sync.cargarChats();
  };

  return (
    <CallProvider jwt={credential.jwt} connected={socket.connected} nameOf={callerOf} photoOf={(chatId) => [...chats, ...(spaceChatsShown ?? [])].find((chat) => chat.id === chatId)?.avatarUrl}>
    <div className="relative flex h-full">
      <WebNotices sinConexion={sinConexion} />
      <WhatsNewDialog />
      {panel !== 'conversation' ? (
        <AppRail
          spaces={espacios.spaces}
          currentSpaceId={espacios.current?.id ?? null}
          me={{ name: credential.name, phone: credential.phone }}
          personalUnread={chatsSinLeer(chats)}
          onChats={() => {
            setCreando(null);
            listLayout.setCollapsed(false);
          }}
          onAgenda={() => setCreando({ tipo: 'agenda' })}
          onCalls={() => setCreando({ tipo: 'llamadas' })}
          onStarred={() => setCreando({ tipo: 'destacados' })}
          onMedia={() => setCreando({ tipo: 'medios' })}
          onSettings={() => setAviso(aviso === 'ajustes' ? '' : 'ajustes')}
          onPickSpace={espacios.enter}
          onAddSpace={espacios.openSwitcher}
        />
      ) : null}
      {panel === 'conversation' ? null : panel === 'both' && listLayout.collapsed ? (
        <ChatRail chats={espacios.current ? (spaceChatsShown ?? []) : chats} selectedChatId={selectedId} onSelect={(chat) => abrirChat(chat.id)} onExpand={() => listLayout.setCollapsed(false)} />
      ) : (
        <>
        {espacios.current ? (
          <SpaceChatList
            space={espacios.current}
            chats={spaceChatsShown}
            failed={espacios.failed}
            onRetry={espacios.reloadChats}
            yo={yo}
            me={{ name: credential.name, phone: credential.phone }}
            selectedChatId={selectedId}
            onOpenChat={(chat) => abrirChat(chat.id)}
            onAccion={(chat, accion) => void accionesSobreChats.aplicar(chat, accion).then(espacios.reloadChats)}
            onSwitch={espacios.openSwitcher}
            onChannels={espacios.openChannels}
            onInvite={espacios.openInvite}
            onWorkspace={espacios.openWorkspace}
            onNewDirect={espacios.openNewDirect}
            activity={espacios.activity} apps={espacios.apps} jwt={credential.jwt}
            onActivity={espacios.openActivity}
            width={panel === 'both' ? listLayout.width : undefined}
            onCollapse={panel === 'both' ? () => listLayout.setCollapsed(true) : undefined}
          />
        ) : (
        <ChatList
          chats={chats}
          selectedChatId={selectedId}
          query={query}
          onQueryChange={setQuery}
          onSelect={(chat) => abrirChat(chat.id)}
          onHome={() => abrirChat(null)}
          loading={chatsGuardados === null}
          onNewChat={() => setCreando({ tipo: 'chat', kind: 'direct' })}
          onNewGroup={() => setCreando({ tipo: 'chat', kind: 'group' })}
          onAgenda={() => setCreando({ tipo: 'agenda' })}
          onDestacados={() => setCreando({ tipo: 'destacados' })}
          onNewBorrador={() => setCreando({ tipo: 'borrador' })}
          yo={yo} jwt={credential.jwt}
          onAccion={(chat, accion) => void accionesSobreChats.aplicar(chat, accion)}
          width={panel === 'both' ? listLayout.width : undefined}
          onCollapse={panel === 'both' ? () => listLayout.setCollapsed(true) : undefined}
          onSpaces={espacios.openSwitcher}
        />
        )}
        {panel === 'both' ? <ListResizeHandle width={listLayout.width} onResize={listLayout.setWidth} onReset={listLayout.reset} /> : null}
        </>
      )}

      {panel === 'list' ? null : selected ? (
        <ConversacionConAcciones
          chat={selected}
          mensajes={mensajes}
          yo={yo}
          jwt={credential.jwt}
          base={base}
          sync={sync}
          chats={chatsParaReenviar}
          onAviso={setAviso}
          onRecargarChats={() => void sync.cargarChats()}
          onOpenChat={(chatId, known) => (known ? espacios.openChat(known) : abrirChat(chatId))}
          onAccionDeChat={(chat, accion) => void accionesSobreChats.aplicar(chat, accion)}
          onLevel={(chat, level) => void accionesSobreChats.setLevel(chat, level)}
          typingName={selected.typingName ?? null} app={selected.appId ? espacios.apps.directory?.apps.find((one) => one.appId === selected.appId) : undefined} spaceName={espacios.current?.name} spaceApps={espacios.apps}
          onBack={() => abrirChat(null)}
          showBack={panel === 'conversation'}
          hayAnteriores={historial.hayAnteriores}
          onCargarAnteriores={cargarAnteriores}
          onReintentar={(clave) => void sync.reintentar(clave)}
          onDescartar={(clave) => void sync.descartar(clave)}
          onLeido={(seq) => sync.marcarLeido(selected.id, seq)}
          irA={irA?.chatId === selected.id ? irA : null}
          onCreateEvent={() => setCreando({ tipo: 'evento', chat: { id: selected.id, name: selected.name } })}
          onCreatePoll={() => setCreando({ tipo: 'encuesta', chat: { id: selected.id, name: selected.name } })}
          onCreateChecklist={selected.encrypted ? undefined : () => setCreando({ tipo: 'checklist', chatId: selected.id })}
          onCreateReminder={() => setCreando({ tipo: 'recordatorio', chat: { id: selected.id, name: selected.propio ? 'Tú' : selected.name, kind: selected.kind } })}
          onEditReminder={(recordatorio) => setCreando({ tipo: 'recordatorio', chat: { id: selected.id, name: selected.name, kind: selected.kind }, editando: recordatorio })}
        />
      ) : (
        <EmptyState name={credential.name} onNewChat={() => setCreando({ tipo: 'chat', kind: 'direct' })} onAgenda={() => setCreando({ tipo: 'agenda' })} />
      )}

      {espacios.layer}
      {creando?.tipo === 'medios' ? (
        <MediaDialog
          jwt={credential.jwt}
          spaceId={espacios.current?.id ?? null}
          spaceName={espacios.current?.name}
          chatName={(item) => chatNameWithAgenda({ ...item.chat }, agenda).name ?? item.chat.phone ?? 'Conversación'}
          onOpen={(item) => {
            setCreando(null);
            abrirChat(item.chatId);
            setIrA({ chatId: item.chatId, seq: item.seq, vez: Date.now() });
          }}
          onClose={() => setCreando(null)}
        />
      ) : null}
      {creando?.tipo === 'llamadas' ? <CallsHistory jwt={credential.jwt} chats={[...chats, ...(spaceChatsShown ?? [])]} onOpen={(chatId) => (setCreando(null), abrirChat(chatId))} onClose={() => setCreando(null)} /> : null}
      {creando?.tipo === 'borrador' ? <NuevoBorrador jwt={credential.jwt} onClose={() => setCreando(null)} onCreated={alCrear} /> : null}
      {creando?.tipo === 'chat' ? <NewChatOverlay jwt={credential.jwt} kind={creando.kind} onClose={() => setCreando(null)} onCreated={alCrear} /> : null}
      {creando?.tipo === 'agenda' ? (
        <AgendaOverlay
          jwt={credential.jwt}
          myUserId={yo}
          onClose={() => setCreando(null)}
          onCreateEvent={() => setCreando({ tipo: 'evento', chat: null })}
          onCreatePoll={() => setCreando({ tipo: 'encuesta', chat: null })}
          onCreateReminder={() => setCreando({ tipo: 'recordatorio', chat: null })}
          onEditarRecordatorio={(recordatorio) =>
            setCreando({ tipo: 'recordatorio', chat: recordatorio.chatId ? { id: recordatorio.chatId, name: recordatorio.chat?.name ?? recordatorio.chat?.phone, kind: recordatorio.chat?.kind ?? 'group' } : null, editando: recordatorio })
          }
          chatNameOf={(chatId) => {
            const chat = chats.find((one) => one.id === chatId);
            return chat?.name ?? chat?.phone ?? 'Conversación';
          }}
          onOpenTask={(chatId, seq) => {
            setCreando(null);
            abrirChat(chatId);
            if (seq) setIrA({ chatId, seq, vez: Date.now() });
          }}
        />
      ) : null}
      {creando?.tipo === 'evento' ? <CreateEventOverlay jwt={credential.jwt} chat={creando.chat} onClose={() => setCreando(null)} onCreated={alCrear} /> : null}
      {creando?.tipo === 'encuesta' ? <CreatePollOverlay jwt={credential.jwt} chat={creando.chat} onClose={() => setCreando(null)} onCreated={alCrear} /> : null}
      {creando?.tipo === 'checklist' ? <CreateChecklistOverlay jwt={credential.jwt} chatId={creando.chatId} onClose={() => setCreando(null)} /> : null}
      {creando?.tipo === 'destacados' ? (
        <ListaDeDestacados
          jwt={credential.jwt}
          yo={yo}
          onIr={(destacado) => {
            abrirChat(destacado.chatId);
            setIrA({ chatId: destacado.chatId, seq: destacado.seq, vez: Date.now() });
          }}
          onCerrar={() => setCreando(null)}
        />
      ) : null}
      {creando?.tipo === 'recordatorio' ? <CrearRecordatorio jwt={credential.jwt} chat={creando.chat} editando={creando.editando} onClose={() => setCreando(null)} onGuardado={() => setCreando(null)} /> : null}

      {aviso === 'ajustes' ? <PanelDeAjustes jwt={credential.jwt} userId={credential.userId} onAviso={setAviso} onSalir={logout} onCerrar={() => setAviso('')} instalacion={instalacion} superadmin={superadmin} /> : aviso ? (
        <p data-testid="aviso" role="status" className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-on-surface px-4 py-2 text-sm text-surface">
          {aviso}
        </p>
      ) : null}
    </div>
    </CallProvider>
  );
}

/** «Sin conexión», arriba al centro (W4). The new version has its one band in the list (pending 61). */
function WebNotices({ sinConexion }: { sinConexion: boolean }) {
  if (!sinConexion) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex flex-col items-center gap-2 px-4">
      {sinConexion ? (
        <p role="status" data-testid="aviso-sin-conexion" className="pointer-events-auto flex items-center gap-2 rounded-full bg-on-surface px-4 py-2 text-[13px] text-surface shadow-lg">
          <WifiOff size={15} /> Sin conexión. Lo que escribas se enviará al volver.
        </p>
      ) : null}
    </div>
  );
}

/** Ajustes mínimos: notificaciones, instalar y salir. W3 trae los completos. */
function PanelDeAjustes(props: {
  jwt: string;
  userId: string;
  onAviso: (texto: string) => void;
  onSalir: () => void;
  onCerrar: () => void;
  instalacion: ReturnType<typeof useInstalarApp>;
  superadmin: boolean;
}) {
  const { jwt, onAviso, onSalir, onCerrar, instalacion, superadmin } = props;
  const [push, setPush] = useState(pushState);
  // It had no way out but its own button (José, 21/10): a click outside, Escape or the X close it.
  const panel = useRef<HTMLDivElement>(null);
  useDismiss(true, panel, onCerrar, { ignore: '[data-testid="btn-ajustes"], [data-testid="riel-perfil"]' });
  const alternar = async () => {
    if (push === 'encendido') {
      await disablePush(jwt);
      return setPush('apagado');
    }
    const resultado = await enablePush(jwt);
    setPush(pushState());
    if (!resultado.ok) onAviso(resultado.message ?? 'No se pudieron activar.');
  };
  return (
    <div ref={panel} data-testid="panel-ajustes" className="absolute bottom-16 left-4 z-10 w-72 rounded-xl border border-outline/15 bg-surface p-2 shadow-lg">
      <button type="button" data-testid="cerrar-ajustes" aria-label="Cerrar ajustes" title="Cerrar" onClick={onCerrar} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-on-surface-variant hover:bg-background">
        <X size={16} />
      </button>
      <PresenceChoice jwt={jwt} />
      <AppearanceChoice />
      <ChatFontChoice />
      <GroupsAsListChoice />
      <StorageChoice userId={props.userId} />
      <button type="button" data-testid="btn-notificaciones" onClick={() => void alternar()} className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-background">
        {push === 'encendido' ? <BellOff size={16} /> : <Bell size={16} />}
        <span className="min-w-0 flex-1">{push === 'encendido' ? 'Desactivar notificaciones' : 'Activar notificaciones'}</span>
      </button>
      {instalacion.puedeInstalar ? (
        <button type="button" data-testid="btn-instalar" onClick={() => void instalacion.instalar().then(onCerrar)} className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-background">
          <Download size={16} />
          Instalar Lilachat en esta computadora
        </button>
      ) : null}
      {superadmin ? (
        <a href="/admin" data-testid="btn-usuarios-lilachat" className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-background">
          <UsersRound size={16} />
          Usuarios de Lilachat
        </a>
      ) : null}
      <button type="button" data-testid="btn-salir" onClick={onSalir} className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-error hover:bg-error/5">
        <LogOut size={16} />
        Cerrar sesión
      </button>
      <p data-testid="version-web" className="border-t border-outline/10 px-3 pb-1 pt-2 text-[11px] text-on-surface-variant">{webVersionLabel(WEB_BUILD)}</p>
    </div>
  );
}

/** El ancho de verdad: el panel visible también decide el comportamiento (volver). */
function useAnchoDeVentana(): number {
  const [ancho, setAncho] = useState(() => window.innerWidth);
  useEffect(() => {
    const alCambiar = () => setAncho(window.innerWidth);
    window.addEventListener('resize', alCambiar);
    return () => window.removeEventListener('resize', alCambiar);
  }, []);
  return ancho;
}

/** «(3) Lilachat» y la insignia de la app instalada. */
function useTituloConPendientes(chats: ChatSummary[] | null): void {
  const pendientes = chatsSinLeer(chats ?? []);
  useEffect(() => {
    document.title = tituloDeLaPestana(pendientes);
    const conInsignia = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    void (pendientes > 0 ? conInsignia.setAppBadge?.(pendientes) : conInsignia.clearAppBadge?.())?.catch(() => undefined);
  }, [pendientes]);
}

/** Cuántos mensajes se leen de la base y si el server tiene más atrás. */
function useHistorialDelChat(chatId: string | null) {
  const [limite, setLimite] = useState(TAMANO_DE_PAGINA);
  const [hayAnteriores, setHayAnteriores] = useState(true);
  const cargando = useRef(false);

  useEffect(() => {
    setLimite(TAMANO_DE_PAGINA);
    setHayAnteriores(true);
  }, [chatId]);

  const cargar = useCallback((traer: () => Promise<{ hayMas: boolean } | null>) => {
    if (cargando.current) return;
    cargando.current = true;
    setLimite((actual) => actual + TAMANO_DE_PAGINA);
    void traer()
      .then((pagina) => {
        if (pagina) setHayAnteriores(pagina.hayMas);
      })
      .finally(() => {
        cargando.current = false;
      });
  }, []);

  return useMemo(() => ({ limite, hayAnteriores, cargar, alAbrir: setHayAnteriores }), [limite, hayAnteriores, cargar]);
}

/** «Apariencia: Claro · Oscuro · Sistema» (design `n-01-web-oscuro-lista`; José, 21/10). */
function AppearanceChoice() {
  const [choice, setChoice] = useState<ThemeChoice>(readThemeChoice);
  const options: { value: ThemeChoice; label: string }[] = [
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Oscuro' },
    { value: 'system', label: 'Sistema' },
  ];
  return (
    <div className="mb-1 border-b border-outline/15 px-2 pb-3 pt-1">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">Apariencia</p>
      <div role="radiogroup" aria-label="Apariencia" className="grid grid-cols-3 gap-1 rounded-lg border border-outline/15 p-1">
        {options.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={choice === value}
            data-testid={`tema-${value}`}
            onClick={() => {
              setChoice(value);
              saveThemeChoice(value);
            }}
            className={`min-h-[36px] rounded-md text-[13px] font-semibold ${choice === value ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-background'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

const LIST_WIDTH_KEY = 'lilachat.anchoLista';
const LIST_FOLDED_KEY = 'lilachat.listaPlegada';

/** A per-browser convenience: it can fail (private mode) and the defaults stay. */
function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not remembered in this browser: it still works until the page closes.
  }
}

/** The chat list's width (dragged) and whether it is folded, remembered in this browser (José, 21/10). */
function useListLayout(windowWidth: number) {
  const [width, setStoredWidth] = useState(() => Number(readStored(LIST_WIDTH_KEY) ?? LIST_DEFAULT_WIDTH));
  const [collapsed, setStoredCollapsed] = useState(() => readStored(LIST_FOLDED_KEY) === '1');
  const setWidth = useCallback((next: number) => {
    setStoredWidth(next);
    store(LIST_WIDTH_KEY, String(Math.round(next)));
  }, []);
  const setCollapsed = useCallback((next: boolean) => {
    setStoredCollapsed(next);
    store(LIST_FOLDED_KEY, next ? '1' : '0');
  }, []);
  const reset = useCallback(() => setWidth(LIST_DEFAULT_WIDTH), [setWidth]);
  return { width: clampListWidth(width, windowWidth), collapsed, setWidth, setCollapsed, reset };
}
