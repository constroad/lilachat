import type { Types, UpdateQuery } from 'mongoose';
import type { Poll } from './eventModels.js';

/**
 * Los pasos ATÓMICOS de un voto (FL10). Antes se leía la encuesta, se armaba
 * el voto en memoria y se reescribían TODAS las opciones: dos votos a la vez y
 * uno se perdía. Ahora cada voto toca solo el id de quien vota.
 *
 * Las reglas son las de `applyVote` (shared): tocar lo ya votado lo quita; con
 * varias respuestas se suma; con una sola, se mueve.
 */
export function pasosDelVoto(params: {
  yaVotada: boolean;
  permiteVarias: boolean;
  indice: number;
  yo: Types.ObjectId;
}): UpdateQuery<Poll>[] {
  const ruta = `options.${params.indice}.votes`;
  if (params.yaVotada) return [{ $pull: { [ruta]: params.yo } }];
  if (params.permiteVarias) return [{ $addToSet: { [ruta]: params.yo } }];
  return [{ $pull: { 'options.$[].votes': params.yo } }, { $addToSet: { [ruta]: params.yo } }];
}
