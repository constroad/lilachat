import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellOff, LogOut } from 'lucide-react';
import { mergeIncoming } from '@lilachat/shared';
import {
  api,
  clearCredential,
  loadCredential,
  refreshSession,
  saveCredential,
  type Credential,
} from './api';
import { AgendaOverlay } from './agenda/AgendaOverlay';
import { subirArchivo } from './chat/mediaUpload';
import { puedeAbrirSocket } from './sesionLista';
import {
  guardarChats,
  guardarMensajes,
  leerChatsGuardados,
  leerMensajesGuardados,
  olvidarCache,
} from './chat/cacheLocal';
import {
  CreateEventOverlay,
  CreatePollOverlay,
  NewChatOverlay,
  type ChatDestino,
} from './agenda/CreatePanels';
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
  /**
   * La lista arranca con lo GUARDADO, no en `null`.
   *
   * Abrir la pestaña mostraba esqueletos y esperaba a la red; ahora pinta lo
   * último conocido al instante y la red confirma por detrás. Es lo mismo que
   * ya hace la app.
   */
  const [chats, setChats] = useState<ChatSummary[] | null>(leerChatsGuardados);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [query, setQuery] = useState('');
  const [width, setWidth] = useState(() => window.innerWidth);
  const [push, setPush] = useState(pushState);
  const [aviso, setAviso] = useState('');
  /** El `jwt` para el que ya se intentó renovar. Ver el freno en `loadChats`. */
  const refrescoIntentado = useRef<string | null>(null);
  /**
   * Si el refresco de arranque ya terminó (bien o mal).
   *
   * El socket ESPERA a esto cuando hay secreto: abrirlo antes es abrirlo con el
   * token guardado, que puede estar vencido — el server lo rechaza y socket.io
   * reintenta, que era todo el ruido de «WebSocket connection failed».
   */
  const [refrescoResuelto, setRefrescoResuelto] = useState(false);
  /**
   * Qué se está creando encima de los dos paneles.
   *
   * Uno solo a la vez y en un único estado: con un booleano por overlay, abrir
   * «nuevo grupo» desde la agenda dejaba los dos apilados.
   */
  const [creando, setCreando] = useState<
    | null
    | { tipo: 'chat'; kind: 'direct' | 'group' }
    | { tipo: 'agenda' }
    | { tipo: 'evento'; chat: ChatDestino | null }
    | { tipo: 'encuesta'; chat: ChatDestino | null }
  >(null);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const loadChats = useCallback(async () => {
    if (!credential) return;
    const result = await api<{ chats: ChatSummary[] }>('/chats', { jwt: credential.jwt });
    if (result.ok) {
      // El server MANDA: no se fusiona con la caché, porque un chat borrado
      // desde el teléfono tiene que desaparecer de la web.
      setChats(result.data.chats);
      guardarChats(result.data.chats);
      return;
    }

    /**
     * Un 401 ya NO echa a nadie de entrada: primero se intenta renovar con el
     * secreto del dispositivo, que es lo que hace la app desde siempre.
     *
     * El `jwt` dura 24 h. Sin esto, al día siguiente la web pedía otro código
     * —mientras el teléfono seguía entrando solo—, que es lo que a José le
     * pasaba «a cada rato».
     */
    if (result.status === 401) {
      // Sin secreto no hay nada que renovar —sesión vieja, de antes de que la
      // web lo guardara—: ahí el 401 sí echa, como siempre. Si no, quedaría con
      // la lista vacía para siempre y sin forma de volver a entrar.
      if (!credential.deviceSecret) return logout();

      /**
       * **Un intento por token, no más.**
       *
       * Sin este freno: 401 → renovar → el estado cambia → se vuelve a pedir la
       * lista → 401 → renovar… un bucle que martilla la API para siempre. Lo
       * destapó un test que se colgó, y habría pasado en producción el día que
       * el server devolviera 401 con un refresco que igual contesta.
       */
      if (refrescoIntentado.current === credential.jwt) return logout();
      refrescoIntentado.current = credential.jwt;

      const renovado = await refreshSession(credential);
      if (renovado.ok) {
        // Un token idéntico no es una renovación: guardarlo cambiaría la
        // referencia del estado y dispararía la vuelta siguiente del bucle.
        if (renovado.jwt === credential.jwt) return logout();
        const siguiente = { ...credential, jwt: renovado.jwt };
        saveCredential(siguiente);
        setCredential(siguiente);
        return;
      }
      // Solo un 401 del propio refresco significa revocado de verdad.
      if (renovado.revocado) return logout();
    }

    setChats([]);
  }, [credential]);

  /**
   * Al abrir la pestaña se renueva de entrada, sin esperar a que algo falle:
   * así el socket se conecta con un token vivo en vez de rebotar primero.
   */
  useEffect(() => {
    if (!credential?.deviceSecret) return;
    void refreshSession(credential)
      .then((renovado) => {
        if (!renovado.ok) {
          if (renovado.revocado) logout();
          return;
        }
        if (renovado.jwt === credential.jwt) return;
        const siguiente = { ...credential, jwt: renovado.jwt };
        saveCredential(siguiente);
        setCredential(siguiente);
      })
      // Pase lo que pase, el socket deja de esperar: si el refresco falla por
      // red, quedarse sin tiempo real para siempre sería peor que intentar con
      // el token que hay.
      .finally(() => setRefrescoResuelto(true));
    // Solo al montar y al cambiar de dispositivo: renovar en cada render sería
    // un pedido por tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credential?.deviceId]);

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

  const socket = useSocket({
    jwt: credential?.jwt ?? null,
    // `null` hasta que la sesión esté resuelta: así el PRIMER handshake sale con
    // un token vivo y no hay reintentos que ensucien la consola.
    userId: puedeAbrirSocket({
      userId: credential?.userId ?? null,
      tieneSecreto: Boolean(credential?.deviceSecret),
      refrescoResuelto,
    })
      ? (credential?.userId ?? null)
      : null,
    onMessage,
    onReceipt,
  });
  const socketRef = socket.socket;

  // Los mensajes del chat abierto.
  useEffect(() => {
    if (!credential || !selectedId) return setMessages(null);
    // Lo guardado se pinta ANTES de pedir: abrir un chat y ver esqueletos cada
    // vez es la diferencia que se siente contra WhatsApp Web.
    setMessages(leerMensajesGuardados(selectedId));
    void (async () => {
      const result = await api<{ messages: ChatMessage[] }>(`/chats/${selectedId}/messages`, {
        jwt: credential.jwt,
      });
      if (result.ok) {
        setMessages(result.data.messages);
        guardarMensajes(selectedId, result.data.messages);
      } else {
        // Sin red se deja lo guardado: vaciar la conversación por un fallo de
        // red es peor que mostrarla un poco vieja.
        setMessages((actuales) => actuales ?? []);
      }
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
    // El historial no se hereda: en un navegador compartido, lo siguiente que
    // pase es que otra persona abra la pestaña.
    olvidarCache();
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

  /**
   * Subir una foto o un archivo al chat abierto.
   *
   * El mensaje NO se inserta a mano: lo crea el server en el mismo request y
   * llega por `msg.new`, igual que cualquier otro. Insertarlo acá dejaría dos
   * copias en cuanto el socket lo repitiera.
   */
  const enviarArchivo = async (file: File) => {
    if (!credential || !selectedId) return;
    setAviso('Subiendo…');

    const resultado = await subirArchivo({ jwt: credential.jwt, chatId: selectedId, file });
    // El aviso dice qué pasó: sin esto, un archivo demasiado grande no llega y
    // no hay forma de saber por qué.
    setAviso(resultado.ok ? '' : resultado.message);
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
          // El token acaba de nacer en el canje: no hay nada que refrescar, y
          // hacerlo esperar dejaría la web sin tiempo real hasta el próximo
          // arranque.
          setRefrescoResuelto(true);
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
          onNewChat={() => setCreando({ tipo: 'chat', kind: 'direct' })}
          onNewGroup={() => setCreando({ tipo: 'chat', kind: 'group' })}
          onAgenda={() => setCreando({ tipo: 'agenda' })}
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
          onCreateEvent={() =>
            setCreando({ tipo: 'evento', chat: { id: selected.id, name: selected.name } })
          }
          onCreatePoll={() =>
            setCreando({ tipo: 'encuesta', chat: { id: selected.id, name: selected.name } })
          }
          onEnviarArchivo={(file) => void enviarArchivo(file)}
        />
      ) : (
        <EmptyState
          name={credential.name}
          onNewChat={() => setCreando({ tipo: 'chat', kind: 'direct' })}
          onAgenda={() => setCreando({ tipo: 'agenda' })}
        />
      )}

      {creando?.tipo === 'chat' ? (
        <NewChatOverlay
          jwt={credential.jwt}
          kind={creando.kind}
          onClose={() => setCreando(null)}
          onCreated={(chatId) => {
            setCreando(null);
            // Se entra al chat recién creado: crear una conversación y quedarse
            // mirando la lista obliga a buscarla entre las demás.
            setSelectedId(chatId);
            void loadChats();
          }}
        />
      ) : null}

      {creando?.tipo === 'agenda' ? (
        <AgendaOverlay
          jwt={credential.jwt}
          myUserId={credential.userId}
          onClose={() => setCreando(null)}
          onCreateEvent={() => setCreando({ tipo: 'evento', chat: null })}
          onCreatePoll={() => setCreando({ tipo: 'encuesta', chat: null })}
        />
      ) : null}

      {creando?.tipo === 'evento' ? (
        <CreateEventOverlay
          jwt={credential.jwt}
          chat={creando.chat}
          onClose={() => setCreando(null)}
          onCreated={(chatId) => {
            setCreando(null);
            setSelectedId(chatId);
            void loadChats();
          }}
        />
      ) : null}

      {creando?.tipo === 'encuesta' ? (
        <CreatePollOverlay
          jwt={credential.jwt}
          chat={creando.chat}
          onClose={() => setCreando(null)}
          onCreated={(chatId) => {
            setCreando(null);
            setSelectedId(chatId);
            void loadChats();
          }}
        />
      ) : null}

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
