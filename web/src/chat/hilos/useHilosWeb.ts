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
  const [, setVersion] = useState(0);
  useEffect(() => {
    setAbierto(null);
  }, [chatId]);

  useEffect(() => {
    if (!base || !jwt) return;
    void api<{ hilos: { raiz: number; hilo: NonNullable<ChatMessage['hilo']> }[] }>(`/chats/${chatId}/hilos`, { jwt }).then((r) => {
      if (r.ok) r.data.hilos.forEach(({ raiz, hilo }) => void aplicarResumenDeHilo(base, { chatId, raiz, hilo }));
    });
  }, [chatId, jwt, base]);

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
    if (abierto !== null && ultima && guardarVisto(chatId, abierto, ultima)) setVersion((v) => v + 1);
  }, [abierto, ultima, chatId]);

  const hiloConNuevas = useCallback(
    (seq: number) => {
      const raiz = mensajes?.find((uno) => uno.seq === seq);
      return raiz?.hilo ? hayRespuestasNuevas(raiz.hilo, leerVistos()[chatId]?.[String(seq)], yo) : false;
    },
    [mensajes, chatId, yo]
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
