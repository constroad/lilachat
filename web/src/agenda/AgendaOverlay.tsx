import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, ListPlus, MapPin } from 'lucide-react';
import {
  formatEventWhen,
  tallyPoll,
  type AttendeeSummary,
  type Rsvp,
} from '@lilachat/shared';
import { api } from '../api';
import { Overlay } from '../ui/Overlay';

/**
 * La agenda de la web: lo que se viene y lo que se está votando, en un solo
 * lugar.
 *
 * Eventos y encuestas comparten pantalla a propósito. Estaban separados en la
 * app y era un menú de más para dos listas cortas que se miran juntas: «¿qué hay
 * el domingo?» y «¿qué decidimos?» son la misma pregunta.
 */
export type AgendaEvent = {
  id: string;
  chatId: string;
  title: string;
  startsAt: string;
  location?: string;
  rsvpSummary: AttendeeSummary;
  myRsvp: Rsvp | null;
};

export type AgendaPoll = {
  id: string;
  chatId: string;
  question: string;
  options: { text: string; votes: string[] }[];
  allowMultiple: boolean;
  anonymous: boolean;
  closedAt?: string | null;
};

const RESPUESTAS: { value: Rsvp; label: string }[] = [
  { value: 'yes', label: 'Voy' },
  { value: 'maybe', label: 'Tal vez' },
  { value: 'no', label: 'No voy' },
];

