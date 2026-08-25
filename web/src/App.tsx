import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, LogOut } from 'lucide-react';
import { mergeIncoming } from '@lilachat/shared';
import { api, clearCredential, loadCredential, saveCredential, type Credential } from './api';
import { AccessScreens } from './auth/AccessScreens';
import { ChatList } from './chat/ChatList';
import { Conversation } from './chat/Conversation';
import { EmptyState } from './chat/EmptyState';
import type { ChatMessage, ChatSummary } from './chat/types';
import { resolveVisiblePanel } from './layout';
import { disablePush, enablePush, pushState } from './push';
import { useSocket } from './useSocket';

/**
 * El shell de dos paneles (F6).
 *
 * El ancho se mide de verdad y no por media queries de CSS: la decisión de qué
 * panel se ve también manda en el comportamiento —el botón de volver, a dónde
 * lleva cerrar una conversación—, y eso no se puede expresar solo con clases.
 */
export function App() {
  const [credential, setCredential] = useState<Credential | null>(loadCredential);
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [query, setQuery] = useState('');
  const [width, setWidth] = useState(() => window.innerWidth);
  const [push, setPush] = useState(pushState);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const loadChats = useCallback(async () => {
    if (!credential) return;
    const result = await api<{ chats: ChatSummary[] }>('/chats', { jwt: credential.jwt });
    if (result.ok) setChats(result.data.chats);
    // El 401 es lo ÚNICO que borra la sesión. Sin red la respuesta no llega, y
    // tratar eso como revocación echaría al usuario cada vez que se cae el wifi.
    else if (result.status === 401) logout();
    else setChats([]);
  }, [credential]);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  const onMessage = useCallback(
    (message: ChatMessage) => {
      // `mergeIncoming` deduplica por `clientKey`: el eco del propio mensaje
      // tiene que REEMPLAZAR al optimista, no sumarse. Comparar por `seq` no
      // sirve — el optimista aún no tiene el que asigna el server.
      setMessages((current) =>
        current && message.chatId === selectedId ? mergeIncoming(current, message) : current
      );
      void loadChats();
    },
    [selectedId, loadChats]
  );

  const onReceipt = useCallback(() => void loadChats(), [loadChats]);

  const socket = useSocket({ jwt: credential?.jwt ?? null, onMessage, onReceipt });
  const socketRef = socket.socket;

  // Los mensajes del chat abierto.
  useEffect(() => {
    if (!credential || !selectedId) return setMessages(null);
    setMessages(null);
    void (async () => {
      const result = await api<{ messages: ChatMessage[] }>(`/chats/${selectedId}/messages`, {
        jwt: credential.jwt,
      });
      setMessages(result.ok ? result.data.messages : []);
      // El acuse va por socket (`read.set`): así los demás miembros ven el
      // check azul en el momento, sin esperar a que recarguen.
      const ultimo = result.ok ? result.data.messages.at(-1) : undefined;
      if (ultimo) socketRef.current?.emit('read.set', { chatId: selectedId, seq: ultimo.seq });
      void loadChats();
    })();
    // `loadChats` cambia con cada credencial nueva; incluirlo re-pediría los
    // mensajes en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credential, selectedId]);

  function logout() {
    clearCredential();
    setCredential(null);
    setChats(null);
    setSelectedId(null);
  }

  const send = async (text: string) => {
    if (!credential || !selectedId) return;
    const clientKey = crypto.randomUUID();
    const optimista: ChatMessage = {
      chatId: selectedId,
      seq: Number.MAX_SAFE_INTEGER,
      senderId: credential.userId,
      kind: 'text',
      body: text,
      clientKey,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    // Se pinta ANTES de que el server conteste: en un chat, esperar el ida y
    // vuelta para ver lo que uno escribió se siente roto aunque tarde poco.
    setMessages((current) => [...(current ?? []), optimista]);

    // POR EL SOCKET, no por HTTP: no existe un `POST /messages`. El server
    // recibe `msg.send`, contesta por ack con el `seq` asignado y reparte
    // `msg.new` a todos los miembros —incluidos mis otros dispositivos—. Es el
    // mismo camino que usa la app desde F2.
    socketRef.current?.emit(
      'msg.send',
      { chatId: selectedId, clientKey, kind: 'text', body: text },
      (response: { ok: boolean; seq?: number }) => {
        if (!response?.ok || typeof response.seq !== 'number') return;
        // El `seq` real reemplaza al optimista. El cuerpo definitivo llega por
        // `msg.new`, que ya se maneja en `onMessage`.
        setMessages((current) =>
          (current ?? []).map((item) =>
            item.clientKey === clientKey
              ? { ...item, seq: response.seq!, pending: false }
              : item
          )
        );
        void loadChats();
      }
    );
  };

  const togglePush = async () => {
    if (!credential) return;
    setAviso('');
    if (push === 'encendido') {
      await disablePush(credential.jwt);
      setPush('apagado');
      return;
    }
    const result = await enablePush(credential.jwt);
    setPush(pushState());
    if (!result.ok) setAviso(result.message ?? 'No se pudieron activar.');
  };

  /**
   * La presencia y el «escribiendo» del socket, pintados SOBRE la lista ya
   * cargada, más el filtro del buscador.
   *
   * Va ANTES del `return` de la pantalla de acceso, y eso no es estilo: un hook
   * después de un return condicional cambia la CANTIDAD de hooks entre renders,
   * y React tira «Rendered more hooks than during the previous render» — la
   * pantalla quedaba en blanco justo al terminar de loguearse. Todos los hooks
   * van arriba, sin excepción.
   */
  const filtered = useMemo(() => {
    if (!credential) return [];
    const decorated: ChatSummary[] = (chats ?? []).map((chat) => ({
      ...chat,
      online: chat.memberIds.some(
        (member) => member !== credential.userId && socket.online.has(member)
      ),
      typingName: socket.typingByChat.get(chat.id) ?? null,
    }));
    const needle = query.trim().toLowerCase();
    if (!needle) return decorated;
    return decorated.filter((chat) => (chat.name ?? '').toLowerCase().includes(needle));
  }, [credential, chats, query, socket.online, socket.typingByChat]);

  if (!credential) {
    return (
      <AccessScreens
        onReady={(next) => {
          saveCredential(next);
          setCredential(next);
        }}
      />
    );
  }

  const selected = filtered.find((chat) => chat.id === selectedId) ?? null;
  const panel = resolveVisiblePanel({ width, selectedChatId: selectedId });

  return (
    <div className="flex h-full">
      {panel === 'conversation' ? null : (
        <ChatList
          chats={filtered}
          selectedChatId={selectedId}
          query={query}
          onQueryChange={setQuery}
          onSelect={(chat) => setSelectedId(chat.id)}
          me={{ name: credential.name, phone: credential.phone }}
          onSettings={() => setAviso(aviso ? '' : 'ajustes')}
          loading={chats === null}
        />
      )}

      {panel === 'list' ? null : selected ? (
        <Conversation
          chat={selected}
          messages={messages ?? []}
          myUserId={credential.userId}
          typingName={selected.typingName ?? null}
          onBack={() => setSelectedId(null)}
          onSend={send}
          showBack={panel === 'conversation'}
          loading={messages === null}
        />
      ) : (
        <EmptyState name={credential.name} />
      )}

      {aviso === 'ajustes' ? (
        <div
          data-testid="panel-ajustes"
          className="absolute bottom-16 left-4 z-10 w-64 rounded-xl border border-outline/15 bg-surface p-2 shadow-lg"
        >
          <button
            type="button"
            data-testid="btn-notificaciones"
            onClick={() => void togglePush()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-background"
          >
            {push === 'encendido' ? <BellOff size={16} /> : <Bell size={16} />}
            <span className="min-w-0 flex-1">
              {push === 'encendido' ? 'Desactivar notificaciones' : 'Activar notificaciones'}
            </span>
          </button>
          <button
            type="button"
            data-testid="btn-salir"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-error hover:bg-error/5"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      ) : aviso ? (
        <p
          data-testid="aviso"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-on-surface px-4 py-2 text-sm text-white"
        >
          {aviso}
        </p>
      ) : null}
    </div>
  );
}
