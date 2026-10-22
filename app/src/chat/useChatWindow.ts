import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { FlashListRef } from '@shopify/flash-list';
import { extendWindow, nextWindowPage, targetStatus, windowFromPage, type MessageWindow, type WindowSide } from '@lilachat/shared';
import { messageWindowPage } from '../api/client';
import { windowRows } from './messageWindowRows';
import { filaDeArchivoEnCola, pendientesEnOrden, sinPendientesConfirmados } from './filasDelChat';
import { sinOcultos } from './ocultos';
import { isPending, type Row } from './rowKinds';
import type { ChatMessage, PendingMessage } from './useChat';
import type { useArchivosDelChat } from './useArchivosDelChat';
import type { OpeningPlace } from './useDivisorNoLeidos';

const PAGE = 50;

/**
 * An old message opened with its context (pending 44, José 22/10: «Ese mensaje
 * está más arriba: sube para cargarlo» when opening a checklist, a reminder or
 * a photo). Like WhatsApp: a window around it from the server, paged up and
 * down, apart from the live end, which never gets a stretch glued to it. What
 * shows on screen (rows and messages) comes from here; `viewId` remounts the
 * list so it places itself on the message. Sending something goes back to the end.
 */
export function useChatWindow(p: {
  jwt: string;
  chatId: string;
  encrypted: boolean;
  messages: ChatMessage[];
  hilos: { delChat: ChatMessage[]; pendientesDelChat: PendingMessage[] };
  ocultos: ReadonlySet<number>;
  archivosEnCola: ReturnType<typeof useArchivosDelChat>;
  listaRef: MutableRefObject<FlashListRef<Row> | null>;
  onNoEsta: (texto: string) => void;
  onThread: (root: number) => void;
}) {
  const { jwt, chatId, encrypted, messages: liveMessages, ocultos, archivosEnCola, listaRef, onNoEsta, onThread } = p;
  const { delChat, pendientesDelChat } = p.hilos;
  // Memoized: each render (a key, a «typing») used to redraw every bubble (FL2).
  const liveRows: Row[] = useMemo(
    () => [
      // «Eliminar para mí» (FL9): hidden on this phone.
      ...sinOcultos(delChat, ocultos),
      // What is pending, in the order it was sent. The echo can arrive before the ack:
      // without the filter the bubble showed twice (files share their `clientKey`).
      ...pendientesEnOrden(
        sinPendientesConfirmados(pendientesDelChat, liveMessages),
        sinPendientesConfirmados(archivosEnCola.map(({ archivo, progreso }) => filaDeArchivoEnCola(archivo, progreso)), liveMessages)
      ),
    ],
    [liveMessages, ocultos, archivosEnCola, delChat, pendientesDelChat]
  );
  const [opened, setOpened] = useState<MessageWindow<ChatMessage> | null>(null);
  const [viewId, setViewId] = useState(0);
  const loading = useRef(false);
  const current = useRef(opened);
  current.current = opened;

  const ask = useCallback(async (query: string) => {
    const page = await messageWindowPage({ chatId, query, limit: PAGE }, jwt);
    return page.ok ? { ...page.data, messages: page.data.messages as ChatMessage[] } : null;
  }, [jwt, chatId]);

  const close = useCallback(() => {
    if (!current.current) return;
    setOpened(null);
    setViewId((before) => before + 1);
  }, []);

  /** Not on screen: the window around it; a thread-only reply opens its thread. */
  const alNoEstar = useCallback((texto: string, seq: number) => {
    if (encrypted || loading.current) return onNoEsta(texto);
    loading.current = true;
    void ask(`around=${seq}`).then((page) => {
      loading.current = false;
      const made = page ? windowFromPage(page, seq) : null;
      if (!made) return onNoEsta(page ? 'Ese mensaje ya no está en el chat.' : 'Sin conexión: ese mensaje todavía no está en este teléfono.');
      const status = targetStatus(made, seq);
      if (status === 'thread') return onThread(made.messages.find((message) => message.seq === seq)?.hiloDe ?? seq);
      if (status === 'missing') return onNoEsta('Ese mensaje ya no está en el chat.');
      setOpened(made);
      setViewId((before) => before + 1);
    });
  }, [encrypted, ask, onNoEsta, onThread]);

  const load = useCallback(async (side: WindowSide) => {
    const open = current.current;
    const next = open ? nextWindowPage(open, side) : null;
    if (!next || loading.current) return;
    loading.current = true;
    const page = await ask('beforeSeq' in next ? `beforeSeq=${next.beforeSeq}` : `afterSeq=${next.afterSeq}`);
    loading.current = false;
    if (!page) return;
    const more = side === 'older' ? page.messages.length >= PAGE : (page.hasNewer ?? page.messages.length >= PAGE);
    setOpened((before) => (before ? extendWindow(before, side, { messages: page.messages, more }) : before));
  }, [ask]);

  // Something of mine being sent: back to the end, like WhatsApp.
  const lastLive = liveRows[liveRows.length - 1];
  const sending = lastLive !== undefined && isPending(lastLive) ? lastLive.clientKey : null;
  useEffect(() => {
    if (sending) close();
  }, [sending, close]);
  useEffect(() => {
    setOpened(null);
  }, [chatId]);

  const rows = useMemo(() => (opened ? windowRows(opened, liveRows) : liveRows), [opened, liveRows]);
  /** On mount of each view: the window goes to its message; leaving it goes to the end; the first opening as always. */
  const placement = useCallback(
    (alAbrir: () => OpeningPlace, goTo: (seq: number) => void) => (): OpeningPlace => {
      const open = current.current;
      if (open) {
        goTo(open.target);
        return 'away';
      }
      if (viewId === 0) return alAbrir();
      listaRef.current?.scrollToEnd({ animated: false });
      return 'end';
    },
    [viewId, listaRef]
  );
  return {
    rows,
    messages: opened ? opened.messages : liveMessages,
    inWindow: opened !== null,
    hasOlder: opened?.hasOlder ?? false,
    alNoEstar,
    placement,
    loadOlder: () => void load('older'),
    list: viewId > 0 ? { viewId, inWindow: opened !== null, onCargarSiguientes: () => void load('newer'), onIrAlUltimo: close } : undefined,
  };
}
