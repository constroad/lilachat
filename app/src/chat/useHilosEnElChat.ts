import { useCallback, useEffect, useMemo, useState } from 'react';
import { hayRespuestasNuevas, respuestasDelHilo, visibleEnElChat, type ResumenDeHiloEnCliente } from '@lilachat/shared';
import { hiloCompleto } from '../api/client';
import { marcarHiloVisto, suscribirHilosVistos, vistoHasta } from './hilosVistos';
import type { ChatMessage, PendingMessage } from './useChat';

/**
 * Los hilos dentro de la conversación (E3, 20/10): qué se ve en el chat (las
 * respuestas no, salvo «También enviar al chat»), cuál está abierto, si una
 * raíz tiene respuestas que no vi, y las respuestas del abierto —las de la
 * memoria más las que trae el server (historia que el teléfono no guardó)—.
 */
export function useHilosEnElChat(params: {
  chatId: string;
  yo: string;
  jwt: string;
  messages: readonly ChatMessage[];
  pending: readonly PendingMessage[];
  /** Open this thread (root) on arrival: tapping a reply's notice. `requestedAt` asks again with the chat already open. */
  openThread?: number;
  requestedAt?: number;
}) {
  const { chatId, yo, jwt, messages, pending, openThread, requestedAt } = params;
  const [abierto, setAbierto] = useState<number | null>(null);
  /** Opened by «Responder» (pending 110): the reply field takes the keyboard. */
  const [typing, setTyping] = useState(false);
  const [remotas, setRemotas] = useState<ChatMessage[]>([]);
  /** The root as the server has it: a thread opened from a notice may be older than the window the chat loaded. */
  const [raizRemota, setRaizRemota] = useState<ChatMessage | null>(null);
  useEffect(() => {
    if (openThread !== undefined) setAbierto(openThread);
  }, [openThread, requestedAt]);
  const [, setVersion] = useState(0);
  useEffect(() => suscribirHilosVistos(() => setVersion((v) => v + 1)), []);

  const delChat = useMemo(() => messages.filter(visibleEnElChat), [messages]);
  const pendientesDelChat = useMemo(() => pending.filter(visibleEnElChat), [pending]);
  const hiloConNuevas = useCallback((seq: number, hilo: ResumenDeHiloEnCliente) => hayRespuestasNuevas(hilo, vistoHasta(chatId, seq), yo), [chatId, yo]);

  // Al abrir, lo que el server tiene del hilo (puede haber respuestas que este teléfono nunca bajó).
  useEffect(() => {
    setRemotas([]);
    setRaizRemota(null);
    if (abierto === null) return;
    let vivo = true;
    void hiloCompleto(jwt, chatId, abierto).then((respuesta) => {
      if (!vivo || !respuesta.ok) return;
      setRemotas(respuesta.data.respuestas as ChatMessage[]);
      setRaizRemota((respuesta.data.raiz ?? null) as ChatMessage | null);
    });
    return () => void (vivo = false);
  }, [abierto, chatId, jwt]);

  const respuestas = useMemo(() => {
    if (abierto === null) return [];
    const porSeq = new Map<number, ChatMessage>();
    for (const mensaje of [...remotas, ...respuestasDelHilo(messages, abierto)]) porSeq.set(mensaje.seq, mensaje);
    return [...porSeq.values()].sort((a, b) => a.seq - b.seq);
  }, [abierto, remotas, messages]);
  const confirmadas = useMemo(() => new Set(respuestas.map((mensaje) => mensaje.clientKey)), [respuestas]);
  const pendientesDelHilo = useMemo(() => pending.filter((uno) => uno.hiloDe === abierto && !confirmadas.has(uno.clientKey)), [pending, abierto, confirmadas]);

  // Lo que se ve, queda visto (el punto de «nuevas» se apaga).
  const ultima = respuestas[respuestas.length - 1]?.seq;
  useEffect(() => {
    if (abierto !== null && ultima) void marcarHiloVisto(chatId, abierto, ultima);
  }, [abierto, ultima, chatId]);

  return {
    delChat,
    pendientesDelChat,
    hiloConNuevas,
    abierto,
    abrir: useCallback((seq: number) => {
      setTyping(false);
      setAbierto(seq);
    }, []),
    escribirEn: useCallback((seq: number) => {
      setTyping(true);
      setAbierto(seq);
    }, []),
    focusInput: typing,
    cerrar: useCallback(() => setAbierto(null), []),
    raiz: abierto === null ? null : (messages.find((mensaje) => mensaje.seq === abierto) ?? (raizRemota?.seq === abierto ? raizRemota : null)),
    respuestas,
    pendientesDelHilo,
  };
}
