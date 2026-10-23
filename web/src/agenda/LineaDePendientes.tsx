import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, MapPin } from 'lucide-react';
import {
  cuandoDelEvento,
  estadoDelEvento,
  ETIQUETA_DE_REPETICION,
  repeatLabel,
  formatEventWhen,
  lineaDePendientes,
  origenDelRecordatorio,
  type AgendaEvent,
  type AgendaReminder,
  type Rsvp,
  type TonoDelEstado,
} from '@lilachat/shared';
import { api } from '../api';

type Linea = { recordatorios: AgendaReminder[]; vencidos: AgendaReminder[]; apagados: AgendaReminder[] };

const RESPUESTAS: { valor: Rsvp; etiqueta: string }[] = [
  { valor: 'yes', etiqueta: 'Voy' },
  { valor: 'maybe', etiqueta: 'Tal vez' },
  { valor: 'no', etiqueta: 'No voy' },
];
const TONO: Record<TonoDelEstado, string> = {
  propio: 'border-primary/30 bg-primary/10 text-primary',
  pendiente: 'border-tertiary/30 bg-tertiary/10 text-tertiary',
  ok: 'border-primary/40 bg-primary/15 text-primary',
  neutro: 'border-outline/20 bg-background text-on-surface-variant',
};
/** La web no tiene la agenda del teléfono: los nombres vienen del server. */
const SIN_AGENDA: ReadonlyMap<string, string> = new Map();
const DIA = new Intl.DateTimeFormat('es-PE', { weekday: 'short' });

/**
 * «Pendientes» en la web (José aprobó el 20/10), como la app: eventos y
 * recordatorios en UNA línea —Vencidos, Hoy, Mañana, Esta semana, Más
 * adelante— y al final los míos apagados, para prenderlos.
 */
