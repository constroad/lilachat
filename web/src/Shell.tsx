import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellOff, LogOut } from 'lucide-react';
import type { Credential } from './api';
import { AgendaOverlay } from './agenda/AgendaOverlay';
import { CreateEventOverlay, CreatePollOverlay, NewChatOverlay, type ChatDestino } from './agenda/CreatePanels';
import { ChatList } from './chat/ChatList';
import { ConversacionConAcciones } from './chat/ConversacionConAcciones';
import { EmptyState } from './chat/EmptyState';
import { ordenarParaLaLista } from './chat/listaDeChats';
import { chatsSinLeer, tituloDeLaPestana } from './chat/tituloDeLaPestana';
import type { ChatMessage, ChatSummary } from './chat/types';
import { useChatDeLaUrl } from './chat/useChatDeLaUrl';
import { resolveVisiblePanel } from './layout';
import { useBaseLocal, useChatsLocales, useMensajesEnPantalla } from './local/useBaseLocal';
import { disablePush, enablePush, pushState } from './push';
import { puedeAbrirSocket } from './sesionLista';
import { TAMANO_DE_PAGINA, useSincronizacion } from './sync/useSincronizacion';
import { useSocket } from './useSocket';

/** Cuánto dura un aviso corto en pantalla. */
const DURACION_DEL_AVISO_MS = 3000;

type Creando =
  | null
  | { tipo: 'chat'; kind: 'direct' | 'group' }
  | { tipo: 'agenda' }
  | { tipo: 'evento'; chat: ChatDestino | null }
  | { tipo: 'encuesta'; chat: ChatDestino | null };

