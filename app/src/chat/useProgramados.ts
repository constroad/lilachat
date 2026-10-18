import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { cancelarProgramado, listarProgramados, programarMensaje, type Programado } from '../api/client';
import { programadosDelChat } from './programados';

/**
 * Mensajes programados desde la conversación (F11; salió de `ChatScreen`):
 * long-press en enviar abre el modal con el texto, y al elegir la hora se
 * programa en el server. Avisa unos segundos «Se enviará …». Los pendientes de
 * este chat se ven y se cancelan (FL9d): se piden al abrir y tras cada cambio.
 */
const DURACION_DEL_AVISO_MS = 4000;

export function useProgramados(params: { jwt: string; chatId: string; alProgramado: () => void }) {
  const [visible, setVisible] = useState(false);
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendientes, setPendientes] = useState<Programado[]>([]);
  const { jwt, chatId } = params;

  const recargar = useCallback(async () => {
    const respuesta = await listarProgramados(jwt);
    if (respuesta.ok) setPendientes(programadosDelChat(respuesta.data.programados, chatId));
  }, [jwt, chatId]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const cancelar = useCallback(
    async (id: string) => {
      const respuesta = await cancelarProgramado(jwt, id);
      if (!respuesta.ok) Alert.alert('No se pudo cancelar', respuesta.message ?? 'Prueba de nuevo.');
      await recargar();
    },
    [jwt, recargar]
  );

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
    const resultado = await programarMensaje(jwt, chatId, limpio, cuando.toISOString(), clientKey);
    setVisible(false);
    if (!resultado.ok) {
      Alert.alert('No se pudo programar', resultado.message ?? 'Prueba de nuevo.');
      return;
    }
    params.alProgramado();
    void recargar();
    setAviso(`Se enviará ${cuando.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`);
    setTimeout(() => setAviso(null), DURACION_DEL_AVISO_MS);
  };

  return { visible, texto, aviso, abrir, cerrar, programar, pendientes, cancelar };
}
