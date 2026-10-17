import { describe, expect, it } from 'vitest';
import { formatEventWhen, nextOccurrence, shouldRemind, summarizeRsvp, decidirRecordatorio } from './events.js';

describe('nextOccurrence', () => {
  const from = new Date('2026-08-20T12:00:00');

  it('una sola vez: solo si todavía no pasó', () => {
    const futuro = nextOccurrence({
      startsAt: new Date('2026-08-21T09:00:00'),
      recurrence: 'once',
      from,
    });

    expect(futuro?.getDate()).toBe(21);
    expect(
      nextOccurrence({ startsAt: new Date('2026-08-19T09:00:00'), recurrence: 'once', from })
    ).toBeNull();
  });

  it('diario: el siguiente día a la misma hora', () => {
    const next = nextOccurrence({
      startsAt: new Date('2026-08-20T10:00:00'),
      recurrence: 'daily',
      from,
    });

    expect(next?.getDate()).toBe(21);
    expect(next?.getHours()).toBe(10);
  });

  it('semanal: siete días después', () => {
    const next = nextOccurrence({
      startsAt: new Date('2026-08-16T18:00:00'),
      recurrence: 'weekly',
      from,
    });

    expect(next?.getDate()).toBe(23);
  });

  /**
   * Se salta de un golpe: iterar sumando períodos desde una fecha de hace
   * meses son miles de vueltas por recordatorio y por corrida del cron.
   */
  it('desde una fecha vieja NO itera: salta a la que viene', () => {
    const next = nextOccurrence({
      startsAt: new Date('2020-01-01T08:00:00'),
      recurrence: 'daily',
      from,
    });

    expect(next!.getTime()).toBeGreaterThan(from.getTime());
    expect(next!.getTime() - from.getTime()).toBeLessThan(86_400_000);
  });

  /** Si devolviera el mismo instante, el cron lo repetiría en cada corrida. */
  it('nunca devuelve el instante actual', () => {
    const exact = new Date('2026-08-20T12:00:00');
    const next = nextOccurrence({ startsAt: exact, recurrence: 'daily', from: exact });

    expect(next!.getTime()).toBeGreaterThan(exact.getTime());
  });
});

describe('shouldRemind', () => {
  const startsAt = new Date('2026-08-20T19:00:00');

  it('avisa al llegar la antelación', () => {
    expect(
      shouldRemind({ startsAt, remindMinutesBefore: 60, now: new Date('2026-08-20T18:00:00') })
    ).toBe(true);
  });

  it('todavía no: falta para el aviso', () => {
    expect(
      shouldRemind({ startsAt, remindMinutesBefore: 60, now: new Date('2026-08-20T17:30:00') })
    ).toBe(false);
  });

  /** El cron se solapa a propósito; sin el sello mandaría el aviso cada vez. */
  it('ya avisado no se repite', () => {
    expect(
      shouldRemind({
        startsAt,
        remindMinutesBefore: 60,
        now: new Date('2026-08-20T18:05:00'),
        alreadyRemindedAt: new Date('2026-08-20T18:00:00'),
      })
    ).toBe(false);
  });

  /** Avisar de una cena a las once de la noche no le sirve a nadie. */
  it('un aviso demasiado viejo ya no se manda', () => {
    expect(
      shouldRemind({
        startsAt,
        remindMinutesBefore: 60,
        now: new Date('2026-08-20T23:00:00'),
        lookbackMinutes: 60,
      })
    ).toBe(false);
  });
});

describe('summarizeRsvp', () => {
  it('cuenta cada respuesta y lo que falta', () => {
    expect(
      summarizeRsvp([{ rsvp: 'yes' }, { rsvp: 'yes' }, { rsvp: 'no' }, { rsvp: 'maybe' }, {}])
    ).toEqual({ yes: 2, no: 1, maybe: 1, pending: 1 });
  });
});

describe('formatEventWhen', () => {
  const now = new Date('2026-08-20T12:00:00');

  it('el diseño dice «Mañana, 7:00 PM», no una fecha completa', () => {
    expect(formatEventWhen(new Date('2026-08-21T19:00:00'), now)).toMatch(/^Mañana, /);
    expect(formatEventWhen(new Date('2026-08-20T19:00:00'), now)).toMatch(/^Hoy, /);
  });

  /** En es-PE septiembre se abrevia «set», no «sep»: el test lo asumió y falló
   *  — el formato lo decide el locale, no la intuición de quien escribe. */
  it('más lejos, con día y mes', () => {
    const texto = formatEventWhen(new Date('2026-09-05T19:00:00'), now);

    expect(texto).toMatch(/^5 \w+, /);
    expect(texto).not.toMatch(/Hoy|Mañana/);
  });
});

/**
 * Qué hace el cron con cada recordatorio (auditoría 17/10/2026). Antes, uno que
 * se pasó de la hora más de una hora —cron caído, o reactivado tarde— no se
 * avisaba NI se reprogramaba: quedaba activo para siempre, la tarjeta mostraba
 * una «próxima vez» que nunca sonaba, y con 50 así el cron no avisaba a nadie.
 */
describe('decidirRecordatorio', () => {
  const ahora = new Date('2026-10-17T15:00:00.000Z');
  const hace = (min: number) => new Date(ahora.getTime() - min * 60_000);

  it('todavía no es la hora: esperar', () => {
    expect(decidirRecordatorio({ startsAt: hace(-5), recurrence: 'once', remindedAt: null, now: ahora })).toEqual({ accion: 'esperar' });
  });

  it('en la hora (dentro de la ventana): avisar', () => {
    expect(decidirRecordatorio({ startsAt: hace(2), recurrence: 'daily', remindedAt: null, now: ahora })).toEqual({ accion: 'avisar' });
  });

  it('diario que se pasó horas: se mueve a la próxima vez SIN avisar tarde', () => {
    expect(decidirRecordatorio({ startsAt: hace(180), recurrence: 'daily', remindedAt: null, now: ahora })).toEqual({
      accion: 'reprogramar',
      proxima: new Date(hace(180).getTime() + 86_400_000),
    });
  });

  it('una vez que se pasó: se apaga (proxima null)', () => {
    expect(decidirRecordatorio({ startsAt: hace(180), recurrence: 'once', remindedAt: null, now: ahora })).toEqual({
      accion: 'reprogramar',
      proxima: null,
    });
  });

  it('ya avisado y pasado (reactivado sin cambiar la hora): también se resuelve, no queda en el limbo', () => {
    expect(decidirRecordatorio({ startsAt: hace(180), recurrence: 'once', remindedAt: hace(179), now: ahora })).toEqual({
      accion: 'reprogramar',
      proxima: null,
    });
  });

  it('ya avisado y dentro de la ventana: esperar (lo reprograma quien avisó)', () => {
    expect(decidirRecordatorio({ startsAt: hace(1), recurrence: 'daily', remindedAt: hace(0.5), now: ahora })).toEqual({ accion: 'esperar' });
  });
});
