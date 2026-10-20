import { useState } from 'react';
import { Check, ClipboardList } from 'lucide-react';
import { applyVote, resumenDeEncuesta, tallyPoll, type AgendaPoll } from '@lilachat/shared';
import { api } from '../../api';
import { useConversacion } from '../contextoDeLaConversacion';
import { useTarjeta } from './useTarjeta';
import { TarjetaCargando, TarjetaConFallo, TarjetaQueNoEsta } from './EstadosDeTarjeta';

const comoFecha = (poll: AgendaPoll) => ({ ...poll, closedAt: poll.closedAt ? new Date(poll.closedAt) : null });

/**
 * La encuesta DENTRO del chat (W3c, 20/10; diseño `w3c-web-tarjetas`): se
 * vota acá mismo, optimista y con vuelta atrás, como la app.
 */
export function EncuestaEnElChat({ id }: { id: string }) {
  const { jwt, yo } = useConversacion();
  const { valor: poll, fallo, cargar, reemplazar } = useTarjeta<AgendaPoll>({ tipo: 'encuesta', id, ruta: `/agenda/polls/${id}`, campo: 'poll', jwt });
  const [ocupada, setOcupada] = useState(false);
  const [error, setError] = useState('');
  if (poll === null) return <TarjetaQueNoEsta texto="Esta encuesta ya no está disponible." />;
  if (poll === undefined) return fallo ? <TarjetaConFallo texto="No se pudo cargar la encuesta." onReintentar={() => void cargar()} /> : <TarjetaCargando />;

  const conteo = tallyPoll(comoFecha(poll), yo);
  const cerrada = Boolean(poll.closedAt);
  const vote = async (indice: number) => {
    if (ocupada) return;
    const local = applyVote({ poll: comoFecha(poll), optionIndex: indice, userId: yo });
    if (!local.ok) return setError(local.reason);
    setError('');
    reemplazar({ ...poll, options: local.options });
    setOcupada(true);
    const respuesta = await api<{ poll?: AgendaPoll }>(`/agenda/polls/${id}/vote`, { jwt, body: { optionIndex: indice } });
    setOcupada(false);
    if (respuesta.ok) return respuesta.data.poll ? reemplazar(respuesta.data.poll) : void cargar();
    reemplazar(poll);
    setError(respuesta.message);
  };

  return (
    <div data-testid={`encuesta-en-chat-${id}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary">
        <ClipboardList size={14} /> Encuesta
      </p>
      <p className="mt-1 text-[15px] font-semibold">{poll.question}</p>
      <p className="text-[12px] text-on-surface-variant">{cerrada ? 'Cerrada' : poll.allowMultiple ? 'Elige una o más' : 'Elige una'}</p>
      <div className="mt-3 space-y-2.5">
        {conteo.map((opcion) => (
          <button key={opcion.optionIndex} type="button" data-testid={`votar-${id}-${opcion.optionIndex}`} aria-pressed={opcion.votedByMe} disabled={cerrada} onClick={() => void vote(opcion.optionIndex)} className="block w-full text-left disabled:cursor-default">
            <span className="flex items-center gap-2.5">
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${opcion.votedByMe ? 'border-primary bg-primary text-on-primary' : 'border-outline/40'}`}>{opcion.votedByMe ? <Check size={12} strokeWidth={3} /> : null}</span>
              <span className="min-w-0 flex-1 truncate text-[13px]">{opcion.text}</span>
              <span className="text-[12px] font-semibold tabular-nums">{opcion.count}</span>
            </span>
            <span className="mt-1.5 ml-[30px] block h-1.5 overflow-hidden rounded-full bg-background">
              <span className={`block h-full rounded-full ${opcion.votedByMe ? 'bg-primary' : 'bg-primary/50'}`} style={{ width: `${opcion.percent}%` }} />
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 border-t border-outline/10 pt-2 text-[12px] text-on-surface-variant">
        {resumenDeEncuesta({ opciones: poll.options, cerrada })}
        {conteo.some((opcion) => opcion.votedByMe) ? ' · Votaste' : ''}
      </p>
      {error ? <p role="alert" className="mt-1 text-[12px] text-error">{error}</p> : null}
    </div>
  );
}