export function AgendaOverlay({
  jwt,
  myUserId,
  onClose,
  onCreateEvent,
  onCreatePoll,
}: {
  jwt: string;
  myUserId: string;
  onClose: () => void;
  onCreateEvent: () => void;
  onCreatePoll: () => void;
}) {
  const [events, setEvents] = useState<AgendaEvent[] | null>(null);
  const [polls, setPolls] = useState<AgendaPoll[] | null>(null);

  const cargar = useCallback(async () => {
    const [conEventos, conEncuestas] = await Promise.all([
      api<{ events: AgendaEvent[] }>('/agenda/events', { jwt }),
      api<{ polls: AgendaPoll[] }>('/agenda/polls', { jwt }),
    ]);
    setEvents(conEventos.ok ? conEventos.data.events : []);
    setPolls(conEncuestas.ok ? conEncuestas.data.polls : []);
  }, [jwt]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const responder = async (event: AgendaEvent, rsvp: Rsvp) => {
    // Optimista: la respuesta se pinta ya. Es un toque sobre un dato propio, y
    // esperar el ida y vuelta para ver el botón marcado se siente roto.
    setEvents((actual) =>
      (actual ?? []).map((uno) => (uno.id === event.id ? { ...uno, myRsvp: rsvp } : uno))
    );
    const resultado = await api(`/agenda/events/${event.id}/rsvp`, { jwt, body: { rsvp } });
    if (!resultado.ok) void cargar();
  };

  const votar = async (poll: AgendaPoll, indice: number) => {
    const resultado = await api(`/agenda/polls/${poll.id}/vote`, {
      jwt,
      body: { optionIndex: indice },
    });
    // El voto lo resuelve el server (una sola opción o varias, quitar el propio):
    // se recarga en vez de adivinar acá cuál de las reglas se aplicó.
    if (resultado.ok) void cargar();
  };

  const cargando = events === null || polls === null;
  const vacia = !cargando && events.length === 0 && polls.length === 0;

  return (
    <Overlay title="Agenda" onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          data-testid="btn-nuevo-evento"
          onClick={onCreateEvent}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary/10 px-3 text-[13px] font-semibold text-primary"
        >
          <CalendarPlus size={16} /> Evento
        </button>
        <button
          type="button"
          data-testid="btn-nueva-encuesta"
          onClick={onCreatePoll}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-secondary/10 px-3 text-[13px] font-semibold text-secondary"
        >
          <ListPlus size={16} /> Encuesta
        </button>
      </div>

      {cargando ? (
        <div data-testid="agenda-cargando">
          {[0, 1].map((indice) => (
            <div key={indice} className="mb-2 rounded-xl border border-outline/15 p-4">
              <div className="h-3 w-1/2 animate-pulse rounded bg-background" />
              <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-background" />
            </div>
          ))}
        </div>
      ) : vacia ? (
        <p className="py-6 text-center text-sm leading-5 text-on-surface-variant">
          Nada agendado todavía. Crea un evento para el próximo encuentro o una encuesta para
          decidir entre todos.
        </p>
      ) : (
        <>
          {events.length > 0 ? (
            <section>
              <h3 className="pb-2 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
                Lo que se viene
              </h3>
              {events.map((event) => (
                <article
                  key={event.id}
                  data-testid={`evento-${event.id}`}
                  className="mb-2 rounded-xl border border-outline/15 bg-surface p-4"
                >
                  <h4 className="text-sm font-semibold">{event.title}</h4>
                  <p className="mt-0.5 text-[12px] text-primary">
                    {formatEventWhen(new Date(event.startsAt))}
                  </p>
                  {event.location ? (
                    <p className="mt-1 flex items-center gap-1 text-[12px] text-on-surface-variant">
                      <MapPin size={12} /> {event.location}
                    </p>
                  ) : null}

                  <div className="mt-3 flex gap-1.5">
                    {RESPUESTAS.map((opcion) => {
                      const elegida = event.myRsvp === opcion.value;
                      return (
                        <button
                          key={opcion.value}
                          type="button"
                          data-testid={`rsvp-${event.id}-${opcion.value}`}
                          aria-pressed={elegida}
                          onClick={() => void responder(event, opcion.value)}
                          className={`min-h-[36px] flex-1 rounded-lg text-[12px] font-medium transition-colors ${
                            elegida
                              ? 'bg-primary text-on-primary'
                              : 'bg-background text-on-surface-variant hover:bg-primary/10'
                          }`}
                        >
                          {opcion.label}
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-2 text-[11px] text-on-surface-variant">
                    {event.rsvpSummary.yes} van · {event.rsvpSummary.maybe} tal vez ·{' '}
                    {event.rsvpSummary.pending} sin responder
                  </p>
                </article>
              ))}
            </section>
          ) : null}

          {polls.length > 0 ? (
            <section className="mt-4">
              <h3 className="pb-2 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
                Para decidir
              </h3>
              {polls.map((poll) => {
                // `closedAt` viaja como texto en JSON y el motor lo tipa como fecha.
                const conteo = tallyPoll(
                  { ...poll, closedAt: poll.closedAt ? new Date(poll.closedAt) : null },
                  myUserId
                );
                return (
                  <article
                    key={poll.id}
                    data-testid={`encuesta-${poll.id}`}
                    className="mb-2 rounded-xl border border-outline/15 bg-surface p-4"
                  >
                    <h4 className="text-sm font-semibold">{poll.question}</h4>
                    <div className="mt-2">
                      {conteo.map((opcion, indice) => (
                        <button
                          key={indice}
                          type="button"
                          data-testid={`votar-${poll.id}-${indice}`}
                          aria-pressed={opcion.votedByMe}
                          onClick={() => void votar(poll, indice)}
                          className="relative mb-1.5 block w-full overflow-hidden rounded-lg bg-background px-3 py-2 text-left"
                        >
                          <span
                            aria-hidden
                            className={`absolute inset-y-0 left-0 ${
                              opcion.votedByMe ? 'bg-primary/25' : 'bg-primary/10'
                            }`}
                            style={{ width: `${opcion.percent}%` }}
                          />
                          <span className="relative flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-[13px]">
                              {opcion.text}
                            </span>
                            <span className="shrink-0 text-[12px] font-semibold text-on-surface-variant">
                              {opcion.percent}%
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </article>
                );
              })}
            </section>
          ) : null}
        </>
      )}
    </Overlay>
  );
}