export function LineaDePendientes({ jwt, onEditarRecordatorio }: { jwt: string; onEditarRecordatorio: (recordatorio: AgendaReminder) => void }) {
  const [eventos, setEventos] = useState<AgendaEvent[] | null>(null);
  const [linea, setLinea] = useState<Linea | null>(null);
  const [fallo, setFallo] = useState('');

  const cargar = useCallback(async () => {
    const [conEventos, conLinea] = await Promise.all([api<{ events: AgendaEvent[] }>('/agenda/events', { jwt }), api<Partial<Linea>>('/agenda/linea', { jwt })]);
    if (conEventos.ok) setEventos(conEventos.data.events);
    if (conLinea.ok) setLinea({ recordatorios: conLinea.data.recordatorios ?? [], vencidos: conLinea.data.vencidos ?? [], apagados: conLinea.data.apagados ?? [] });
    setFallo(!conEventos.ok ? conEventos.message : !conLinea.ok ? conLinea.message : '');
  }, [jwt]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const secciones = useMemo(() => (eventos && linea ? lineaDePendientes({ eventos, recordatorios: linea.recordatorios, vencidos: linea.vencidos, ahora: new Date() }) : null), [eventos, linea]);

  const responder = async (evento: AgendaEvent, rsvp: Rsvp) => {
    setEventos((antes) => antes?.map((uno) => (uno.id === evento.id ? { ...uno, myRsvp: rsvp } : uno)) ?? antes);
    const respuesta = await api(`/agenda/events/${evento.id}/rsvp`, { jwt, body: { rsvp } });
    if (!respuesta.ok) setFallo(respuesta.message);
    void cargar();
  };
  const prender = async (recordatorio: AgendaReminder) => {
    const respuesta = await api(`/agenda/reminders/${recordatorio._id}/toggle`, { jwt, body: { active: !recordatorio.active } });
    if (!respuesta.ok) setFallo(respuesta.message);
    void cargar();
  };

  if (secciones === null) {
    return fallo ? <p role="alert" className="py-4 text-center text-sm text-error">{fallo}</p> : <div data-testid="pendientes-cargando" className="h-24 animate-pulse rounded-xl bg-background" />;
  }
  if (secciones.length === 0 && !linea?.apagados.length) {
    return <p data-testid="pendientes-vacio" className="py-6 text-center text-sm leading-5 text-on-surface-variant">Nada pendiente. Los eventos y recordatorios de tus chats aparecen acá, por cuándo tocan.</p>;
  }
  return (
    <div>
      {fallo ? <p role="alert" className="mb-2 text-[12px] text-error">{fallo}</p> : null}
      {secciones.map((seccion) => (
        <section key={seccion.clave} data-testid={`seccion-${seccion.clave}`} className="mb-3">
          <h3 className="pb-2 text-[11px] font-bold uppercase tracking-wide text-primary">{seccion.titulo} · {seccion.items.length}</h3>
          {seccion.items.map((item) =>
            item.tipo === 'evento' ? (
              <FilaDeEvento key={`e-${item.id}`} evento={item.evento} onResponder={(rsvp) => void responder(item.evento, rsvp)} />
            ) : (
              <FilaDeRecordatorio key={`r-${item.id}`} recordatorio={item.recordatorio} cuando={item.cuando} vencido={seccion.clave === 'vencidos'} onEditar={() => onEditarRecordatorio(item.recordatorio)} />
            )
          )}
        </section>
      ))}
      {linea?.apagados.length ? (
        <section data-testid="seccion-apagados" className="mb-3">
          <h3 className="pb-2 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Apagados · {linea.apagados.length}</h3>
          {linea.apagados.map((recordatorio) => (
            <FilaDeRecordatorio key={recordatorio._id} recordatorio={recordatorio} cuando={new Date(recordatorio.startsAt)} onEditar={() => onEditarRecordatorio(recordatorio)} onPrender={() => void prender(recordatorio)} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function FilaDeEvento({ evento, onResponder }: { evento: AgendaEvent; onResponder: (rsvp: Rsvp) => void }) {
  const inicio = new Date(evento.startsAt);
  const estado = estadoDelEvento(evento);
  return (
    <article data-testid={`pendiente-evento-${evento.id}`} className="mb-2 rounded-xl border border-outline/15 bg-surface p-3">
      <div className="flex items-start gap-3">
        <div className="grid w-12 shrink-0 place-items-center rounded-lg border border-outline/15 py-1 leading-none">
          <span className="text-[10px] font-bold uppercase text-primary">{DIA.format(inicio).replace('.', '')}</span>
          <span className="mt-0.5 text-lg font-bold tabular-nums">{inicio.getDate()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{evento.title}</p>
          <p className="text-[12px] text-on-surface-variant">{cuandoDelEvento(evento.startsAt, evento.endsAt)}</p>
          {evento.location ? <p className="flex items-center gap-1 text-[12px] text-on-surface-variant"><MapPin size={11} /> <span className="truncate">{evento.location}</span></p> : null}
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONO[estado.tono]}`}>{estado.texto}</span>
      </div>
      {evento.mio ? null : (
        <div className="mt-2 grid grid-cols-3 gap-1">
          {RESPUESTAS.map((opcion) => (
            <button key={opcion.valor} type="button" data-testid={`rsvp-${evento.id}-${opcion.valor}`} aria-pressed={evento.myRsvp === opcion.valor} onClick={() => onResponder(opcion.valor)} className={`min-h-[34px] rounded-lg text-[12px] font-medium ${evento.myRsvp === opcion.valor ? 'bg-primary text-on-primary' : 'bg-background text-on-surface-variant hover:bg-primary/10'}`}>
              {opcion.etiqueta}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function FilaDeRecordatorio(props: { recordatorio: AgendaReminder; cuando: Date; vencido?: boolean; onEditar: () => void; onPrender?: () => void }) {
  const { recordatorio } = props;
  const repetido = recordatorio.recurrence !== 'once';
  return (
    <div data-testid={`pendiente-recordatorio-${recordatorio._id}`} className={`mb-2 flex items-center gap-3 rounded-xl border border-outline/15 bg-surface p-3 ${props.onPrender && !recordatorio.active ? 'opacity-70' : ''}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Bell size={17} /></span>
      <button type="button" onClick={props.onEditar} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-semibold">{recordatorio.title}</span>
        <span className="block text-[12px] text-on-surface-variant">{props.vencido ? `Sonó ${formatEventWhen(props.cuando).toLowerCase()}` : `${repetido ? `${repeatLabel(recordatorio.recurrence, recordatorio.repeat, ETIQUETA_DE_REPETICION[recordatorio.recurrence])} · ` : ''}${formatEventWhen(props.cuando)}`}</span>
        <span className="block text-[11px] text-on-surface-variant">{origenDelRecordatorio({ chat: recordatorio.chat, agenda: SIN_AGENDA })}</span>
      </button>
      {props.vencido ? (
        <button type="button" data-testid={`posponer-${recordatorio._id}`} onClick={props.onEditar} className="min-h-[32px] rounded-full bg-primary/10 px-3 text-[12px] font-semibold text-primary">Posponer</button>
      ) : props.onPrender ? (
        <button type="button" role="switch" aria-checked={recordatorio.active} data-testid={`prender-${recordatorio._id}`} onClick={props.onPrender} className={`relative h-6 w-11 rounded-full transition-colors ${recordatorio.active ? 'bg-primary' : 'bg-outline/40'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all ${recordatorio.active ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      ) : null}
    </div>
  );
}
