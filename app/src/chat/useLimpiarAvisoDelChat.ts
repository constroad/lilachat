import { useEffect } from 'react';
import { AppState } from 'react-native';
import { llamadaNativa } from '../../modules/llamada-entrante/src';

/**
 * Con el chat abierto, su aviso nativo sobra (FL8.2): se va al abrirlo y al
 * volver a la app con él abierto, como WhatsApp. Si quedara, la notificación
 * seguiría mostrando mensajes que ya se leyeron.
 */
export function useLimpiarAvisoDelChat(chatId: string): void {
  useEffect(() => {
    llamadaNativa.limpiarChat(chatId);
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') llamadaNativa.limpiarChat(chatId);
    });
    return () => suscripcion.remove();
  }, [chatId]);
}