type Props = {
  credential: Credential;
  refrescoResuelto: boolean;
  logout: () => void;
  manejar401: () => Promise<boolean>;
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
  const historial = useHistorialDelChat(selectedId);
  // Los avisos cortos («Copiado», «Reenviado») se van solos; «Subiendo…» y los ajustes, no.
  useEffect(() => {
    if (!aviso || aviso === 'ajustes' || aviso.startsWith('Subiendo')) return;
    const espera = setTimeout(() => setAviso(''), DURACION_DEL_AVISO_MS);
    return () => clearTimeout(espera);
  }, [aviso]);

  const eventos = useRef<Partial<ReturnType<typeof useSincronizacion>['eventos']>>({});
  const socket = useSocket({
    jwt: credential.jwt,
    // Sin JWT (abrió sin red) no hay socket; con JWT, espera a que la sesión esté resuelta.
    userId: puedeAbrirSocket({ userId: credential.jwt ? yo : null, tieneSecreto: true, refrescoResuelto }) ? yo : null,
    onMessage: (mensaje: ChatMessage) => eventos.current.onMessage?.(mensaje),
    onReceipt: () => eventos.current.onReceipt?.(),
    onBorrado: (dato) => eventos.current.onBorrado?.(dato),
    onEditado: (dato) => eventos.current.onEditado?.(dato),
    onCambioDeChat: () => eventos.current.onCambioDeChat?.(),
  });
  const sync = useSincronizacion({ base, yo, jwt: credential.jwt, socket: socket.socket, conectado: socket.connected, manejar401 });
  eventos.current = sync.eventos;

  const mensajes = useMensajesEnPantalla(base, selectedId, historial.limite, yo);
  useTituloConPendientes(chatsGuardados);

  useEffect(() => {
    if (!selectedId) return;
    void sync.abrirChat(selectedId).then((pagina) => historial.alAbrir(pagina?.hayMas ?? true));
    // Al cambiar de chat, no en cada render: `abrirChat` cambia con el token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const cargarAnteriores = useCallback(() => {
    const primero = mensajes?.find((uno) => !uno.estado)?.seq;
    if (!selectedId || !primero) return;
    // Ya está el primero del chat: no hay nada antes que pedir.
    if (primero <= 1) return historial.alAbrir(false);
    historial.cargar(() => sync.traerPagina(selectedId, primero));
  }, [mensajes, selectedId, historial, sync]);

  const chats = useMemo(() => {
    const decorados: ChatSummary[] = ordenarParaLaLista(chatsGuardados ?? []).map((chat) => ({
      ...chat,
      online: chat.memberIds.some((miembro) => miembro !== yo && socket.online.has(miembro)),
      typingName: socket.typingByChat.get(chat.id) ?? null,
    }));
    const aguja = query.trim().toLowerCase();
    return aguja ? decorados.filter((chat) => (chat.name ?? chat.phone ?? '').toLowerCase().includes(aguja)) : decorados;
  }, [chatsGuardados, query, socket.online, socket.typingByChat, yo]);


  const selected = chats.find((chat) => chat.id === selectedId) ?? null;
  const panel = resolveVisiblePanel({ width, selectedChatId: selectedId });
  const alCrear = (chatId: string) => {
    setCreando(null);
    abrirChat(chatId);
    void sync.cargarChats();
  };

  return (
    <div className="flex h-full">
      {panel === 'conversation' ? null : (
        <ChatList
          chats={chats}
          selectedChatId={selectedId}
          query={query}
          onQueryChange={setQuery}
          onSelect={(chat) => abrirChat(chat.id)}
          me={{ name: credential.name, phone: credential.phone }}
          onSettings={() => setAviso(aviso ? '' : 'ajustes')}
          loading={chatsGuardados === null}
          onNewChat={() => setCreando({ tipo: 'chat', kind: 'direct' })}
          onNewGroup={() => setCreando({ tipo: 'chat', kind: 'group' })}
          onAgenda={() => setCreando({ tipo: 'agenda' })}
        />
      )}

      {panel === 'list' ? null : selected ? (
        <ConversacionConAcciones
          chat={selected}
          mensajes={mensajes}
          yo={yo}
          jwt={credential.jwt}
          sync={sync}
          chats={chats}
          onAviso={setAviso}
          typingName={selected.typingName ?? null}
          onBack={() => abrirChat(null)}
          showBack={panel === 'conversation'}
          hayAnteriores={historial.hayAnteriores}
          onCargarAnteriores={cargarAnteriores}
          onReintentar={(clave) => void sync.reintentar(clave)}
          onDescartar={(clave) => void sync.descartar(clave)}
          onLeido={(seq) => sync.marcarLeido(selected.id, seq)}
          onCreateEvent={() => setCreando({ tipo: 'evento', chat: { id: selected.id, name: selected.name } })}
          onCreatePoll={() => setCreando({ tipo: 'encuesta', chat: { id: selected.id, name: selected.name } })}
        />
      ) : (
        <EmptyState name={credential.name} onNewChat={() => setCreando({ tipo: 'chat', kind: 'direct' })} onAgenda={() => setCreando({ tipo: 'agenda' })} />
      )}

      {creando?.tipo === 'chat' ? <NewChatOverlay jwt={credential.jwt} kind={creando.kind} onClose={() => setCreando(null)} onCreated={alCrear} /> : null}
      {creando?.tipo === 'agenda' ? (
        <AgendaOverlay
          jwt={credential.jwt}
          myUserId={yo}
          onClose={() => setCreando(null)}
          onCreateEvent={() => setCreando({ tipo: 'evento', chat: null })}
          onCreatePoll={() => setCreando({ tipo: 'encuesta', chat: null })}
        />
      ) : null}
      {creando?.tipo === 'evento' ? <CreateEventOverlay jwt={credential.jwt} chat={creando.chat} onClose={() => setCreando(null)} onCreated={alCrear} /> : null}
      {creando?.tipo === 'encuesta' ? <CreatePollOverlay jwt={credential.jwt} chat={creando.chat} onClose={() => setCreando(null)} onCreated={alCrear} /> : null}

      {aviso === 'ajustes' ? <PanelDeAjustes jwt={credential.jwt} onAviso={setAviso} onSalir={logout} /> : aviso ? (
        <p data-testid="aviso" role="status" className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-on-surface px-4 py-2 text-sm text-white">
          {aviso}
        </p>
      ) : null}
    </div>
  );
}

/** Ajustes mínimos de F6: notificaciones y salir. W3 trae los completos. */
function PanelDeAjustes({ jwt, onAviso, onSalir }: { jwt: string; onAviso: (texto: string) => void; onSalir: () => void }) {
  const [push, setPush] = useState(pushState);
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
    <div data-testid="panel-ajustes" className="absolute bottom-16 left-4 z-10 w-64 rounded-xl border border-outline/15 bg-surface p-2 shadow-lg">
      <button type="button" data-testid="btn-notificaciones" onClick={() => void alternar()} className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-background">
        {push === 'encendido' ? <BellOff size={16} /> : <Bell size={16} />}
        <span className="min-w-0 flex-1">{push === 'encendido' ? 'Desactivar notificaciones' : 'Activar notificaciones'}</span>
      </button>
      <button type="button" data-testid="btn-salir" onClick={onSalir} className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-error hover:bg-error/5">
        <LogOut size={16} />
        Cerrar sesión
      </button>
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
