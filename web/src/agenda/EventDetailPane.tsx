import { ArrowLeft, CalendarDays, Check, CircleHelp, FileText, MapPin, X } from 'lucide-react';
import { asistentesPorRespuesta, cuandoDelEvento, spaceInitials, type AgendaEvent, type Rsvp } from '@lilachat/shared';

const ANSWERS: { value: Rsvp; label: string; Icon: typeof Check }[] = [
  { value: 'yes', label: 'Voy', Icon: Check },
  { value: 'maybe', label: 'Tal vez', Icon: CircleHelp },
  { value: 'no', label: 'No voy', Icon: X },
];
const DOT: Record<Rsvp | 'pending', string> = { yes: 'bg-primary', maybe: 'bg-tertiary', no: 'bg-outline', pending: 'bg-outline/50' };
const EMPTY_GROUP: Record<Rsvp | 'pending', string> = {
  yes: 'Nadie confirmó todavía.',
  maybe: 'Nadie respondió «tal vez».',
  no: 'Ningún participante rechazó la invitación.',
  pending: '',
};
/** The web has no phone address book: the names come from the server. */
const NO_AGENDA: ReadonlyMap<string, string> = new Map();

/** Where the event lives: the group's name, the other person in a 1:1, or nothing for an outside invitation. */
function chatLabelOf(event: AgendaEvent): string {
  if (!event.chat) return '';
  return event.chat.kind === 'group' ? (event.chat.name ?? 'Grupo') : (event.chat.name ?? event.chat.phone ?? '');
}

/**
 * The detail of an event in «Pendientes» (pending 10, design `w3c-web-agenda`):
 * when and where, my answer, and who goes — Van, Tal vez, No van and Sin
 * responder — with the people as chips.
 */
export function EventDetailPane(props: { event: AgendaEvent; me: string; onAnswer: (rsvp: Rsvp) => void; onBack: () => void }) {
  const { event } = props;
  const groups = asistentesPorRespuesta({ asistentes: event.attendees ?? [], personas: event.personas ?? {}, yo: props.me, agenda: NO_AGENDA, includeEmpty: true });
  const invited = event.attendees?.length ?? event.rsvpSummary.yes + event.rsvpSummary.maybe + event.rsvpSummary.no + event.rsvpSummary.pending;
  const chatLabel = chatLabelOf(event);
  return (
    <article data-testid={`detalle-evento-${event.id}`} className="min-w-0">
      <button type="button" data-testid="volver-a-pendientes" onClick={props.onBack} className="mb-2 flex min-h-[40px] items-center gap-1 text-sm text-on-surface-variant md:hidden">
        <ArrowLeft size={16} /> Pendientes
      </button>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Evento{chatLabel ? ` · ${chatLabel}` : ''}</p>
      <h3 className="mt-1 text-xl font-bold leading-tight">{event.title}</h3>
      <div className="mt-4 space-y-3 rounded-xl border border-outline/15 bg-background p-4 text-sm">
        <p className="flex items-start gap-3"><CalendarDays size={18} className="shrink-0 text-primary" /> {cuandoDelEvento(event.startsAt, event.endsAt)}</p>
        {event.location ? <p className="flex items-start gap-3"><MapPin size={18} className="shrink-0 text-primary" /> <span className="min-w-0 break-words">{event.location}</span></p> : null}
        {event.description ? <p className="flex items-start gap-3"><FileText size={18} className="shrink-0 text-primary" /> <span className="min-w-0 whitespace-pre-wrap break-words">{event.description}</span></p> : null}
      </div>
      {event.mio ? (
        <p className="mt-4 text-sm text-on-surface-variant">Lo creaste tú: los invitados responden desde aquí o desde el chat.</p>
      ) : (
        <>
          <p className="mt-5 text-sm font-semibold">Tu respuesta:</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {ANSWERS.map(({ value, label, Icon }) => (
              <button key={value} type="button" data-testid={`rsvp-${event.id}-${value}`} aria-pressed={event.myRsvp === value} onClick={() => props.onAnswer(value)} className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border text-sm ${event.myRsvp === value ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-outline/20 text-on-surface-variant hover:bg-background'}`}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="mt-5 border-t border-outline/15 pt-4">
        <p className="flex items-baseline justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          Asistentes <span className="font-normal normal-case tracking-normal">{invited === 1 ? '1 convocado' : `${invited} convocados`}</span>
        </p>
        {groups.map((group) => (
          <section key={group.clave} data-testid={`asistentes-${group.clave}`} className="mt-3">
            <p className="flex items-center gap-2 text-sm font-semibold"><span className={`h-2 w-2 rounded-full ${DOT[group.clave]}`} /> {group.titulo} ({group.nombres.length})</p>
            {group.nombres.length === 0 ? (
              <p className="mt-1 pl-4 text-[12px] italic text-on-surface-variant">{EMPTY_GROUP[group.clave]}</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {group.nombres.map((name, index) => (
                  <span key={`${name}-${index}`} className="flex min-h-[32px] items-center gap-1.5 rounded-full border border-outline/15 bg-surface px-2.5 text-[13px]">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">{spaceInitials(name)}</span>
                    {name}
                  </span>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
