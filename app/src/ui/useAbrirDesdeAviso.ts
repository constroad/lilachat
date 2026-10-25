import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import type { ChatSummary } from '../api/client';
import { buscarChat } from './buscarChat';
import { destinoDeAviso } from './destinoDeAviso';
import { llamadaNativa } from '../../modules/llamada-entrante/src';
import { subscribeOpenChatRequests } from './openChatRequest';

/**
 * Tocar una notificación abre lo que avisa (FL8; auditoría 17/10/2026: el
 * `chatId` viajaba en cada notificación y nadie escuchaba el toque).
 *
 * Dos entradas: con la app viva, el listener; con la app cerrada, la respuesta
 * que la abrió (`getLastNotificationResponseAsync`), que se BORRA después de
 * atenderla — si no, cada arranque volvería a abrir ese chat.
 *
 * El resumen del chat sale de lo que la app ya tiene (memoria, después disco)
 * y solo si no está se le pregunta al server.
 */
export function useAbrirDesdeAviso(params: {
  jwt: string;
  abrirChat: (chat: ChatSummary) => void;
  abrirAgenda: () => void;
}): void {
  const abrirChatRef = useRef(params.abrirChat);
  abrirChatRef.current = params.abrirChat;
  const abrirAgendaRef = useRef(params.abrirAgenda);
  abrirAgendaRef.current = params.abrirAgenda;

  useEffect(() => {
    let vivo = true;
    const atendidas = new Set<string>();

    const atender = async (respuesta: Notifications.NotificationResponse | null) => {
      if (!respuesta || !vivo) return;
      const id = respuesta.notification.request.identifier;
      if (atendidas.has(id)) return;
      atendidas.add(id);
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);

      const destino = destinoDeAviso(respuesta.notification.request.content.data);
      if (!destino) return;
      if (destino.tipo === 'agenda') return abrirAgendaRef.current();
      const chat = await buscarChat(destino.chatId, params.jwt);
      if (chat && vivo) abrirChatRef.current(chat);
    };

    void Notifications.getLastNotificationResponseAsync()
      .then(atender)
      .catch(() => undefined);
    const suscripcion = Notifications.addNotificationResponseReceivedListener((respuesta) => void atender(respuesta));

    // FL8.2: los avisos de mensaje que dibuja el servicio nativo. Expo no los
    // conoce: el toque llega por el puente (en frío, como pendiente).
    const openById = async (chatId: string, known?: ChatSummary) => {
      const chat = known ?? (await buscarChat(chatId, params.jwt));
      if (chat && vivo) abrirChatRef.current(chat);
    };
    const enFrio = llamadaNativa.chatPendiente();
    if (enFrio) void openById(enFrio);
    // «Enviar mensaje» on a shared contact (pending 9): the same way as a notification.
    const stopRequests = subscribeOpenChatRequests((chatId, known) => void openById(chatId, known));
    const toques = llamadaNativa.alTocar((aviso) => {
      if (aviso.accion === 'chat') void openById(aviso.chatId);
    });
    return () => {
      vivo = false;
      suscripcion.remove();
      toques.remove();
      stopRequests();
    };
  }, [params.jwt]);
}
