import { describe, expect, it } from 'vitest';
import { alarmCountdown, alarmKicker, alarmWhen, nextSnooze, noteWithoutAdvance, SNOOZE_DEFAULT } from './alarmView';

/** The full-screen alert in guinda and black (Stitch a-01/a-02, José 29/10: «ya había generado uno nuevo»). */
const at = (iso: string) => new Date(iso);
const NOW = at('2026-10-29T15:41:00-05:00');

describe('what the alert says', () => {
  it('names an event when it rings before its start or has a place; otherwise a reminder', () => {
    expect(alarmKicker({ startsAt: '2026-10-29T16:00:00-05:00', hasPlace: false, now: NOW })).toBe('Evento');
    expect(alarmKicker({ startsAt: '2026-10-29T15:40:00-05:00', hasPlace: true, now: NOW })).toBe('Evento');
    expect(alarmKicker({ startsAt: '2026-10-29T15:41:00-05:00', hasPlace: false, now: NOW })).toBe('Recordatorio');
    expect(alarmKicker({ startsAt: undefined, hasPlace: false, now: NOW })).toBe('Recordatorio');
  });

  it('the day and the time: today, tomorrow, or the date', () => {
    expect(alarmWhen('2026-10-29T16:00:00-05:00', NOW)).toBe('Hoy 4:00 p. m.');
    expect(alarmWhen('2026-10-30T09:00:00-05:00', NOW)).toBe('Mañana 9:00 a. m.');
    expect(alarmWhen('2026-11-03T09:00:00-05:00', NOW)).toBe('mar 3 nov, 9:00 a. m.');
    expect(alarmWhen('no es fecha', NOW)).toBe('');
  });

  it('counts down to the start, says «Ahora» at it, and how long ago after it', () => {
    expect(alarmCountdown('2026-10-29T16:00:00-05:00', NOW)).toBe('Empieza en 19 min');
    expect(alarmCountdown('2026-10-29T19:41:00-05:00', NOW)).toBe('Empieza en 4 h');
    expect(alarmCountdown('2026-10-29T15:41:20-05:00', NOW)).toBe('Ahora');
    expect(alarmCountdown('2026-10-29T15:36:00-05:00', NOW)).toBe('Empezó hace 5 min');
    expect(alarmCountdown(undefined, NOW)).toBeNull();
  });

  it('the note without the «Empieza en…» the server put in front: the screen counts it live', () => {
    expect(noteWithoutAdvance('Empieza en 4 h · 5pm consultorio c-b09. Buscar estacionamiento')).toBe('5pm consultorio c-b09. Buscar estacionamiento');
    expect(noteWithoutAdvance('Empieza en 15 min')).toBe('');
    expect(noteWithoutAdvance('Llevar los planos')).toBe('Llevar los planos');
  });

  it('snooze goes by 5 minutes, between 5 and 60', () => {
    expect(SNOOZE_DEFAULT).toBe(5);
    expect(nextSnooze(5, -1)).toBe(5);
    expect(nextSnooze(5, 1)).toBe(10);
    expect(nextSnooze(60, 1)).toBe(60);
    expect(nextSnooze(30, -1)).toBe(25);
  });
});
