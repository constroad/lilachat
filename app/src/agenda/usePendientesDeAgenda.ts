import { useCallback, useState } from 'react';
import { agendaGet, type PendientesDeAgenda } from './agendaApi';

const NADA: PendientesDeAgenda = { encuestas: 0, eventos: 0 };

/**
 * Los contadores de Agenda y Encuestas en la barra (José, 18/10: «no hay un
 * contador en los tabs»): eventos que vienen y no respondí, y encuestas
 * abiertas sin mi voto. Sin polling: se refresca cuando algo puede haber
 * cambiado (llega una encuesta o un evento, se cambia de pestaña, se vota).
 * La primera lectura la hace quien lo usa (el efecto de la pestaña activa), así
 * no salen dos pedidos al arrancar.
 */
export function usePendientesDeAgenda(jwt: string) {
  const [pendientes, setPendientes] = useState<PendientesDeAgenda>(NADA);

  const refrescar = useCallback(async () => {
    const respuesta = await agendaGet<PendientesDeAgenda>('/pendientes', jwt);
    // Sin red se queda lo último que se supo: un 0 inventado escondería lo pendiente.
    if (!respuesta.ok) return;
    const { encuestas, eventos } = respuesta.data;
    setPendientes((antes) => (antes.encuestas === encuestas && antes.eventos === eventos ? antes : { encuestas, eventos }));
  }, [jwt]);

  return { pendientes, refrescar };
}
