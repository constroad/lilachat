import { describe, expect, it } from 'vitest';
import { origenDeEncuesta, resumenDeEncuesta, votantesDeOpcion } from './encuestas';

const YO = '665f1a2b3c4d5e6f70818293';
const WILSON = '665f1a2b3c4d5e6f70818294';
const MARIA = '665f1a2b3c4d5e6f70818295';
const agenda = new Map([['960397018', 'Wilson Zamora']]);
const personas = {
  [YO]: { phone: '902049935' },
  [WILSON]: { phone: '960397018' },
  [MARIA]: { phone: '900000002', name: 'María' },
};

/** «No dicen de qué chat ni quién preguntó» (FL10, auditoría §46.3). */
describe('origenDeEncuesta', () => {
  it('en un grupo: el grupo y quién preguntó, con el nombre de MI agenda', () => {
    const origen = origenDeEncuesta({
      chat: { kind: 'group', name: 'Familia' },
      autor: { id: WILSON, phone: '960397018', name: 'Wilson' },
      yo: YO,
      agenda,
    });

    expect(origen).toBe('Familia · preguntó Wilson Zamora');
  });

  it('la propia: «preguntaste tú»', () => {
    expect(origenDeEncuesta({ chat: { kind: 'group', name: 'Familia' }, autor: { id: YO, phone: '902049935' }, yo: YO, agenda })).toBe(
      'Familia · preguntaste tú'
    );
  });

  it('en un 1:1 propia: el chat es el otro', () => {
    expect(origenDeEncuesta({ chat: { kind: 'direct', phone: '960397018' }, autor: { id: YO, phone: '902049935' }, yo: YO, agenda })).toBe(
      'Wilson Zamora · preguntaste tú'
    );
  });

  /** En un 1:1 ajena, el chat ES quien preguntó: nombrarlo dos veces sobra. */
  it('en un 1:1 ajena: «Wilson te preguntó», con el nombre del server si la agenda no lo tiene', () => {
    expect(origenDeEncuesta({ chat: { kind: 'direct', phone: '960397018' }, autor: { id: WILSON, phone: '960397018' }, yo: YO, agenda })).toBe(
      'Wilson Zamora te preguntó'
    );
    expect(origenDeEncuesta({ chat: { kind: 'direct', phone: '900000002', name: 'María' }, autor: { id: MARIA, phone: '900000002', name: 'María' }, yo: YO, agenda })).toBe(
      'María te preguntó'
    );
  });

  it('sin datos del chat (server viejo), nada', () => {
    expect(origenDeEncuesta({ yo: YO, agenda })).toBe('');
  });
});

/** «Nunca muestran quién votó» (FL10). */
describe('votantesDeOpcion', () => {
  it('«Tú» primero, después los demás con su nombre', () => {
    expect(votantesDeOpcion({ votos: [WILSON, YO], personas, yo: YO, agenda, anonima: false })).toBe('Tú y Wilson Zamora');
  });

  it('con más de tres, «y N más»', () => {
    const otros = ['a1', 'a2'];
    expect(votantesDeOpcion({ votos: [WILSON, MARIA, YO, ...otros], personas, yo: YO, agenda, anonima: false })).toBe(
      'Tú, Wilson Zamora, María y 2 más'
    );
  });

  it('anónima o sin votos: no se nombra a nadie', () => {
    expect(votantesDeOpcion({ votos: [WILSON], personas, yo: YO, agenda, anonima: true })).toBe('');
    expect(votantesDeOpcion({ votos: [], personas, yo: YO, agenda, anonima: false })).toBe('');
  });
});

describe('resumenDeEncuesta', () => {
  it('votantes únicos, no votos', () => {
    const opciones = [{ votes: [YO, WILSON] }, { votes: [YO] }];
    expect(resumenDeEncuesta({ opciones, cerrada: false })).toBe('2 votantes');
  });

  it('uno solo y cerrada', () => {
    expect(resumenDeEncuesta({ opciones: [{ votes: [WILSON] }], cerrada: true })).toBe('1 votante · Cerrada');
  });

  it('nadie votó todavía', () => {
    expect(resumenDeEncuesta({ opciones: [{ votes: [] }], cerrada: false })).toBe('Nadie votó todavía');
  });
});
