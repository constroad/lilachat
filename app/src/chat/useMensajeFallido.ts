import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { descartarMensaje, reintentarMensaje } from './outboxStore';
import { descartarArchivo, reintentarArchivo } from './colaDeArchivos';

/**
 * Un mensaje que el server rechazó para siempre (FL8): antes desaparecía sin
 * aviso; ahora se ve «No se envió» y se decide borrar o reintentar. Texto y
 * archivos viven en colas distintas: cada uno se reintenta en la suya. Salió
 * de `ChatScreen`.
 */
export function useMensajeFallido(archivosEnCola: readonly { archivo: { clientKey: string } }[]) {
  const archivosRef = useRef(archivosEnCola);
  archivosRef.current = archivosEnCola;
  return useCallback((clientKey: string, motivo: string) => {
    const esArchivo = archivosRef.current.some(({ archivo }) => archivo.clientKey === clientKey);
    Alert.alert('No se envió', motivo, [
      { text: 'Borrar', style: 'destructive', onPress: () => void (esArchivo ? descartarArchivo : descartarMensaje)(clientKey) },
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Reintentar', onPress: () => void (esArchivo ? reintentarArchivo : reintentarMensaje)(clientKey) },
    ]);
  }, []);
}
