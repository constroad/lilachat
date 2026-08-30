import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { decidirCargaAnterior } from './paginacion';
import { listOlderMessages } from '../api/client';
import { guardarMensajes, leerMensajesGuardados } from './mensajesGuardados';
import * as Crypto from 'expo-crypto';
import {
  advanceCursors,
  buildOutboxItem,
  conciliarPagina,
  mergeBySeq,
  type Cursors,
  type Envelope,
  type OutboxItem,
} from '@lilachat/shared';
import { connectSocket, getSocket, type ServerMessage } from './socketClient';
import { uploadMedia, type UploadResult } from './mediaUpload';
import { drainOutbox, hydrateOutbox, queueMessage, subscribeOutbox } from './outboxStore';

/**
 * El estado vivo de un chat: mensajes confirmados + lo que está en la cola.
 *
 * Al reconectar NO se recarga todo: se pide el delta por cursor
 * (`sync.pull`) — el modelo de Telegram. Y el mismo mensaje puede llegar por
 * dos caminos (evento en vivo y lote de sync), por eso todo pasa por
 * `mergeBySeq`, que deduplica.
 */
export type ChatMessage = ServerMessage & { pending?: false };
export type PendingMessage = {
  clientKey: string;
  body?: string;
  queuedAt: string;
  pending: true;
  /**
   * La foto que se esta subiendo, leida del DISCO del telefono.
   *
   * Existe para que la imagen aparezca en el chat en el instante en que la
   * elegis, como WhatsApp, en vez de despues de que termine de subir (José,
   * 27/08/2026: «espera a subir y recien alli lo muestra, eso esta mal»).
   *
   * No se persiste en la cola: un `file://` deja de valer cuando el sistema
   * limpia la cache, asi que una foto pendiente guardada en disco reaparecia
   * como una burbuja rota.
   */
  mediaUri?: string;
  /** Qué es: con esto se decide si se previsualiza o va como tarjeta. */
  mediaMime?: string;
  /** El nombre, para la tarjeta de archivo mientras sube. */
  mediaNombre?: string;
  /** 0→1 de esa subida, para pintar el velo de progreso encima. */
  progreso?: number;
};

/**
 * Cuántos mensajes se piden para sanear. Es la última página: alcanza para
 * cubrir el tramo donde de verdad pasan las cosas, y pedir el historial entero
 * en cada apertura sería caro para arreglar algo que casi nunca pasa.
 */
const PAGINA_DE_SANEO = 50;

