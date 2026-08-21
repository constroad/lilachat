/**
 * Encuestas (F5). Motor PURO.
 *
 * Las dos opciones del diseño —«varias respuestas» y «resultados anónimos»—
 * no son adornos: cambian qué se puede guardar y qué se puede mostrar, y por
 * eso el conteo vive acá y no dentro de un componente.
 */

export type PollOption = { text: string; votes: string[] };

export type Poll = {
  question: string;
  options: PollOption[];
  allowMultiple: boolean;
  anonymous: boolean;
  closedAt?: Date | null;
};

export type PollTally = {
  optionIndex: number;
  text: string;
  count: number;
  /** 0–100. Sobre VOTANTES, no sobre votos: con varias respuestas la suma de
   *  porcentajes pasaría de 100 y el gráfico mentiría. */
  percent: number;
  /** Vacío si la encuesta es anónima: no se filtra ni «para mostrar solo el
   *  conteo», porque quien recibe el dato ya lo tiene. */
  voters: string[];
  votedByMe: boolean;
};

export function tallyPoll(poll: Poll, myUserId: string): PollTally[] {
  const uniqueVoters = new Set<string>();
  for (const option of poll.options) for (const voter of option.votes) uniqueVoters.add(voter);
  const total = uniqueVoters.size;

  return poll.options.map((option, optionIndex) => ({
    optionIndex,
    text: option.text,
    count: option.votes.length,
    percent: total === 0 ? 0 : Math.round((option.votes.length / total) * 100),
    voters: poll.anonymous ? [] : option.votes,
    votedByMe: option.votes.includes(myUserId),
  }));
}

export type VoteOutcome =
  | { ok: true; options: PollOption[] }
  | { ok: false; reason: string };

/**
 * Registra un voto. Idempotente por naturaleza: votar dos veces lo mismo
 * alterna (marca/desmarca) en vez de duplicar — que es lo que hace cualquier
 * encuesta y lo que evita que un doble toque cuente doble.
 */
export function applyVote(params: {
  poll: Poll;
  optionIndex: number;
  userId: string;
}): VoteOutcome {
  if (params.poll.closedAt) return { ok: false, reason: 'Esa encuesta ya se cerró.' };
  const chosen = params.poll.options[params.optionIndex];
  if (!chosen) return { ok: false, reason: 'Esa opción no existe.' };

  const options = params.poll.options.map((option) => ({
    ...option,
    votes: [...option.votes],
  }));
  const already = options[params.optionIndex]!.votes.includes(params.userId);

  if (already) {
    // Desmarcar siempre se puede, incluso con una sola respuesta permitida:
    // si no, un toque equivocado quedaría para siempre.
    options[params.optionIndex]!.votes = options[params.optionIndex]!.votes.filter(
      (voter) => voter !== params.userId
    );
    return { ok: true, options };
  }

  if (!params.poll.allowMultiple) {
    // Respuesta única: el voto se MUEVE, no se suma.
    for (const option of options) {
      option.votes = option.votes.filter((voter) => voter !== params.userId);
    }
  }
  options[params.optionIndex]!.votes.push(params.userId);
  return { ok: true, options };
}

/** Lo mínimo para que una encuesta tenga sentido. */
export function validatePoll(params: { question: string; options: string[] }): string | null {
  if (!params.question.trim()) return 'Escribe la pregunta.';
  const filled = params.options.map((option) => option.trim()).filter(Boolean);
  if (filled.length < 2) return 'Pon al menos dos opciones.';
  if (new Set(filled).size !== filled.length) return 'Hay opciones repetidas.';
  return null;
}
