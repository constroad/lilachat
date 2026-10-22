import { useState } from 'react';
import { CalendarDays, MapPin, Phone, Video } from 'lucide-react';
import { cuandoDelEvento, resumenDeRsvp, type AgendaEvent, type Rsvp } from '@lilachat/shared';
import { api } from '../../api';
import { useConversacion } from '../contextoDeLaConversacion';
import { useTarjeta } from './useTarjeta';
import { TarjetaCargando, TarjetaConFallo, TarjetaQueNoEsta } from './EstadosDeTarjeta';
import { ScheduledCallJoin } from '../scheduledCall/ScheduledCallJoin';

const RESPUESTAS: { valor: Rsvp; etiqueta: string }[] = [
  { valor: 'yes', etiqueta: 'Voy' },
  { valor: 'maybe', etiqueta: 'Tal vez' },
  { valor: 'no', etiqueta: 'No voy' },
];
const DIA = new Intl.DateTimeFormat('es-PE', { weekday: 'short' });

/**
 * El evento DENTRO del chat (W3c, 20/10; diseño `w3c-web-tarjetas`): qué,
 * cuándo y dónde, y confirmar ahí mismo. A quien lo creó no se le pregunta.
 */
export function EventoEnElChat({ id }: { id: string }) {
  const { jwt } = useConversacion();
  const { valor: evento, fallo, cargar, reemplazar } = useTarjeta<AgendaEvent>({ tipo: 'evento', id, ruta: `/agenda/events/${id}`, campo: 'event', jwt });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  if (evento === null) return <TarjetaQueNoEsta texto="Este evento ya no está disponible." />;
  if (evento === undefined) return fallo ? <TarjetaConFallo texto="No se pudo cargar el evento." onReintentar={() => void cargar()} /> : <TarjetaCargando />;

  const inicio = new Date(evento.startsAt);
  const responder = async (rsvp: Rsvp) => {
    if (enviando) return;
    setEnviando(true);
    setError('');
    // Optimista: el botón se marca ya; si el server dice que no, vuelve.
    reemplazar({ ...evento, myRsvp: rsvp });
    const respuesta = await api(`/agenda/events/${id}/rsvp`, { jwt, body: { rsvp } });
    setEnviando(false);
    if (!respuesta.ok) {
      reemplazar(evento);
      return setError(respuesta.message);
    }
    void cargar();
  };

  return (
    <div data-testid={`evento-en-chat-${id}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary">
        {evento.call ? (evento.call.video ? <Video size={14} /> : <Phone size={14} />) : <CalendarDays size={14} />} {evento.call ? 'Llamada programada' : 'Evento'}
      </p>
      <div className="mt-2 flex items-start gap-3">
        <div className="grid w-12 shrink-0 place-items-center rounded-lg border border-outline/15 bg-surface py-1 leading-none">
          <span className="text-[10px] font-bold uppercase text-primary">{DIA.format(inicio).replace('.', '')}</span>
          <span className="mt-0.5 text-lg font-bold tabular-nums">{inicio.getDate()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{evento.title}</p>
          <p className="text-[12px] text-on-surface-variant">{cuandoDelEvento(evento.startsAt, evento.endsAt)}</p>
          {evento.location ? (
            <p className="mt-0.5 flex items-center gap-1 text-[12px] text-on-surface-variant">
              <MapPin size={12} className="shrink-0" /> <span className="truncate">{evento.location}</span>
            </p>
          ) : null}
        </div>
      </div>
      {evento.call ? <ScheduledCallJoin event={evento} video={evento.call.video} /> : null}
      {evento.mio ? null : (
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-outline/15 bg-surface p-1">
          {RESPUESTAS.map((opcion) => (
            <button key={opcion.valor} type="button" data-testid={`rsvp-${id}-${opcion.valor}`} aria-pressed={evento.myRsvp === opcion.valor} onClick={() => void responder(opcion.valor)} className={`min-h-[36px] rounded-md text-[13px] font-medium ${evento.myRsvp === opcion.valor ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-background'}`}>
              {opcion.etiqueta}
            </button>
          ))}
        </div>
      )}
      <p className="mt-3 border-t border-outline/10 pt-2 text-[12px] text-on-surface-variant">{resumenDeRsvp(evento.rsvpSummary)}</p>
      {error ? <p role="alert" className="mt-1 text-[12px] text-error">{error}</p> : null}
    </div>
  );
}