export function useChat(params: {
  chatId: string;
  token: string;
  /** Chat secreto (F9): cifra al ENCOLAR y descifra al mostrar. */
  seal?: (text: string) => Envelope | null;
  open?: (envelope: Envelope) => string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  /**
   * Los mensajes ya descifrados, DERIVADOS del estado.
   *
   * El descifrado NO se hornea al guardar, y eso costó un E2E: la sesión de
   * cifrado tarda un instante en tener la clave del otro, así que los mensajes
   * que entraban antes quedaban con «no se pudo descifrar» para siempre —
   * aunque la clave llegara un segundo después—. Derivándolo, en cuanto la
   * sesión está lista todo se vuelve a leer bien solo.
   *
   * Si un sobre no abre igual se DICE, en vez de mostrar una burbuja vacía:
   * puede ser de antes de tener la clave, o uno manipulado, y las dos cosas son
   * información real.
   */
  const visibles = useMemo(
    () =>
      messages.map((message) =>
        message.envelope
          ? { ...message, body: params.open?.(message.envelope) ?? '🔒 No se pudo descifrar' }
          : message
      ),
    [messages, params.open]
  );
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [connected, setConnected] = useState(false);
  /**
   * El scroll hacia arriba, como WhatsApp.
   *
   * `hayAnteriores` arranca en `true` porque todavía no se sabe: se apaga solo
   * cuando una página vuelve más corta de lo pedido, que es la única señal
   * confiable de haber llegado al principio de la conversación.
   */
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false);
  const [hayAnteriores, setHayAnteriores] = useState(true);

  /**
   * Refs y no estado dentro de `cargarAnteriores`.
   *
   * El callback lo llama la lista al llegar arriba, y si dependiera del estado
   * se recrearía en cada mensaje nuevo — la lista lo vería como una prop
   * distinta y volvería a disparar. Con refs, la función es estable y lee
   * siempre lo último.
   */
  const mensajesRef = useRef<ChatMessage[]>([]);
  /**
   * Lo guardado se pinta ANTES de que conteste el socket — la app es
   * local-first desde acá. Solo se usa si todavía no llegó nada de la red: si
   * el socket fue más rápido, pisar lo suyo con la caché sería ir para atrás.
   */
  useEffect(() => {
    let vigente = true;
    void leerMensajesGuardados(params.chatId).then((guardados) => {
      if (!vigente || !guardados || guardados.length === 0) return;
      setMessages((actuales) => (actuales.length === 0 ? guardados : actuales));
    });
    return () => {
      vigente = false;
    };
  }, [params.chatId]);
  /**
   * Sanear la caché contra el server al abrir el chat.
   *
   * La carga inicial va por el socket (`sync.pull`), que manda un DELTA desde un
   * cursor: nunca describe el chat entero, así que nunca puede darse cuenta de
   * que algo dejó de existir. Un mensaje borrado en la base seguía dibujándose
   * para siempre en cada teléfono que ya lo tenía (le pasó al grupo de José con
   * unas líneas de una prueba mía).
   *
   * **Solo si había caché**: en una instalación nueva no hay nada que sanear y
   * este pedido sería gasto puro.
   */
  useEffect(() => {
    let vigente = true;
    void (async () => {
      const guardados = await leerMensajesGuardados(params.chatId);
      if (!vigente || !guardados || guardados.length === 0) return;

      const respuesta = await listOlderMessages(
        { chatId: params.chatId, limit: PAGINA_DE_SANEO },
        params.token
      );
      if (!vigente || !respuesta.ok) return;

      const pagina = respuesta.data.messages as ChatMessage[];
      if (pagina.length === 0) return;
      setMessages((actuales) => conciliarPagina(actuales, pagina, respuesta.data.lastSeq));
    })();
    return () => {
      vigente = false;
    };
  }, [params.chatId, params.token]);

  const cargandoRef = useRef(false);
  const hayMasRef = useRef(true);

  useEffect(() => {
    mensajesRef.current = messages;
    // Se guarda lo que hay, cifrado. No se espera a nada: si la app se cierra
    // en el próximo segundo, lo que ya llegó tiene que estar la próxima vez.
    if (messages.length > 0) void guardarMensajes(params.chatId, messages);
  }, [messages, params.chatId]);

  const cargarAnteriores = useCallback(async () => {
    const decision = decidirCargaAnterior({
      mensajes: mensajesRef.current,
      cargando: cargandoRef.current,
      hayMas: hayMasRef.current,
    });
    if (!decision.cargar) return;

    cargandoRef.current = true;
    setCargandoAnteriores(true);

    const resultado = await listOlderMessages(
      { chatId: params.chatId, beforeSeq: decision.beforeSeq, limit: decision.limit },
      params.token
    );

    if (resultado.ok) {
      const pagina = resultado.data.messages as ChatMessage[];
      // Una página más corta que el tope significa que no hay nada antes. Es la
      // única señal confiable: una página VACÍA también lo dice, pero esperar a
      // que llegue vacía cuesta un pedido de más.
      if (pagina.length < decision.limit) {
        hayMasRef.current = false;
        setHayAnteriores(false);
      }
      // `conciliarPagina` y no `mergeBySeq`: dentro del rango que el server
      // acaba de describir, MANDA el server. Con el merge, un mensaje borrado
      // en la base seguía dibujándose para siempre en cada teléfono que ya lo
      // tenía guardado (pasó con unas líneas de prueba en el grupo de José).
      if (pagina.length > 0) {
        const tope = (resultado.data as { lastSeq?: number }).lastSeq;
        setMessages((current) => conciliarPagina(current, pagina, tope));
      }
    }

    cargandoRef.current = false;
    setCargandoAnteriores(false);
  }, [params.chatId, params.token]);
  /**
   * Acuses del OTRO, en vivo. Antes llegaban como prop desde la lista y no se
   * actualizaban nunca: si el otro leía con el chat abierto, el check jamás
   * cambiaba de color.
   */
  const [othersRead, setOthersRead] = useState(0);

  /**
   * El texto de lo que YO acabo de mandar en un chat cifrado, solo para
   * mostrarlo mientras está en la cola.
   *
   * Vive en MEMORIA y nunca se persiste: la cola guarda el sobre, y el plano en
   * disco sería exactamente lo que el candado promete que no pasa. El precio es
   * que, si la app se cierra con algo pendiente, esa burbuja se ve como
   * «🔒 Cifrado» hasta que el server la devuelva — que es la verdad, y es mejor
   * que una burbuja vacía.
   */
  const vistaLocal = useRef(new Map<string, string>());
  const cursors = useRef<Cursors>({});

  useEffect(() => {
    let alive = true;
    void hydrateOutbox();

    const unsubscribe = subscribeOutbox((items: OutboxItem[]) => {
      if (!alive) return;
      setPending(
        items
          .filter((item) => item.chatId === params.chatId)
          .map((item) => ({
            clientKey: item.clientKey,
            // En un chat cifrado el item NO trae texto: se usa la vista local.
            // Si la app se reinició y ya no está, se dice «🔒 Cifrado» en vez
            // de dejar la burbuja vacía, que parece un mensaje roto.
            body: item.body ?? vistaLocal.current.get(item.clientKey) ?? '🔒 Cifrado',
            queuedAt: item.queuedAt,
            pending: true as const,
          }))
      );
    });

    const socket = connectSocket(params.token);

    const pull = () => {
      socket.emit('sync.pull', { cursors: cursors.current }, (response: unknown) => {
        const payload = response as { ok?: boolean; batches?: { chatId: string; messages: ServerMessage[] }[] };
        if (!alive || !payload?.ok || !payload.batches) return;
        cursors.current = advanceCursors(cursors.current, payload.batches);
        const mine = payload.batches.find((batch) => batch.chatId === params.chatId);
        if (mine) setMessages((current) => mergeBySeq(current, mine.messages as ChatMessage[]));
        // Reconectado: lo que quedó en la cola sale ahora.
        void drainOutbox();
      });
    };

    const onConnect = () => {
      if (!alive) return;
      setConnected(true);
      pull();
    };
    const onDisconnect = () => alive && setConnected(false);
    const onNew = (message: ServerMessage) => {
      if (!alive || message.chatId !== params.chatId) return;
      cursors.current = advanceCursors(cursors.current, [
        { chatId: message.chatId, messages: [message] },
      ]);
      setMessages((current) => mergeBySeq(current, [message as ChatMessage]));
    };

    const onReceipt = (frame: { chatId: string; userId: string; readSeq: number }) => {
      if (!alive || frame.chatId !== params.chatId) return;
      // Nunca retrocede: dos dispositivos del otro mandan acuses desordenados.
      setOthersRead((current) => Math.max(current, frame.readSeq));
    };

    /**
     * Alguien borró un mensaje: se reemplaza por su lápida en el acto.
     *
     * No se saca de la lista: el `seq` sostiene el orden y la sincronización por
     * cursor, y además un hueco cambiaría el sentido de la conversación sin
     * avisar.
     */
    const onDeleted = (frame: { chatId: string; seq: number }) => {
      if (!alive || frame.chatId !== params.chatId) return;
      setMessages((current) =>
        current.map((m) =>
          m.seq === frame.seq
            ? { ...m, deletedAt: new Date().toISOString(), body: undefined, media: undefined, envelope: undefined }
            : m
        )
      );
    };
    socket.on('msg.deleted', onDeleted);

    socket.on('receipt', onReceipt);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('msg.new', onNew);
    if (socket.connected) onConnect();

    return () => {
      alive = false;
      unsubscribe();
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('msg.new', onNew);
      socket.off('receipt', onReceipt);
      socket.off('msg.deleted', onDeleted);
    };
  }, [params.chatId, params.token]);

  /**
   * Enviar = ENCOLAR. Nunca se manda directo: así el camino con red y el camino
   * sin red son el mismo código, y el sin-red no es un caso especial que se
   * pruebe último (y por eso se rompa).
   */
  const send = useCallback(
    async (body: string) => {
      // `buildOutboxItem` decide si va texto o sobre. En un chat cifrado
      // devuelve `null` si NO se pudo cifrar, y entonces no se encola nada:
      // caer a texto plano con el candado en pantalla sería mentir.
      const item = buildOutboxItem({
        chatId: params.chatId,
        clientKey: Crypto.randomUUID(),
        text: body,
        queuedAt: new Date().toISOString(),
        seal: params.seal,
      });
      if (!item) return { ok: false as const };
      if (item.envelope) vistaLocal.current.set(item.clientKey, body.trim());
      await queueMessage(item);
      return { ok: true as const };
    },
    [params.chatId, params.seal]
  );

  /**
   * Media: sube por HTTP y el mensaje lo crea el server en el MISMO request.
   * El resultado no se inserta a mano en la lista — llega por `msg.new` como
   * cualquier otro mensaje, y `mergeBySeq` evita el duplicado.
   */
  const sendMedia = useCallback(
    async (file: {
      uri: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      caption?: string;
      onProgress?: (ratio: number) => void;
    }): Promise<UploadResult> =>
      uploadMedia({
        token: params.token,
        chatId: params.chatId,
        clientKey: Crypto.randomUUID(),
        ...file,
      }),
    [params.chatId, params.token]
  );

  const markRead = useCallback(
    (seq: number) => {
      getSocket()?.emit('read.set', { chatId: params.chatId, seq });
    },
    [params.chatId]
  );

  // `visibles`, no `messages`: la pantalla recibe lo ya descifrado.
  /**
   * Pide borrar para todos. El server decide y avisa a todos por `msg.deleted`,
   * así que acá NO se toca la lista: se espera el eco. Adelantarse haría que un
   * rechazo del server dejara la pantalla mintiendo.
   */
  const eliminar = useCallback(
    (seq: number) =>
      new Promise<{ ok: boolean; motivo?: string }>((resolve) => {
        const socket = getSocket();
        if (!socket) return resolve({ ok: false, motivo: 'Sin conexión.' });
        socket.emit('msg.delete', { chatId: params.chatId, seq }, (r: unknown) => {
          const respuesta = (r ?? {}) as { ok?: boolean; motivo?: string };
          resolve({ ok: Boolean(respuesta.ok), motivo: respuesta.motivo });
        });
      }),
    [params.chatId]
  );

  return {
    eliminar,
    messages: visibles,
    pending,
    connected,
    othersRead,
    send,
    sendMedia,
    markRead,
    cargandoAnteriores,
    hayAnteriores,
    cargarAnteriores,
  };
}
