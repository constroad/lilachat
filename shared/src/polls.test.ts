import { describe, expect, it } from 'vitest';
import { applyVote, tallyPoll, validatePoll, type Poll } from './polls.js';

const poll = (overrides: Partial<Poll> = {}): Poll => ({
  question: '¿Qué hacemos el finde?',
  options: [
    { text: 'Playa', votes: ['ana'] },
    { text: 'Cine', votes: [] },
  ],
  allowMultiple: false,
  anonymous: false,
  ...overrides,
});

describe('tallyPoll', () => {
  it('cuenta votos y marca lo que voté yo', () => {
    const tally = tallyPoll(poll(), 'ana');

    expect(tally[0]).toMatchObject({ text: 'Playa', count: 1, percent: 100, votedByMe: true });
    expect(tally[1]).toMatchObject({ count: 0, percent: 0, votedByMe: false });
  });

  /**
   * El porcentaje va sobre VOTANTES, no sobre votos: con varias respuestas
   * permitidas la suma pasaría de 100 y la barra mentiría.
   */
  it('con varias respuestas, el porcentaje es sobre votantes', () => {
    const tally = tallyPoll(
      poll({
        allowMultiple: true,
        options: [
          { text: 'Playa', votes: ['ana', 'beto'] },
          { text: 'Cine', votes: ['ana'] },
        ],
      }),
      'ana'
    );

    expect(tally[0]?.percent).toBe(100);
    expect(tally[1]?.percent).toBe(50);
  });

  /** Anónima de verdad: los nombres NO viajan, ni «solo para el conteo». */
  it('anónima no expone quién votó', () => {
    const tally = tallyPoll(poll({ anonymous: true }), 'ana');

    expect(tally[0]?.voters).toEqual([]);
    expect(tally[0]?.count).toBe(1);
  });

  it('sin votos no divide por cero', () => {
    const tally = tallyPoll(poll({ options: [{ text: 'A', votes: [] }] }), 'ana');

    expect(tally[0]?.percent).toBe(0);
  });
});

describe('applyVote', () => {
  it('respuesta única: el voto se MUEVE, no se suma', () => {
    const result = applyVote({ poll: poll(), optionIndex: 1, userId: 'ana' });

    expect(result.ok).toBe(true);
    expect((result as { options: Poll['options'] }).options[0]?.votes).toEqual([]);
    expect((result as { options: Poll['options'] }).options[1]?.votes).toEqual(['ana']);
  });

  it('varias respuestas: se suma sin quitar la anterior', () => {
    const result = applyVote({
      poll: poll({ allowMultiple: true }),
      optionIndex: 1,
      userId: 'ana',
    });

    expect((result as { options: Poll['options'] }).options[0]?.votes).toEqual(['ana']);
    expect((result as { options: Poll['options'] }).options[1]?.votes).toEqual(['ana']);
  });

  /** Un doble toque no cuenta doble: alterna. Y sin poder desmarcar, un toque
   *  equivocado quedaría para siempre. */
  it('votar lo mismo dos veces desmarca', () => {
    const result = applyVote({ poll: poll(), optionIndex: 0, userId: 'ana' });

    expect((result as { options: Poll['options'] }).options[0]?.votes).toEqual([]);
  });

  it('no muta la encuesta original', () => {
    const original = poll();
    applyVote({ poll: original, optionIndex: 1, userId: 'beto' });

    expect(original.options[1]?.votes).toEqual([]);
  });

  it('cerrada no acepta votos', () => {
    const result = applyVote({
      poll: poll({ closedAt: new Date() }),
      optionIndex: 0,
      userId: 'beto',
    });

    expect(result).toMatchObject({ ok: false });
  });

  it('una opción inexistente se rechaza', () => {
    expect(applyVote({ poll: poll(), optionIndex: 9, userId: 'ana' }).ok).toBe(false);
  });
});

describe('validatePoll', () => {
  it('exige pregunta y dos opciones', () => {
    expect(validatePoll({ question: '', options: ['a', 'b'] })).toMatch(/pregunta/i);
    expect(validatePoll({ question: '¿?', options: ['a', ''] })).toMatch(/dos opciones/i);
  });

  it('no deja opciones repetidas', () => {
    expect(validatePoll({ question: '¿?', options: ['Playa', 'Playa'] })).toMatch(/repetidas/i);
  });

  it('una encuesta válida no da error', () => {
    expect(validatePoll({ question: '¿Qué hacemos?', options: ['Playa', 'Cine'] })).toBeNull();
  });
});
