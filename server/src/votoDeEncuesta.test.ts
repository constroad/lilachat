import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { pasosDelVoto } from './votoDeEncuesta.js';

/** Un voto toca solo el id de quien vota (FL10): dos a la vez ya no se pisan. */
describe('pasosDelVoto', () => {
  const yo = new Types.ObjectId();

  it('tocar lo ya votado lo quita', () => {
    expect(pasosDelVoto({ yaVotada: true, permiteVarias: false, indice: 1, yo })).toEqual([{ $pull: { 'options.1.votes': yo } }]);
  });

  it('con varias respuestas se suma sin duplicar', () => {
    expect(pasosDelVoto({ yaVotada: false, permiteVarias: true, indice: 0, yo })).toEqual([{ $addToSet: { 'options.0.votes': yo } }]);
  });

  it('con una sola, se saca de todas y se pone en la elegida', () => {
    expect(pasosDelVoto({ yaVotada: false, permiteVarias: false, indice: 2, yo })).toEqual([
      { $pull: { 'options.$[].votes': yo } },
      { $addToSet: { 'options.2.votes': yo } },
    ]);
  });
});
