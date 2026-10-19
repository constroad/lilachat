import { useCallback, type MutableRefObject } from 'react';
import type { Socket } from 'socket.io-client';
import { api, type ApiResult } from '../api';
import { cambiosDeAjustes, type AccionDelChat } from '../chat/menuDelChat';
import type { ChatSummary } from '../chat/types';
import type { BaseLocal } from '../local/baseLocal';
import { ajustarChatLocal, quitarChatLocal, type AjusteLocal } from '../local/chatsLocales';

/**
 * Lo que la persona hace con SUS chats desde la lista (W3a): archivar,
 * silenciar, fijar, leído/no leído, salir y eliminar para mí.
 *
 * Los ajustes van primero a la base local (la lista responde al toque) y
 * después al server; si el server no acepta, se vuelve atrás y se dice por
 * qué. Eliminar y salir esperan al server: deshacerlos no es posible.
 */
export function useAccionesSobreChats(params: {
  base: BaseLocal | null;
  jwt: string;
  socket: MutableRefObject<Socket | null>;
  cargarChats: () => Promise<void>;
  /** Las recargas en vuelo traen el estado de ANTES del cambio: que no lo pisen. */
  invalidarCargas: () => void;
  /** Un 401 (token vencido, o todavía renovando al abrir): el token nuevo, o `null` si la sesión se cerró. */
  renovarSesion: () => Promise<string | null>;
  onAviso: (texto: string) => void;
  /** El chat se fue de la lista: si estaba abierto, se cierra. */
  alQuitar: (chatId: string) => void;
}) {
  const { base, jwt, socket, cargarChats, invalidarCargas, renovarSesion, onAviso, alQuitar } = params;

  /** Un pedido con sesión: ante un 401 renueva y reintenta UNA vez con el token nuevo. */
  const pedir = useCallback(
    async (ruta: string, opciones: { method: string; body?: unknown }): Promise<ApiResult<unknown>> => {
      const respuesta = await api(ruta, { ...opciones, jwt });
      if (respuesta.ok || respuesta.status !== 401) return respuesta;
      const nuevo = await renovarSesion();
      return nuevo ? api(ruta, { ...opciones, jwt: nuevo }) : respuesta;
    },
    [jwt, renovarSesion]
  );

  const ajustar = useCallback(
    async (chat: ChatSummary, accion: AccionDelChat) => {
      const cambios = cambiosDeAjustes(accion);
      if (!base || !cambios) return;
      const local: AjusteLocal = accion === 'leido' ? { ...cambios, unread: 0 } : cambios;
      invalidarCargas();
      const antes = await ajustarChatLocal(base, chat.id, local);
      const respuesta = await pedir(`/chats/${chat.id}/ajustes`, { method: 'PATCH', body: cambios });
      if (!respuesta.ok) {
        if (antes) await ajustarChatLocal(base, chat.id, antes);
        return onAviso(respuesta.message);
      }
      if (accion === 'leido' && chat.lastSeq > 0) socket.current?.emit('read.set', { chatId: chat.id, seq: chat.lastSeq });
      void cargarChats();
    },
    [base, pedir, socket, cargarChats, invalidarCargas, onAviso]
  );

  const eliminar = useCallback(
    async (chat: ChatSummary) => {
      const respuesta = await pedir(`/chats/${chat.id}/borrar-para-mi`, { method: 'POST' });
      if (!respuesta.ok) return onAviso(respuesta.message);
      invalidarCargas();
      if (base) await quitarChatLocal(base, chat.id);
      alQuitar(chat.id);
      onAviso('Chat eliminado');
    },
    [base, pedir, invalidarCargas, onAviso, alQuitar]
  );

  const salir = useCallback(
    async (chat: ChatSummary) => {
      const respuesta = await pedir(`/chats/${chat.id}/leave`, { method: 'POST' });
      if (!respuesta.ok) return onAviso(respuesta.message);
      onAviso('Saliste del grupo');
      void cargarChats();
    },
    [pedir, onAviso, cargarChats]
  );

  const aplicar = useCallback(
    async (chat: ChatSummary, accion: AccionDelChat) => {
      if (accion === 'eliminar') return eliminar(chat);
      if (accion === 'salir') return salir(chat);
      return ajustar(chat, accion);
    },
    [ajustar, eliminar, salir]
  );

  return { aplicar };
}
