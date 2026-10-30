import { describe, expect, it } from 'vitest';
import { asistentesPorRespuesta, cuandoDelEvento, origenDelEvento, resumenDeRsvp, terminaPorDefecto } from './eventos.js';

const YO = '665f1a2b3c4d5e6f70818293';
const WILSON = '665f1a2b3c4d5e6f70818294';
const MARIA = '665f1a2b3c4d5e6f70818295';
const agenda = new Map([['960397018', 'Wilson Zamora']]);
const personas = {
  [YO]: { phone: '902049935' },
  [WILSON]: { phone: '960397018' },
  [MARIA]: { phone: '900000002', name: 'María' },
};

/** «Sin hora de fin» (FL10): el diseño dice «Ends at 10:00 PM». */
describe('cuandoDelEvento', () => {
  const ahora = new Date('2026-10-18T10:00:00');

  it('sin fin, solo el comienzo', () => {
    expect(cuandoDelEvento('2026-10-18T19:00:00', undefined, ahora)).toMatch(/^Hoy, 7:00/);
  });

  it('el mismo día: «Hoy, 7:00 p. m. – 10:00 p. m.»', () => {
    expect(cuandoDelEvento('2026-10-18T19:00:00', '2026-10-18T22:00:00', ahora)).toMatch(/^Hoy, 7:00.+ – 10:00/);
  });

  it('otro día: el fin con su fecha', () => {
    expect(cuandoDelEvento('2026-10-18T22:00:00', '2026-10-19T02:00:00', ahora)).toMatch(/– Mañana, 2:00/);
  });
});

describe('terminaPorDefecto', () => {
  it('dos horas después del comienzo', () => {
    expect(terminaPorDefecto(new Date('2026-10-18T19:00:00')).getHours()).toBe(21);
  });
});

/** «Sin detalle para quien no lo creó: en qué chat» (FL10). */
describe('origenDelEvento', () => {
  it('en un grupo: el grupo y quién lo creó, con mi agenda', () => {
    expect(origenDelEvento({ chat: { kind: 'group', name: 'Familia' }, creadorId: WILSON, personas, yo: YO, agenda })).toBe(
      'Familia · lo creó Wilson Zamora'
    );
  });

  it('propio', () => {
    expect(origenDelEvento({ chat: { kind: 'group', name: 'Familia' }, creadorId: YO, personas, yo: YO, agenda })).toBe('Familia · lo creaste tú');
  });

  it('me invitaron de afuera del chat: quién me invitó', () => {
    expect(origenDelEvento({ creadorId: MARIA, invitadoPor: WILSON, personas, yo: YO, agenda })).toBe('Wilson Zamora te invitó');
  });
});

/** «Quiénes van» (FL10): por respuesta, «Tú» primero. */
describe('asistentesPorRespuesta', () => {
  it('agrupa, nombra y omite los grupos vacíos', () => {
    const grupos = asistentesPorRespuesta({
      asistentes: [
        { userId: WILSON, rsvp: 'yes' },
        { userId: YO, rsvp: 'yes' },
        { userId: MARIA },
      ],
      personas,
      yo: YO,
      agenda,
    });

    expect(grupos).toEqual([
      { clave: 'yes', titulo: 'Van', nombres: ['Tú', 'Wilson Zamora'] },
      { clave: 'pending', titulo: 'Sin responder', nombres: ['María'] },
    ]);
  });
});

/**
 * El resumen de quién va, el MISMO en la Agenda y en la tarjeta del chat
 * (FL13d): la Agenda decía «1 van» y el chat «1 va».
 */
describe('resumenDeRsvp', () => {
  it('singular y plural de «va»', () => {
    expect(resumenDeRsvp({ yes: 1, maybe: 0, no: 0, pending: 3 })).toBe('1 va · 0 tal vez · 3 sin responder');
    expect(resumenDeRsvp({ yes: 2, maybe: 1, no: 0, pending: 0 })).toBe('2 van · 1 tal vez · 0 sin responder');
  });

  it('nadie todavía: 0 van', () => {
    expect(resumenDeRsvp({ yes: 0, maybe: 0, no: 0, pending: 0 })).toBe('0 van · 0 tal vez · 0 sin responder');
  });
});

describe('asistentesPorRespuesta in the web detail (pending 10, design w3c-web-agenda)', () => {
  it('with includeEmpty, Van, Tal vez and No van always show; Sin responder only with someone', () => {
    const personas = { a: { phone: '987654321', name: 'Ana' } };
    const grupos = asistentesPorRespuesta({ asistentes: [{ userId: 'a', rsvp: 'yes' }], personas, yo: 'yo', agenda: new Map(), includeEmpty: true });
    expect(grupos.map((grupo) => [grupo.clave, grupo.nombres.length])).toEqual([['yes', 1], ['maybe', 0], ['no', 0]]);
  });
});
