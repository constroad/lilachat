import { useEffect } from 'react';
import { AppState } from 'react-native';
import { clearChatNotices } from './avisoLocal';

/**
 * Con el chat abierto, su aviso nativo sobra (FL8.2): se va al abrirlo y al
 * volver a la app con él abierto, como WhatsApp. Si quedara, la notificación
 * seguiría mostrando mensajes que ya se leyeron.
 */
export function useLimpiarAvisoDelChat(chatId: string): void {
  useEffect(() => {
    // The native notice (push), the local one (socket) and the common ones of the chat (FL11).
    const clear = () => void clearChatNotices(chatId);
    clear();
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') clear();
    });
    return () => suscripcion.remove();
  }, [chatId]);
}
