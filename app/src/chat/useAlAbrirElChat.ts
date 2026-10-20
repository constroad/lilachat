import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { terminarCronometro } from '../diagnostico/diagnostico';
import { hastaDondeLeer } from './hastaDondeLeer';

/**
 * Lo que pasa al abrir la conversación (salió de `ChatScreen`): el primer
 * scroll —al divisor de no leídos o al final (FL9)— y el acuse de lectura.
 */
export function useAlAbrirElChat(params: {
  hayContenido: boolean;
  mensajes: readonly { seq: number }[];
  /** El `lastSeq` que dijo el server al abrir (ver `ChatScreen`). */
  lastSeqInicial?: number;
  markRead: (seq: number) => void;
}) {
  const { hayContenido, mensajes, lastSeqInicial, markRead } = params;

  useEffect(() => {
    if (!hayContenido) return;
    // Línea base de FL0 (spec §45): del toque en la lista a ver mensajes.
    terminarCronometro('abrir-chat');
    // The first scroll is done by the list itself when it finishes its first layout
    // (`onLoad` → `irAlInicio`); a second one here, 150 ms later, moved it again (20/10).
  }, [hayContenido]);

  // Con «Conexión permanente» el socket sigue vivo en segundo plano: sin esto,
  // lo que llegaba con la pantalla apagada salía leído (azul) para el otro.
  const [enPrimerPlano, setEnPrimerPlano] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (estado) => setEnPrimerPlano(estado === 'active'));
    return () => suscripcion.remove();
  }, []);

  useEffect(() => {
    const hasta = hastaDondeLeer({ mensajes, lastSeqInicial, enPrimerPlano });
    if (hasta !== null) markRead(hasta);
  }, [mensajes, markRead, lastSeqInicial, enPrimerPlano]);
}
