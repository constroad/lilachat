import { useCallback, type MutableRefObject } from 'react';
import type { Socket } from 'socket.io-client';
import { api, type ApiResult } from '../api';
import { cambiosDeAjustes, type ChatAction } from '../chat/menuDelChat';
import { askMuteDuration } from '../chat/MuteDialog';
import { levelChanges } from '../chat/menuDelChat';
import type { NotificationLevel } from '@lilachat/shared';
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

  /** Local first, then the server; if it refuses, the row goes back and the reason is told. */
  const applySettings = useCallback(
    async (chat: ChatSummary, onScreen: AjusteLocal, sent: object): Promise<boolean> => {
      if (!base) return false;
      invalidarCargas();
      const previous = await ajustarChatLocal(base, chat.id, onScreen);
      const response = await pedir(`/chats/${chat.id}/ajustes`, { method: 'PATCH', body: sent });
      if (!response.ok) {
        if (previous) await ajustarChatLocal(base, chat.id, previous);
        onAviso(response.message);
        return false;
      }
      return true;
    },
    [base, pedir, invalidarCargas, onAviso]
  );

  const ajustar = useCallback(
    async (chat: ChatSummary, accion: ChatAction) => {
      const asked = cambiosDeAjustes(accion);
      if (!asked) return;
      // R31/10: muting asks how long; cancelling mutes nothing.
      const muteFor = accion === 'silenciar' ? await askMuteDuration() : undefined;
      if (muteFor === null) return;
      const cambios = muteFor ? { ...asked, muteFor } : asked;
      const local: AjusteLocal = accion === 'leido' ? { ...asked, unread: 0 } : asked;
      if (!(await applySettings(chat, local, cambios))) return;
      if (accion === 'leido' && chat.lastSeq > 0) socket.current?.emit('read.set', { chatId: chat.id, seq: chat.lastSeq });
      void cargarChats();
    },
    [applySettings, socket, cargarChats]
  );

  /** E3b: everything / only mentions / nothing for a group, from «Info.». */
  const setLevel = useCallback(
    async (chat: ChatSummary, level: NotificationLevel) => {
      const changes = levelChanges(level);
      if (await applySettings(chat, changes, changes)) void cargarChats();
    },
    [applySettings, cargarChats]
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

  /** The chat is gone for everyone (a deleted channel): out of the list, closed if open. */
  const removeFromList = useCallback(
    async (chat: ChatSummary) => {
      invalidarCargas();
      if (base) await quitarChatLocal(base, chat.id);
      alQuitar(chat.id);
      void cargarChats();
    },
    [base, invalidarCargas, alQuitar, cargarChats]
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
    async (chat: ChatSummary, accion: ChatAction) => {
      if (accion === 'eliminar') return eliminar(chat);
      if (accion === 'salir') return salir(chat);
      return ajustar(chat, accion);
    },
    [ajustar, eliminar, salir]
  );

  return { aplicar, setLevel, removeFromList };
}
