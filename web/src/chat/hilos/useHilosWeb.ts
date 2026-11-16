import { useCallback, useEffect, useMemo, useState } from 'react';
import { hayRespuestasNuevas, respuestasDelHilo, visibleEnElChat } from '@lilachat/shared';
import { api } from '../../api';
import { aplicarResumenDeHilo } from '../../local/mensajesLocales';
import type { BaseLocal } from '../../local/baseLocal';
import type { ChatMessage, MensajeEnPantalla } from '../types';

const CLAVE_VISTOS = 'lilachat-hilos-vistos';

function leerVistos(): Record<string, Record<string, number>> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_VISTOS) ?? '{}') as Record<string, Record<string, number>>;
  } catch {
    return {};
  }
}

function guardarVisto(chatId: string, raiz: number, hasta: number): boolean {
  const vistos = leerVistos();
  if ((vistos[chatId]?.[String(raiz)] ?? 0) >= hasta) return false;
  vistos[chatId] = { ...vistos[chatId], [String(raiz)]: hasta };
  try {
    localStorage.setItem(CLAVE_VISTOS, JSON.stringify(vistos));
  } catch {
    // Sin almacenamiento (pestaña privada): el punto de «nuevas» vuelve al recargar.
  }
  return true;
}

/**
 * Los hilos en la web (E3, 20/10): el chat sin las respuestas (salvo «También
 * enviar al chat»), el resumen de las raíces al abrir el chat (lo que cambió
 * con la pestaña cerrada), el hilo abierto con lo que trae el server, y el
 * punto de «nuevas» (lo visto vive en este navegador).
 */
export function useHilosWeb(params: { chatId: string; jwt: string; base: BaseLocal | null; yo: string; mensajes: MensajeEnPantalla[] | null }) {
  const { chatId, jwt, base, yo, mensajes } = params;
  const [abierto, setAbierto] = useState<number | null>(null);
  const [remotas, setRemotas] = useState<ChatMessage[]>([]);
  // This chat's read marks as state: a thread read redraws its chip (José 16/11: the dot never went out).
  const [seenOfChat, setSeenOfChat] = useState(() => leerVistos()[chatId] ?? {});
  const markSeen = useCallback(
    (root: number, upTo: number) => {
      if (guardarVisto(chatId, root, upTo)) setSeenOfChat(leerVistos()[chatId] ?? {});
    },
    [chatId]
  );
  useEffect(() => {
    setAbierto(null);
    setSeenOfChat(leerVistos()[chatId] ?? {});
  }, [chatId]);

  useEffect(() => {
    if (!base || !jwt) return;
    void api<{ hilos: { raiz: number; hilo: NonNullable<ChatMessage['hilo']>; visto?: number }[] }>(`/chats/${chatId}/hilos`, { jwt }).then((r) => {
      if (!r.ok) return;
      for (const { raiz, hilo, visto } of r.data.hilos) {
        void aplicarResumenDeHilo(base, { chatId, raiz, hilo });
        // Read on another device (the phone) is read here too.
        if (visto) markSeen(raiz, visto);
      }
    });
  }, [chatId, jwt, base, markSeen]);

  useEffect(() => {
    setRemotas([]);
    if (abierto === null || !jwt) return;
    let vivo = true;
    void api<{ respuestas: ChatMessage[] }>(`/chats/${chatId}/hilos/${abierto}`, { jwt }).then((r) => vivo && r.ok && setRemotas(r.data.respuestas));
    return () => void (vivo = false);
  }, [abierto, chatId, jwt]);

  const visibles = useMemo(() => mensajes?.filter(visibleEnElChat) ?? null, [mensajes]);
  const respuestas = useMemo(() => {
    if (abierto === null) return [];
    const porSeq = new Map<number, MensajeEnPantalla>();
    for (const mensaje of [...remotas, ...respuestasDelHilo((mensajes ?? []).filter((uno) => !uno.estado), abierto)]) porSeq.set(mensaje.seq, mensaje);
    const pendientes = (mensajes ?? []).filter((uno) => uno.estado && uno.hiloDe === abierto);
    return [...[...porSeq.values()].sort((a, b) => a.seq - b.seq), ...pendientes];
  }, [abierto, remotas, mensajes]);

  const ultima = respuestas.filter((uno) => !uno.estado).at(-1)?.seq;
  useEffect(() => {
    if (abierto === null || !ultima) return;
    markSeen(abierto, ultima);
    // A reply that arrives with the thread open is read on every device.
    void api(`/chats/${chatId}/hilos/${abierto}/visto`, { method: 'POST', jwt, body: { seq: ultima } });
  }, [abierto, ultima, chatId, jwt, markSeen]);

  const hiloConNuevas = useCallback(
    (seq: number) => {
      const raiz = mensajes?.find((uno) => uno.seq === seq);
      return raiz?.hilo ? hayRespuestasNuevas(raiz.hilo, seenOfChat[String(seq)], yo) : false;
    },
    [mensajes, seenOfChat, yo]
  );

  return {
    visibles,
    abierto,
    abrir: setAbierto,
    cerrar: useCallback(() => setAbierto(null), []),
    raiz: abierto === null ? null : (mensajes?.find((uno) => uno.seq === abierto && !uno.estado) ?? null),
    respuestas,
    hiloConNuevas,
  };
}
