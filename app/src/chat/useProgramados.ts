import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { programarMensaje } from '../api/client';

/**
 * Mensajes programados desde la conversación (F11; salió de `ChatScreen`):
 * long-press en enviar abre el modal con el texto, y al elegir la hora se
 * programa en el server. Avisa unos segundos «Se enviará …».
 */
const DURACION_DEL_AVISO_MS = 4000;

export function useProgramados(params: { jwt: string; chatId: string; alProgramado: () => void }) {
  const [visible, setVisible] = useState(false);
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);

  const abrir = useCallback((textoDelCampo: string) => {
    setTexto(textoDelCampo);
    setVisible(true);
  }, []);
  const cerrar = useCallback(() => setVisible(false), []);

  const programar = async (cuando: Date) => {
    const limpio = texto.trim();
    if (!limpio) return setVisible(false);
    // La clave hace idempotente el envío si el tick del server reintenta.
    const clientKey = `prog-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const resultado = await programarMensaje(params.jwt, params.chatId, limpio, cuando.toISOString(), clientKey);
    setVisible(false);
    if (!resultado.ok) {
      Alert.alert('No se pudo programar', resultado.message ?? 'Prueba de nuevo.');
      return;
    }
    params.alProgramado();
    setAviso(`Se enviará ${cuando.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`);
    setTimeout(() => setAviso(null), DURACION_DEL_AVISO_MS);
  };

  return { visible, texto, aviso, abrir, cerrar, programar };
}
