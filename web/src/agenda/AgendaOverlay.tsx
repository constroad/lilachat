import { useCallback, useEffect, useState } from 'react';
import { Bell, CalendarPlus, ListPlus } from 'lucide-react';
import { tallyPoll, type AgendaPoll, type AgendaReminder } from '@lilachat/shared';
import { api } from '../api';
import { Overlay } from '../ui/Overlay';
import { LineaDePendientes } from './LineaDePendientes';
import { MisTareas } from './MisTareas';

type Pestana = 'pendientes' | 'tareas' | 'encuestas';
const TAB_LABEL: Record<Pestana, string> = { pendientes: 'Pendientes', tareas: 'Mis tareas', encuestas: 'Encuestas' };

/**
 * «Pendientes» en la web (José aprobó el 20/10; antes «Agenda»): la línea de
 * eventos y recordatorios por cuándo tocan, y las encuestas en su pestaña,
 * como la app. Arriba, crear un evento, una encuesta o un recordatorio propio.
 */
export function AgendaOverlay({
  jwt,
  myUserId,
  onClose,
  onCreateEvent,
  onCreatePoll,
  onCreateReminder,
  onEditarRecordatorio,
  chatNameOf,
  onOpenTask,
}: {
  jwt: string;
  myUserId: string;
  onClose: () => void;
  onCreateEvent: () => void;
  onCreatePoll: () => void;
  onCreateReminder: () => void;
  onEditarRecordatorio: (recordatorio: AgendaReminder) => void;
  /** «Mis tareas» (backlog 30): the chat's name as the list shows it, and opening it on the checklist. */
  chatNameOf: (chatId: string) => string;
  onOpenTask: (chatId: string, seq?: number) => void;
}) {
  const [pestana, setPestana] = useState<Pestana>('pendientes');
  const crear = [
    { id: 'btn-nuevo-evento', etiqueta: 'Evento', Icono: CalendarPlus, accion: onCreateEvent },
    { id: 'btn-nueva-encuesta', etiqueta: 'Encuesta', Icono: ListPlus, accion: onCreatePoll },
    { id: 'btn-nuevo-recordatorio', etiqueta: 'Recordatorio', Icono: Bell, accion: onCreateReminder },
  ];

  return (
    <Overlay title="Pendientes" onClose={onClose}>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {crear.map(({ id, etiqueta, Icono, accion }) => (
          <button key={id} type="button" data-testid={id} onClick={accion} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-primary/10 px-2 text-[13px] font-semibold text-primary">
            <Icono size={15} /> {etiqueta}
          </button>
        ))}
      </div>
      <div role="tablist" className="mb-3 flex gap-4 border-b border-outline/15">
        {(['pendientes', 'tareas', 'encuestas'] as const).map((clave) => (
          <button key={clave} type="button" role="tab" aria-selected={pestana === clave} data-testid={`pestana-${clave}`} onClick={() => setPestana(clave)} className={`min-h-[40px] border-b-2 text-sm ${pestana === clave ? 'border-primary font-semibold text-primary' : 'border-transparent text-on-surface-variant'}`}>
            {TAB_LABEL[clave]}
          </button>
        ))}
      </div>
      {pestana === 'pendientes' ? <LineaDePendientes jwt={jwt} onEditarRecordatorio={onEditarRecordatorio} /> : pestana === 'tareas' ? <MisTareas jwt={jwt} me={myUserId} chatNameOf={chatNameOf} onOpen={onOpenTask} /> : <EncuestasAbiertas jwt={jwt} myUserId={myUserId} />}
    </Overlay>
  );
}

/** Las encuestas de mis chats, para votar sin entrar a cada uno. */
function EncuestasAbiertas({ jwt, myUserId }: { jwt: string; myUserId: string }) {
  const [polls, setPolls] = useState<AgendaPoll[] | null>(null);
  const cargar = useCallback(async () => {
    const respuesta = await api<{ polls: AgendaPoll[] }>('/agenda/polls', { jwt });
    setPolls(respuesta.ok ? respuesta.data.polls : []);
  }, [jwt]);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const votar = async (poll: AgendaPoll, indice: number) => {
    // El voto lo resuelve el server (una opción o varias, quitar el propio): se recarga.
    const resultado = await api(`/agenda/polls/${poll.id}/vote`, { jwt, body: { optionIndex: indice } });
    if (resultado.ok) void cargar();
  };

  if (polls === null) return <div data-testid="agenda-cargando" className="h-24 animate-pulse rounded-xl bg-background" />;
  if (polls.length === 0) return <p className="py-6 text-center text-sm text-on-surface-variant">No hay encuestas abiertas. Crea una para decidir entre todos.</p>;
  return (
    <section>
      {polls.map((poll) => {
        // `closedAt` viaja como texto en JSON y el motor lo tipa como fecha.
        const conteo = tallyPoll({ ...poll, closedAt: poll.closedAt ? new Date(poll.closedAt) : null }, myUserId);
        return (
          <article key={poll.id} data-testid={`encuesta-${poll.id}`} className="mb-2 rounded-xl border border-outline/15 bg-surface p-4">
            <h4 className="text-sm font-semibold">{poll.question}</h4>
            <div className="mt-2">
              {conteo.map((opcion, indice) => (
                <button key={indice} type="button" data-testid={`votar-${poll.id}-${indice}`} aria-pressed={opcion.votedByMe} onClick={() => void votar(poll, indice)} className="relative mb-1.5 block w-full overflow-hidden rounded-lg bg-background px-3 py-2 text-left">
                  <span aria-hidden className={`absolute inset-y-0 left-0 ${opcion.votedByMe ? 'bg-primary/25' : 'bg-primary/10'}`} style={{ width: `${opcion.percent}%` }} />
                  <span className="relative flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px]">{opcion.text}</span>
                    <span className="shrink-0 text-[12px] font-semibold text-on-surface-variant">{opcion.percent}%</span>
                  </span>
                </button>
              ))}
            </div>
          </article>
        );
      })}
    </section>
  );
}
