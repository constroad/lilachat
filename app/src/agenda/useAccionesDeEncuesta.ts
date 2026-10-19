import { useState } from 'react';
import { applyVote } from '@lilachat/shared';
import { agendaDelete, agendaPost, type AgendaPoll } from './agendaApi';

/**
 * Votar, cerrar y eliminar una encuesta (salió de `PollsScreen`, 18/10). Lo
 * usan la pestaña Encuestas y la tarjeta de la encuesta dentro del chat: dos
 * copias de esto eran dos lugares donde un voto podía comportarse distinto.
 *
 * `reemplazar` deja la encuesta como quedó (o `null` si se eliminó); `recargar`
 * es para un server viejo que contesta sin la encuesta.
 */
export function useAccionesDeEncuesta(params: {
  jwt: string;
  yo: string;
  reemplazar: (id: string, nueva: AgendaPoll | null) => void;
  recargar: () => void;
}) {
  const { jwt, yo, reemplazar, recargar } = params;
  /** La encuesta que tiene un pedido en vuelo: no acepta otro (FL10). */
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const decir = (id: string, mensaje: string) => setErrores((antes) => ({ ...antes, [id]: mensaje }));

  /** El voto se ve al instante; si el server no lo toma, vuelve atrás y lo dice. */
  const votar = async (poll: AgendaPoll, optionIndex: number) => {
    if (ocupada) return;
    const local = applyVote({ poll: { ...poll, closedAt: poll.closedAt ? new Date(poll.closedAt) : null }, optionIndex, userId: yo });
    if (!local.ok) return decir(poll.id, local.reason);
    decir(poll.id, '');
    reemplazar(poll.id, { ...poll, options: local.options });
    setOcupada(poll.id);
    const respuesta = await agendaPost<{ poll?: AgendaPoll }>(`/polls/${poll.id}/vote`, jwt, { optionIndex });
    setOcupada(null);
    // Un server viejo contesta sin la encuesta: el voto entró, se recarga.
    if (respuesta.ok) return respuesta.data.poll ? reemplazar(poll.id, respuesta.data.poll) : recargar();
    reemplazar(poll.id, poll);
    decir(poll.id, respuesta.message ?? 'No se pudo votar. Inténtalo de nuevo.');
  };

  const cerrar = async (poll: AgendaPoll) => {
    setOcupada(poll.id);
    const respuesta = await agendaPost<{ poll?: AgendaPoll }>(`/polls/${poll.id}/close`, jwt, {});
    setOcupada(null);
    if (respuesta.ok) return respuesta.data.poll ? reemplazar(poll.id, respuesta.data.poll) : recargar();
    decir(poll.id, respuesta.message ?? 'No se pudo cerrar. Inténtalo de nuevo.');
  };

  const eliminar = async (poll: AgendaPoll) => {
    setOcupada(poll.id);
    const respuesta = await agendaDelete(`/polls/${poll.id}`, jwt);
    setOcupada(null);
    if (respuesta.ok) return reemplazar(poll.id, null);
    decir(poll.id, respuesta.message ?? 'No se pudo eliminar. Inténtalo de nuevo.');
  };

  return { ocupada, errores, limpiarErrores: () => setErrores({}), votar, cerrar, eliminar };
}
