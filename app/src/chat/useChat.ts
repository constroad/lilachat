import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { decidirCargaAnterior } from './paginacion';
import { hidratarChat } from './hidratador';
import { useAcuses } from './useAcuses';
import { chatsEnMemoria } from './memoriaDeChats';
import { listOlderMessages } from '../api/client';
import {
  conciliarPaginaGuardada,
  guardarMensajes,
  leerMensajesGuardados,
  ultimoSeqGuardado,
} from './mensajesGuardados';
import * as Crypto from 'expo-crypto';
import {
  advanceCursors,
  buildOutboxItem,
  conciliarPagina,
  esAcuseDeOtro,
  mismoValor,
  mergeBySeq,
  tramoContiguoAntesDe,
  type Cursors,
  type MencionEnMensaje,
  type Envelope,
  type OutboxItem,
} from '@lilachat/shared';
import { connectSocket, getSocket, type ServerMessage } from './socketClient';
import { pedirEditar, pedirEliminar } from './pedidosDeMensaje';
import { drainOutbox, hydrateOutbox, queueMessage, subscribeOutbox } from './outboxStore';
import { suscribirConfirmados } from './colaDeArchivos';
import { useAvisoDeEscribiendo } from './useAvisoDeEscribiendo';
import { useResumenesDeHilos } from './useResumenesDeHilos';
import { useCambiosDeMensajes } from './useCambiosDeMensajes';
import { useEscribiendoDelChat } from './useEscribiendoDelChat';

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
  /** El server lo rechazó para siempre: por qué (FL8). Se ofrece reintentar o borrar. */
  fallo?: string;
  /**
   * La foto que se está subiendo, leída del disco: aparece al elegirla, como
   * WhatsApp (José, 27/08/2026). No se persiste: un `file://` de la caché deja
   * de valer y reaparecía como burbuja rota.
   */
  mediaUri?: string;
  /** Qué es: con esto se decide si se previsualiza o va como tarjeta. */
  mediaMime?: string;
  /** El nombre, para la tarjeta de archivo mientras sube. */
  mediaNombre?: string;
  /** La forma de la foto que sube (FL9): la misma burbuja que tendrá al llegar. */
  mediaAncho?: number;
  mediaAlto?: number;
  /** 0→1 de esa subida, para pintar el velo de progreso encima. */
  progreso?: number;
  /** E3: respuesta pendiente en el hilo de este `seq`. */
  hiloDe?: number;
  enElChat?: boolean;
};

/**
 * Cuántos mensajes se piden para sanear. Es la última página: alcanza para
 * cubrir el tramo donde de verdad pasan las cosas, y pedir el historial entero
 * en cada apertura sería caro para arreglar algo que casi nunca pasa.
 */
const PAGINA_DE_SANEO = 50;
const PAGINAS_AL_ABRIR = 5; // páginas de 100 del hidratador al abrir; el resto, el respaldo
/** Calma después de abrir antes de rellenar huecos del historial (FL12). */
const ESPERA_PARA_RELLENAR_MS = 3000;

