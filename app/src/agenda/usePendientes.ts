import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lineaDePendientes, type Rsvp } from '@lilachat/shared';
import { agendaGet, agendaPost, type AgendaEvent, type AgendaReminder } from './agendaApi';

type Linea = { recordatorios: AgendaReminder[]; vencidos: AgendaReminder[]; apagados: AgendaReminder[] };

/**
 * Lo que alimenta «Pendientes» (José, 20/10): los eventos que vienen y la
 * línea de recordatorios (`GET /linea`), pedidos en paralelo. Sin polling: se
 * vuelve a pedir al volver a la pestaña, al tirar hacia abajo y tras guardar.
 */
export function usePendientes(jwt: string, recarga: number, onCambio?: () => void) {
  const [eventos, setEventos] = useState<AgendaEvent[] | null>(null);
  const [linea, setLinea] = useState<Linea | null>(null);
  const [fallo, setFallo] = useState(false);
  // En una ref: si quien lo pasa lo crea en cada render, como dependencia volvía a pedir sin fin.
  const avisarCambio = useRef(onCambio);
  avisarCambio.current = onCambio;

  const cargar = useCallback(async () => {
    const [conEventos, conLinea] = await Promise.all([agendaGet<{ events: AgendaEvent[] }>('/events', jwt), agendaGet<Partial<Linea>>('/linea', jwt)]);
    if (conEventos.ok) setEventos(conEventos.data.events);
    if (conLinea.ok) setLinea({ recordatorios: conLinea.data.recordatorios ?? [], vencidos: conLinea.data.vencidos ?? [], apagados: conLinea.data.apagados ?? [] });
    setFallo(!conEventos.ok || !conLinea.ok);
    avisarCambio.current?.();
  }, [jwt]);

  useEffect(() => {
    void cargar();
  }, [cargar, recarga]);

  const secciones = useMemo(
    () => (eventos && linea ? lineaDePendientes({ eventos, recordatorios: linea.recordatorios, vencidos: linea.vencidos, ahora: new Date() }) : null),
    [eventos, linea]
  );

  /** Optimista: responder tiene que sentirse instantáneo; el refresco deja el resumen real. */
  const responder = async (eventId: string, rsvp: Rsvp) => {
    setEventos((antes) => antes?.map((evento) => (evento.id === eventId ? { ...evento, myRsvp: rsvp } : evento)) ?? antes);
    await agendaPost(`/events/${eventId}/rsvp`, jwt, { rsvp });
    void cargar();
  };

  /** Prender o apagar uno propio (lo que hacía el interruptor de «Recordatorios»). */
  const prender = async (recordatorio: AgendaReminder, active: boolean) => {
    const resultado = await agendaPost(`/reminders/${recordatorio._id}/toggle`, jwt, { active });
    if (!resultado.ok) setFallo(true);
    void cargar();
  };

  return { secciones, apagados: linea?.apagados ?? [], eventos: eventos ?? [], fallo, cargar, responder, prender };
}
