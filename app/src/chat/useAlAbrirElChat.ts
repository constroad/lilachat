import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { terminarCronometro } from '../diagnostico/diagnostico';
import { hastaDondeLeer } from './hastaDondeLeer';

/** Tras el primer pintado: con 0 la lista todavía no midió (visto en el emulador). */
const ESPERA_PRIMER_SCROLL_MS = 150;

/**
 * Lo que pasa al abrir la conversación (salió de `ChatScreen`): el primer
 * scroll —al divisor de no leídos o al final (FL9)— y el acuse de lectura.
 */
export function useAlAbrirElChat(params: {
  hayContenido: boolean;
  irAlInicio: () => void;
  mensajes: readonly { seq: number }[];
  /** El `lastSeq` que dijo el server al abrir (ver `ChatScreen`). */
  lastSeqInicial?: number;
  markRead: (seq: number) => void;
}) {
  const { hayContenido, irAlInicio, mensajes, lastSeqInicial, markRead } = params;

  useEffect(() => {
    if (!hayContenido) return;
    // Línea base de FL0 (spec §45): del toque en la lista a ver mensajes.
    terminarCronometro('abrir-chat');
    const espera = setTimeout(irAlInicio, ESPERA_PRIMER_SCROLL_MS);
    return () => clearTimeout(espera);
    // Solo al pasar de vacío a con contenido: reaccionar a cada mensaje pelearía
    // con quien está leyendo mensajes viejos más arriba.
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