export function useChat(params: {
  chatId: string;
  token: string;
  /** Quién soy: sin esto, mi propio acuse se contaría como el del otro. */
  miUserId: string;
  /** Chat secreto (F9): cifra al ENCOLAR y descifra al mostrar. */
  seal?: (text: string) => Envelope | null;
  open?: (envelope: Envelope) => string | null;
  /** Quiénes cuentan para mis checks y lo que ya dijo el server (FL8, `useAcuses`). */
  acuseDe?: readonly string[];
  baseLeido?: number;
  baseEntregado?: number;
}) {
  // Nace con lo que quedó en memoria de la última vez (FL12, §49 #2): el chat
  // entra pintado en vez de vacío, mientras el disco y la red confirman.
  const [messages, setMessages] = useState<ChatMessage[]>(() => [...(chatsEnMemoria.de(params.chatId) ?? [])]);
  useEffect(() => {
    chatsEnMemoria.recordar(params.chatId, messages);
  }, [params.chatId, messages]);

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
   * el socket fue más rápido, pisar lo suyo con el almacén sería ir para atrás.
   *
   * Se lee la última PÁGINA, no el chat entero (F12.0): el almacén ya guarda
   * todo el historial, y descifrar miles de filas para pintar la primera
   * pantalla es justo lo que hace que una app se sienta pesada. El resto lo trae
   * el scroll hacia arriba, del disco primero.
   */
  useEffect(() => {
    let vigente = true;
    void leerMensajesGuardados(params.chatId, { limite: PAGINA_DE_SANEO }).then((guardados) => {
      if (!vigente || !guardados || guardados.length === 0) return;
      setMessages((actuales) => (actuales.length === 0 ? guardados : actuales));
    });
    return () => {
      vigente = false;
    };
  }, [params.chatId]);

  /**
   * Una página del server, aplicada a la pantalla Y al disco con la misma
   * regla (`conciliarPagina`): dentro de su rango manda el server. Con
   * `mergeBySeq`, un mensaje borrado en la base seguía dibujándose para siempre
   * en cada teléfono que ya lo tenía (pasó con unas líneas de prueba en el grupo
   * de José). Si el disco no se pusiera de acuerdo, la línea volvería al reabrir.
   */
  const aplicarPaginaDelServer = useCallback(
    (pagina: ChatMessage[], ultimoDelServer?: number) => {
      if (pagina.length === 0) return;
      setMessages((actuales) => conciliarPagina(actuales, pagina, ultimoDelServer));
      void conciliarPaginaGuardada(params.chatId, pagina, ultimoDelServer);
    },
    [params.chatId]
  );

  /**
   * Sanear el almacén contra el server al abrir el chat.
   *
   * La carga inicial va por el socket (`sync.pull`), que manda un DELTA desde un
   * cursor: nunca describe el chat entero, así que nunca puede darse cuenta de
   * que algo dejó de existir.
   *
   * **Solo si había algo guardado**: en una instalación nueva no hay nada que
   * sanear y este pedido sería gasto puro.
   */
  useEffect(() => {
    let vigente = true;
    let relleno: number | null = null;
    let demora: ReturnType<typeof setTimeout> | null = null;
    void (async () => {
      const ultimo = await ultimoSeqGuardado(params.chatId);
      if (!vigente || ultimo === null) return;

      const respuesta = await listOlderMessages(
        { chatId: params.chatId, limit: PAGINA_DE_SANEO },
        params.token
      );
      if (!vigente || !respuesta.ok) return;
      aplicarPaginaDelServer(respuesta.data.messages as ChatMessage[], respuesta.data.lastSeq);

      // FL5: el cursor del `sync.pull` es el MAYOR seq guardado y no ve huecos
      // del medio. Se rellenan de fondo; el scroll los lee del disco. NO apenas
      // se abre (FL12, §49 #5): cifrar y escribir páginas peleaba por el hilo JS
      // con la transición y el primer scroll. Después de las animaciones y de
      // unos segundos de calma.
      const { lastSeq } = respuesta.data;
      if (!lastSeq) return;
      // `requestIdleCallback` y no `InteractionManager`, que RN deprecó.
      relleno = requestIdleCallback(() => {
        demora = setTimeout(() => {
          if (!vigente) return;
          void hidratarChat({ chatId: params.chatId, ultimoDelServer: lastSeq, token: params.token, sigue: () => vigente, maxPaginas: PAGINAS_AL_ABRIR });
        }, ESPERA_PARA_RELLENAR_MS);
      });
    })();
    return () => {
      vigente = false;
      if (relleno !== null) cancelIdleCallback(relleno);
      if (demora) clearTimeout(demora);
    };
  }, [params.chatId, params.token, aplicarPaginaDelServer]);

  const cargandoRef = useRef(false);
  const hayMasRef = useRef(true);

  useEffect(() => {
    mensajesRef.current = messages;
    // Ya NO se guarda la lista entera acá: cada mensaje se escribe al LLEGAR
    // (socket, delta, página). Reescribir miles de filas por cada mensaje nuevo
    // es lo que un almacén completo no puede permitirse.
  }, [messages]);

  /**
   * El scroll hacia arriba: del DISCO primero, del server si hace falta.
   *
   * Lo local solo sirve si es contiguo hasta lo que se ve y está entero
   * (`tramoContiguoAntesDe`): un teléfono que volvió tras días tiene un hueco en
   * el medio, y servir lo local saltando el hueco haría desaparecer
   * conversación sin que nadie lo note.
   */
  const cargarAnteriores = useCallback(async () => {
    const decision = decidirCargaAnterior({
      mensajes: mensajesRef.current,
      cargando: cargandoRef.current,
      hayMas: hayMasRef.current,
    });
    if (!decision.cargar) return;

    cargandoRef.current = true;
    setCargandoAnteriores(true);

    const locales = await leerMensajesGuardados(params.chatId, {
      antesDe: decision.beforeSeq,
      limite: decision.limit,
    });
    const tramo = tramoContiguoAntesDe({
      locales: locales ?? [],
      beforeSeq: decision.beforeSeq,
      limit: decision.limit,
    });

    if (tramo) {
      // Menos que una página entera solo pasa llegando al primer mensaje.
      if (tramo.length < decision.limit) {
        hayMasRef.current = false;
        setHayAnteriores(false);
      }
      setMessages((current) => mergeBySeq(current, tramo));
    } else {
      const resultado = await listOlderMessages(
        { chatId: params.chatId, beforeSeq: decision.beforeSeq, limit: decision.limit },
        params.token
      );
      if (resultado.ok) {
        const pagina = resultado.data.messages as ChatMessage[];
        // Una página más corta que el tope significa que no hay nada antes. Es
        // la única señal confiable: una página VACÍA también lo dice, pero
        // esperar a que llegue vacía cuesta un pedido de más.
        if (pagina.length < decision.limit) {
          hayMasRef.current = false;
          setHayAnteriores(false);
        }
        aplicarPaginaDelServer(pagina, resultado.data.lastSeq);
      }
    }

    cargandoRef.current = false;
    setCargandoAnteriores(false);
  }, [params.chatId, params.token, aplicarPaginaDelServer]);
  /**
   * Acuses del OTRO, en vivo. Antes llegaban como prop desde la lista y no se
   * actualizaban nunca: si el otro leía con el chat abierto, el check jamás
   * cambiaba de color.
   */
  const { othersRead, othersDelivered, registrarAcuse } = useAcuses({
    acuseDe: params.acuseDe,
    baseLeido: params.baseLeido ?? 0,
    baseEntregado: params.baseEntregado ?? 0,
  });
  /** Quiénes del OTRO lado están en línea (ids). */
  const [enLinea, setEnLinea] = useState<Set<string>>(new Set());
  /** Quiénes están escribiendo AHORA en este chat (ids), con auto-apagado. */
  const { escribiendo, dejoDeEscribir } = useEscribiendoDelChat(params.chatId, params.miUserId, params.token);

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

  /** Hasta dónde quiero acusar lectura y hasta dónde ya lo dije (ver `markRead`). */
  const leido = useRef({ chatId: params.chatId, deseado: 0, enviado: 0 });
  /** Desconectado no se pierde: queda `deseado` y sale al reconectar. */
  const emitirLeido = useCallback(() => {
    const pendiente = leido.current;
    if (pendiente.deseado <= pendiente.enviado) return;
    const socket = getSocket();
    if (!socket?.connected) return;
    pendiente.enviado = pendiente.deseado;
    socket.emit('read.set', { chatId: pendiente.chatId, seq: pendiente.deseado });
  }, []);

  useEffect(() => {
    let alive = true;
    void hydrateOutbox();

    const unsubscribe = subscribeOutbox((items: OutboxItem[]) => {
      if (!alive) return;
      const delChat = items
          .filter((item) => item.chatId === params.chatId)
          .map((item) => ({
            clientKey: item.clientKey,
            // En un chat cifrado el item NO trae texto: se usa la vista local.
            // Si la app se reinició y ya no está, se dice «🔒 Cifrado» en vez
            // de dejar la burbuja vacía, que parece un mensaje roto.
            body: item.body ?? vistaLocal.current.get(item.clientKey) ?? '🔒 Cifrado',
            queuedAt: item.queuedAt,
            pending: true as const,
            fallo: item.fallo,
            // E3: la respuesta pendiente de un hilo no se dibuja en el chat (salvo «también al chat»).
            ...(item.hiloDe !== undefined ? { hiloDe: item.hiloDe, enElChat: item.enElChat } : {}),
          }));
      // La cola es GLOBAL: avisa por cualquier chat. Si lo de ESTE no cambió se
      // queda el array viejo y la lista no se rearma (FL12, §49 #13).
      setPending((antes) => (mismoValor(antes, delChat) ? antes : delChat));
    });

    const socket = connectSocket(params.token);

    /**
     * El cursor nace del ALMACÉN, no de cero (F12.0). Con `{}` el server
     * contestaba los 200 mensajes MÁS VIEJOS del chat en cada apertura —
     * inútiles para una conversación larga— y el delta real quedaba a cargo de
     * la página de saneo. Con «hasta qué seq ya tengo» pide justo lo que falta.
     */
    const pull = async () => {
      if (cursors.current[params.chatId] === undefined) {
        const ultimo = await ultimoSeqGuardado(params.chatId);
        if (!alive) return;
        cursors.current = { ...cursors.current, [params.chatId]: ultimo ?? 0 };
      }
      socket.emit('sync.pull', { cursors: cursors.current }, (response: unknown) => {
        const payload = response as { ok?: boolean; batches?: { chatId: string; messages: ServerMessage[] }[] };
        if (!alive || !payload?.ok || !payload.batches) return;
        cursors.current = advanceCursors(cursors.current, payload.batches);
        const mine = payload.batches.find((batch) => batch.chatId === params.chatId);
        if (mine && mine.messages.length > 0) {
          setMessages((current) => mergeBySeq(current, mine.messages as ChatMessage[]));
          // Al disco al LLEGAR, cifrado: si la app se cierra en el próximo
          // segundo, lo que ya llegó tiene que estar la próxima vez.
          void guardarMensajes(params.chatId, mine.messages as ChatMessage[]);
          // Acusar entrega hasta el último que llegó, si alguno es del otro.
          const ajenos = mine.messages.filter((msj) =>
            esAcuseDeOtro({ de: String(msj.senderId), yo: params.miUserId })
          );
          if (ajenos.length > 0) {
            const ultimo = Math.max(...ajenos.map((msj) => msj.seq));
            getSocket()?.emit('deliver.set', { chatId: params.chatId, seq: ultimo });
          }
        }
        // Reconectado: lo que quedó en la cola sale ahora.
        void drainOutbox();
      });
    };

    const onConnect = () => {
      if (!alive) return;
      setConnected(true);
      void pull();
      emitirLeido();
      // Pedir el estado de presencia: el snapshot del connect ya lo consumió la
      // lista de chats, así que sin esto el header abría sin «en línea».
      socket.emit('presence.request');
    };
    const onDisconnect = () => alive && setConnected(false);
    /** Un mensaje confirmado, venga del socket o de la respuesta de una subida (`mergeBySeq` deduplica). */
    const incorporar = (message: ServerMessage) => {
      cursors.current = advanceCursors(cursors.current, [
        { chatId: message.chatId, messages: [message] },
      ]);
      setMessages((current) => mergeBySeq(current, [message as ChatMessage]));
      void guardarMensajes(params.chatId, [message as ChatMessage]);
    };
    const dejarDeOirSubidas = suscribirConfirmados((message) => alive && message.chatId === params.chatId && incorporar(message));
    const onNew = (message: ServerMessage) => {
      if (!alive || message.chatId !== params.chatId) return;
      incorporar(message);
      // Su mensaje llegó: ya no está escribiendo (como WhatsApp). Sin esto el
      // «escribiendo…» seguía hasta el temporizador de 6 s.
      dejoDeEscribir(String(message.senderId));
      // Sin `deliver.set` acá (FL12, §49 #3): si llegó en vivo es porque estoy
      // conectado, y el server ya lo marcó entregado al repartirlo
      // (`avisarMensajeNuevo`). El acuse de más se repartía a todo el chat.
      // Lo que llega por `sync.pull` (estaba desconectado) sí se acusa.
    };

    const onReceipt = (frame: {
      chatId: string;
      userId: string;
      readSeq?: number;
      deliveredSeq?: number;
    }) => {
      if (!alive || frame.chatId !== params.chatId) return;
      // MI acuse no dice nada del otro. El server los manda a todos los
      // miembros, incluido quien leyó, y sin este filtro abrir el chat pintaba
      // de azul todos mis mensajes al instante.
      if (!esAcuseDeOtro({ de: frame.userId, yo: params.miUserId })) return;
      // Nunca retroceden: dos dispositivos del otro mandan acuses desordenados.
      // Entregado y leído son cursores SEPARADOS — de ahí salen los dos checks
      // grises y los dos azules.
      registrarAcuse(frame.userId, frame.readSeq, frame.deliveredSeq);
    };


    const onSnapshot = (frame: { online: string[] }) =>
      alive && setEnLinea(new Set(frame.online));
    const onPresence = (frame: { userId: string; online: boolean }) => {
      if (!alive) return;
      setEnLinea((prev) => {
        // Sin cambio, el mismo Set: un «en línea» repetido no redibuja (FL12).
        if (prev.has(frame.userId) === frame.online) return prev;
        const next = new Set(prev);
        if (frame.online) next.add(frame.userId);
        else next.delete(frame.userId);
        return next;
      });
    };
    socket.on('presence.snapshot', onSnapshot);
    socket.on('presence', onPresence);

    socket.on('receipt', onReceipt);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('msg.new', onNew);
    if (socket.connected) onConnect();

    return () => {
      alive = false;
      unsubscribe();
      dejarDeOirSubidas();
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('msg.new', onNew);
      socket.off('receipt', onReceipt);
      socket.off('presence.snapshot', onSnapshot);
      socket.off('presence', onPresence);
    };
  }, [params.chatId, params.token, registrarAcuse, emitirLeido, dejoDeEscribir]);
  // E3: el chip de cada raíz al día, en vivo y al reconectar.
  useResumenesDeHilos({ chatId: params.chatId, token: params.token, setMessages });
  // Borrado, editado y reacciones de lo ya enviado.
  const { reaccionar } = useCambiosDeMensajes({ chatId: params.chatId, token: params.token, yo: params.miUserId, setMessages, mensajes: messages });

  /**
   * Enviar = ENCOLAR. Nunca se manda directo: así el camino con red y el camino
   * sin red son el mismo código, y el sin-red no es un caso especial que se
   * pruebe último (y por eso se rompa).
   */
  const send = useCallback(
    async (body: string, replyToSeq?: number, menciones?: (texto: string) => MencionEnMensaje[], hilo?: { de: number; enElChat?: boolean }) => {
      // `buildOutboxItem` decide si va texto o sobre. En un chat cifrado
      // devuelve `null` si NO se pudo cifrar, y entonces no se encola nada:
      // caer a texto plano con el candado en pantalla sería mentir.
      const item = buildOutboxItem({
        chatId: params.chatId,
        clientKey: Crypto.randomUUID(),
        text: body,
        queuedAt: new Date().toISOString(),
        replyToSeq,
        seal: params.seal,
        menciones,
        ...(hilo ? { hiloDe: hilo.de, enElChat: hilo.enElChat } : {}),
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
  /**
   * Solo cuando SUBE (FL12, §49 #4): el efecto que lo llama corre en cada
   * cambio de `messages` —disco, saneo, páginas, ediciones, mi propio eco— y
   * cada `read.set` eran cuatro viajes a la base y un acuse a todo el chat.
   */
  const markRead = useCallback(
    (seq: number) => {
      if (leido.current.chatId !== params.chatId) leido.current = { chatId: params.chatId, deseado: 0, enviado: 0 };
      leido.current.deseado = Math.max(leido.current.deseado, seq);
      emitirLeido();
    },
    [params.chatId, emitirLeido]
  );

  const avisarEscribiendo = useAvisoDeEscribiendo(params.chatId);

  // `visibles`, no `messages`: la pantalla recibe lo ya descifrado.
  const eliminar = useCallback((seq: number) => pedirEliminar(params.chatId, seq), [params.chatId]);
  const editar = useCallback((seq: number, body: string) => pedirEditar(params.chatId, seq, body), [params.chatId]);

  return {
    eliminar,
    editar,
    reaccionar,
    messages: visibles,
    pending,
    connected,
    othersRead,
    othersDelivered,
    enLinea,
    escribiendo,
    avisarEscribiendo,
    send,
    markRead,
    cargandoAnteriores,
    hayAnteriores,
    cargarAnteriores,
  };
}
