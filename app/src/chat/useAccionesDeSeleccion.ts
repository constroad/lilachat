import { useCallback } from 'react';
import { Alert } from 'react-native';
import { borrarChatParaMi, cambiarAjustesDeChat, leaveChat, type AjustesDeChat, type ChatSummary } from '../api/client';
import { getSocket } from './socketClient';
import { olvidarMensajesDelChat } from './mensajesGuardados';
import { guardarBorrador } from './borradores';

/** El acuse por socket no tiene respuesta: se recarga tras este respiro. */
const ESPERA_TRAS_ACUSE_MS = 400;

/**
 * Lo que hace cada botón de la selección de chats (salió de
 * `ChatListScreen`). Cada acción suelta la selección, va al server y recarga:
 * optimista sería mejor, pero un lote de 2-3 chats vuelve en un parpadeo y no
 * pinta un estado que el server podría no haber aceptado.
 */
export function useAccionesDeSeleccion(params: {
  jwt: string;
  seleccionados: ChatSummary[];
  limpiarSeleccion: () => void;
  recargar: () => Promise<void>;
}) {
  const { jwt, seleccionados, limpiarSeleccion, recargar } = params;

  const aplicarAjuste = useCallback(
    async (cambios: AjustesDeChat) => {
      limpiarSeleccion();
      await Promise.all(seleccionados.map((chat) => cambiarAjustesDeChat(chat.id, jwt, cambios)));
      await recargar();
    },
    [seleccionados, jwt, limpiarSeleccion, recargar]
  );

  /**
   * Leído: el acuse por socket para lo que tiene mensajes sin leer (el server
   * quita además la marca), y la marca sola por HTTP donde no había mensajes.
   * No leído: la marca, como WhatsApp (FL9).
   */
  const cambiarLectura = useCallback(
    async (lectura: 'leido' | 'no-leido') => {
      limpiarSeleccion();
      if (lectura === 'no-leido') {
        await Promise.all(seleccionados.map((chat) => cambiarAjustesDeChat(chat.id, jwt, { markedUnread: true })));
        return recargar();
      }
      const socket = getSocket();
      for (const chat of seleccionados) {
        if (chat.unread > 0) socket?.emit('read.set', { chatId: chat.id, seq: chat.lastSeq });
      }
      const soloMarcados = seleccionados.filter((chat) => chat.unread === 0 && chat.markedUnread);
      await Promise.all(soloMarcados.map((chat) => cambiarAjustesDeChat(chat.id, jwt, { markedUnread: false })));
      setTimeout(() => void recargar(), ESPERA_TRAS_ACUSE_MS);
    },
    [seleccionados, jwt, limpiarSeleccion, recargar]
  );

  const salirDeGrupos = useCallback(async () => {
    limpiarSeleccion();
    await Promise.all(seleccionados.map((chat) => leaveChat(chat.id, jwt)));
    await recargar();
  }, [seleccionados, jwt, limpiarSeleccion, recargar]);

  /**
   * «Eliminar chat» (FL9d), con confirmación: sale de la lista y sus mensajes
   * y su borrador se van de este teléfono. Al otro no le cambia nada.
   */
  const eliminarChats = useCallback(() => {
    const cantidad = seleccionados.length;
    Alert.alert(
      cantidad === 1 ? '¿Eliminar este chat?' : `¿Eliminar ${cantidad} chats?`,
      'Se borran los mensajes de este teléfono. La otra persona los sigue teniendo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const elegidos = seleccionados;
            limpiarSeleccion();
            void (async () => {
              const resultados = await Promise.all(elegidos.map((chat) => borrarChatParaMi(chat.id, jwt)));
              await Promise.all(
                elegidos.filter((_, indice) => resultados[indice]).map(async (chat) => {
                  guardarBorrador(chat.id, '');
                  await olvidarMensajesDelChat(chat.id);
                })
              );
              if (resultados.includes(false)) Alert.alert('No se pudo eliminar', 'Revisa la señal y prueba de nuevo.');
              await recargar();
            })();
          },
        },
      ]
    );
  }, [seleccionados, jwt, limpiarSeleccion, recargar]);

  return { aplicarAjuste, cambiarLectura, salirDeGrupos, eliminarChats };
}
