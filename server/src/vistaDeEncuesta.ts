import type { Types } from 'mongoose';
import { chatVisible, infoDeChats, personasPorId, soloConocidas, type ChatVisible, type PersonaVisible } from './contextoDeChats.js';
import type { Poll } from './eventModels.js';

/** Con qué la app nombra a alguien: el teléfono va a la agenda; el nombre es el respaldo. */
export type PersonaDeEncuesta = PersonaVisible;

/** La encuesta como la ve UNA persona (FL10, auditoría §46.3). */
export type VistaDeEncuesta = {
  id: string;
  chatId: string;
  question: string;
  allowMultiple: boolean;
  anonymous: boolean;
  closedAt: Date | null;
  createdAt?: Date;
  /** De qué chat: el nombre del grupo, o el teléfono (y su nombre) del otro en un 1:1. */
  chat: ChatVisible;
  autor: { id: string } & PersonaDeEncuesta;
  esMia: boolean;
  options: { text: string; votes: string[] }[];
  /** Quiénes aparecen: el autor y, si no es anónima, los votantes. */
  personas: Record<string, PersonaDeEncuesta>;
};

type EncuestaGuardada = Poll & { createdAt?: Date };

/**
 * Los votos que salen del server. En una anónima, cada votante ajeno pasa a un
 * seudónimo ESTABLE dentro de la encuesta («anonimo-0»): los conteos y el
 * porcentaje sobre votantes siguen bien —también en las apps viejas, que
 * cuentan `votes`— y nadie recibe quién votó. Lo propio queda con mi id.
 */
export function votosVisibles(encuesta: Pick<Poll, 'options' | 'anonymous'>, yo: string): { text: string; votes: string[] }[] {
  const seudonimos = new Map<string, string>();
  const ver = (votante: string) => {
    if (!encuesta.anonymous || votante === yo) return votante;
    if (!seudonimos.has(votante)) seudonimos.set(votante, `anonimo-${seudonimos.size}`);
    return seudonimos.get(votante)!;
  };
  return encuesta.options.map((opcion) => ({ text: opcion.text, votes: opcion.votes.map((votante) => ver(String(votante))) }));
}

function idsANombrar(encuesta: EncuestaGuardada): string[] {
  const ids = new Set<string>([String(encuesta.createdBy)]);
  if (!encuesta.anonymous) for (const opcion of encuesta.options) for (const votante of opcion.votes) ids.add(String(votante));
  return [...ids];
}

/** Las vistas de varias encuestas con DOS consultas, sin importar cuántas sean. */
export async function vistasDeEncuestas(encuestas: EncuestaGuardada[], yo: Types.ObjectId): Promise<VistaDeEncuesta[]> {
  const mio = String(yo);
  const chats = await infoDeChats(encuestas.map((encuesta) => encuesta.chatId), mio);
  const otros = [...chats.values()].flatMap((chat) => (chat.otroId ? [chat.otroId] : []));
  const personas = await personasPorId([...encuestas.flatMap(idsANombrar), ...otros]);

  return encuestas.map((encuesta) => {
    const autorId = String(encuesta.createdBy);
    return {
      id: String(encuesta._id),
      chatId: String(encuesta.chatId),
      question: encuesta.question,
      allowMultiple: encuesta.allowMultiple,
      anonymous: encuesta.anonymous,
      closedAt: encuesta.closedAt ?? null,
      createdAt: encuesta.createdAt,
      chat: chatVisible(chats.get(String(encuesta.chatId)), personas),
      autor: { id: autorId, phone: '', ...personas.get(autorId) },
      esMia: autorId === mio,
      options: votosVisibles(encuesta, mio),
      personas: soloConocidas(idsANombrar(encuesta), personas),
    };
  });
}
