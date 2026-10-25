import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import type { ChatSummary } from '../api/client';
import { buscarChat, lookupNoticeChat } from './buscarChat';
import { noticeDestination, type EntryPoint, type NoticeDestination } from './destinoDeAviso';
import { NoticeOpener } from './noticeOpener';
import { llamadaNativa } from '../../modules/llamada-entrante/src';
import { subscribeOpenChatRequests } from './openChatRequest';
import { setCurrentSpaceId } from '../spaces/currentSpace';

/**
 * Tocar una notificación abre lo que avisa (FL8; auditoría 17/10/2026: el
 * `chatId` viajaba en cada notificación y nadie escuchaba el toque).
 *
 * Dos entradas: con la app viva, el listener; con la app cerrada, la respuesta
 * que la abrió (`getLastNotificationResponseAsync`), que se BORRA después de
 * atenderla — si no, cada arranque volvería a abrir ese chat.
 *
 * A message notice carries its full destination (agentes 25/10/2026): the
 * space, the message and the thread. `openDestination` is the only path: it
 * finds the chat, switches to its space BEFORE navigating and opens the message
 * or the thread. The chat summary comes from what the app already has (memory,
 * then disk) and the server is asked only when it is missing.
 */
export function useAbrirDesdeAviso(params: {
  jwt: string;
  abrirChat: (chat: ChatSummary, entry?: EntryPoint) => void;
  abrirAgenda: () => void;
}): void {
  const abrirChatRef = useRef(params.abrirChat);
  abrirChatRef.current = params.abrirChat;
  const abrirAgendaRef = useRef(params.abrirAgenda);
  abrirAgendaRef.current = params.abrirAgenda;
  const jwtRef = useRef(params.jwt);
  jwtRef.current = params.jwt;
  const openerRef = useRef<NoticeOpener | null>(null);

  // Once, not per jwt: a cold start refreshes the jwt behind the first screen, and a tap taken before
  // that must outlive the change (`NoticeOpener` retries it with the new one).
  useEffect(() => {
    let vivo = true;
    const atendidas = new Set<string>();
    const opener = new NoticeOpener(
      {
        find: (destination, jwt) => (destination.tipo === 'chat' ? lookupNoticeChat(destination, jwt) : Promise.resolve({ kind: 'missing' })),
        open: (plan) => {
          // Before navigating: otherwise the list of the wrong space paints for a moment and «back» lands on it.
          setCurrentSpaceId(plan.space);
          // All three keys, always: a `setParams` that left them out would keep the previous tap's thread.
          abrirChatRef.current(plan.chat, { irASeq: plan.irASeq, openThread: plan.openThread, highlightReply: plan.highlightReply });
        },
        openAgenda: () => abrirAgendaRef.current(),
        now: Date.now,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      },
      jwtRef.current
    );
    openerRef.current = opener;
    const openDestination = async (destination: NoticeDestination | null) => {
      if (destination) await opener.handle(destination);
    };

    const atender = async (respuesta: Notifications.NotificationResponse | null) => {
      if (!respuesta || !vivo) return;
      const id = respuesta.notification.request.identifier;
      if (atendidas.has(id)) return;
      atendidas.add(id);
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      await openDestination(noticeDestination(respuesta.notification.request.content.data));
    };

    void Notifications.getLastNotificationResponseAsync()
      .then(atender)
      .catch(() => undefined);
    const suscripcion = Notifications.addNotificationResponseReceivedListener((respuesta) => void atender(respuesta));

    // FL8.2: los avisos de mensaje que dibuja el servicio nativo. Expo no los
    // conoce: el toque llega por el puente (en frío, como pendiente).
    // The extras of a tap (space, thread, message) are outside text: `noticeDestination` validates them.
    const coldStart = llamadaNativa.avisoPendiente();
    if (coldStart) void openDestination(noticeDestination(coldStart));
    // «Enviar mensaje» on a shared contact (pending 9): a chat already in hand, opened as it is (no space switch).
    const openKnown = async (chatId: string, known?: ChatSummary) => {
      const chat = known ?? (await buscarChat(chatId, jwtRef.current));
      if (chat && vivo) abrirChatRef.current(chat);
    };
    const stopRequests = subscribeOpenChatRequests((chatId, known) => void openKnown(chatId, known));
    const taps = llamadaNativa.alTocar((aviso) => {
      if (aviso.accion === 'chat') void openDestination(noticeDestination({ chatId: aviso.chatId, seq: aviso.seq, hiloDe: aviso.hiloDe, workspaceId: aviso.workspaceId }));
    });
    return () => {
      vivo = false;
      opener.dispose();
      openerRef.current = null;
      suscripcion.remove();
      taps.remove();
      stopRequests();
    };
  }, []);

  useEffect(() => {
    openerRef.current?.setJwt(params.jwt);
  }, [params.jwt]);
}
