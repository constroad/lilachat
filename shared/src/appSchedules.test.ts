import { describe, expect, it } from 'vitest';
import { firstRunAt, lastRunProblem, recurrenceOf, repeatOfDays, scheduleDecision, scheduleLine, scheduleNotRunText, schedulePlaceProblem, scheduleRequestOf, scheduleWhere, validateScheduleInput, validateSuggestedSchedules, weekdaysOf } from './appSchedules.js';

/** A schedule = a command that runs at a time, like a reminder (José, 28/10; agentes COMANDOS-Y-HORARIOS §3). */
const commands = [
  { command: 'asistencia', description: 'Asistencia del día', schedulable: true as const },
  { command: 'planilla', description: 'Planilla', schedulable: true as const, shareable: false as const },
  { command: 'marcar', description: 'Marcar (formulario)' },
];
// 28/10/2026 is a Wednesday; 15:00 UTC is 10:00 in Lima.
const WEDNESDAY_10_LIMA = new Date('2026-10-28T15:00:00Z');

describe('what an app suggests in its manifest', () => {
  it('keeps the schedulable ones in the server shape, drops what does not fit, never refuses', () => {
    expect(
      validateSuggestedSchedules(
        [
          { command: 'asistencia', text: '', time: '10:30', repeat: { weekdays: [1, 2, 3, 4, 5, 6] }, only_if_something: false },
          { command: 'asistencia', text: 'cierre', time: '18:30', repeat: { every: 1 } },
          { command: 'marcar', time: '07:00', repeat: { every: 1 } },
          { command: 'nada', time: '07:00', repeat: { every: 1 } },
          { command: 'asistencia', time: '25:00', repeat: { every: 1 } },
          { command: 'asistencia', time: '07:00', repeat: {} },
        ],
        commands
      )
    ).toEqual([
      { command: 'asistencia', text: '', time: '10:30', repeat: { weekdays: [1, 2, 3, 4, 5, 6] }, onlyIfSomething: false },
      { command: 'asistencia', text: 'cierre', time: '18:30', repeat: { every: 1 }, onlyIfSomething: false },
    ]);
    expect(validateSuggestedSchedules('x', commands)).toEqual([]);
  });
});

describe('when it runs', () => {
  it('every day or on weekdays, as a reminder repeats', () => {
    expect(recurrenceOf({ every: 1 })).toEqual({ recurrence: 'daily', rule: undefined });
    expect(recurrenceOf({ every: 2 })).toEqual({ recurrence: 'daily', rule: { every: 2 } });
    expect(recurrenceOf({ weekdays: [1, 2, 3, 4, 5, 6] })).toEqual({ recurrence: 'weekly', rule: { weekdays: [1, 2, 3, 4, 5, 6] } });
  });

  it('the first run is today if the hour has not passed, else the next day it applies', () => {
    expect(firstRunAt('10:30', { every: 1 }, WEDNESDAY_10_LIMA).toISOString()).toBe('2026-10-28T15:30:00.000Z');
    expect(firstRunAt('09:00', { every: 1 }, WEDNESDAY_10_LIMA).toISOString()).toBe('2026-10-29T14:00:00.000Z');
    // Only on Mondays: the next one is 2/11.
    expect(firstRunAt('09:00', { weekdays: [1] }, WEDNESDAY_10_LIMA).toISOString()).toBe('2026-11-02T14:00:00.000Z');
  });

  it('runs up to 30 minutes late; later than that it is missed and the creator is told', () => {
    const slot = new Date('2026-10-28T15:30:00Z');
    expect(scheduleDecision(slot, new Date('2026-10-28T15:30:05Z'))).toBe('run');
    expect(scheduleDecision(slot, new Date('2026-10-28T16:00:00Z'))).toBe('run');
    expect(scheduleDecision(slot, new Date('2026-10-28T16:00:01Z'))).toBe('missed');
  });
});

describe('where it may run', () => {
  it('only read commands; amounts only in the creator\'s 1:1 with the app', () => {
    expect(schedulePlaceProblem(commands[0], 'channel')).toBeNull();
    expect(schedulePlaceProblem(commands[2], 'direct')).toBe('/marcar no se puede programar: solo se programan consultas.');
    expect(schedulePlaceProblem(commands[1], 'channel')).toBe('/planilla tiene montos: solo se programa en tu chat con la app.');
    expect(schedulePlaceProblem(commands[1], 'direct')).toBeNull();
  });
});

describe('what the admin sends to create one', () => {
  it('a command, the hour, the days and where; the text is trimmed', () => {
    expect(validateScheduleInput({ command: 'asistencia', text: '  ayer ', time: '10:30', repeat: { weekdays: [1, 3] }, chat_id: 'direct', only_if_something: true })).toEqual({
      ok: true,
      input: { command: 'asistencia', text: 'ayer', time: '10:30', repeat: { weekdays: [1, 3] }, place: 'direct', onlyIfSomething: true },
    });
    expect(validateScheduleInput({ command: 'asistencia', time: '10:30', repeat: { every: 1 }, chat_id: '6ad8b0cb30ce97957f4acc04' })).toMatchObject({ ok: true, input: { place: { chatId: '6ad8b0cb30ce97957f4acc04' }, onlyIfSomething: false, text: '' } });
  });

  it('says what is missing', () => {
    const fails = (raw: unknown) => {
      const checked = validateScheduleInput(raw);
      return checked.ok ? '' : checked.message;
    };
    expect(fails({ time: '10:30', repeat: { every: 1 }, chat_id: 'direct' })).toBe('Elige el comando.');
    expect(fails({ command: 'asistencia', time: '7:5', repeat: { every: 1 }, chat_id: 'direct' })).toBe('La hora va como HH:mm, de 00:00 a 23:59.');
    expect(fails({ command: 'asistencia', time: '07:05', repeat: {}, chat_id: 'direct' })).toBe('Elige los días: todos, cada N días o algunos días de la semana.');
    expect(fails({ command: 'asistencia', time: '07:05', repeat: { every: 1 }, chat_id: 'planta' })).toBe('Elige el canal o tu chat con la app.');
  });
});

describe('the line of a schedule', () => {
  it('hour, days, where and «solo si hay algo»', () => {
    expect(scheduleLine({ time: '10:30', repeat: { weekdays: [1, 2, 3, 4, 5, 6] }, onlyIfSomething: false }, '# planta-asfalto')).toBe('10:30 · lunes a sábado · # planta-asfalto');
    expect(scheduleLine({ time: '07:00', repeat: { every: 1 }, onlyIfSomething: true }, 'Tu chat con la app')).toBe('07:00 · todos los días · Tu chat con la app · solo si hay algo');
    expect(scheduleLine({ time: '07:00', repeat: { weekdays: [1, 2, 3, 4, 5] }, onlyIfSomething: false }, '# flota')).toBe('07:00 · lunes a viernes · # flota');
    expect(scheduleLine({ time: '07:00', repeat: { weekdays: [1, 3, 5] }, onlyIfSomething: false }, '# flota')).toBe('07:00 · lun, mié y vie · # flota');
    expect(scheduleLine({ time: '07:00', repeat: { every: 2 }, onlyIfSomething: false }, '# flota')).toBe('07:00 · cada 2 días · # flota');
    expect(scheduleLine({ time: '07:00', repeat: { weekdays: [1, 2, 3, 4, 5, 6] }, onlyIfSomething: true }, '')).toBe('07:00 · lunes a sábado · solo si hay algo');
  });
});

describe('when a schedule did not run', () => {
  it('the creator reads which one and why', () => {
    expect(scheduleNotRunText('asistencia', '10:30', 'Lilachat no estaba disponible a esa hora.')).toBe('El horario de /asistencia de las 10:30 no corrió: Lilachat no estaba disponible a esa hora.');
  });
});

describe('«No corrió» in «Horarios» (design d-03)', () => {
  it('a failed, missed or refused run says the Lima day and why; a posted or quiet one says nothing', () => {
    // Arrange
    const at = '2026-10-28T03:30:00.000Z';
    // Act
    const failed = lastRunProblem({ scheduledFor: at, at, outcome: 'failed', message: 'La app no respondió.' });
    const missed = lastRunProblem({ scheduledFor: '2026-10-27T15:30:00.000Z', at, outcome: 'missed' });
    // Assert
    expect(failed).toBe('No corrió el 27/10: la app no respondió');
    expect(missed).toBe('No corrió el 27/10: Lilachat no estaba disponible a esa hora');
    expect(lastRunProblem({ scheduledFor: at, at, outcome: 'posted' })).toBeNull();
    expect(lastRunProblem({ scheduledFor: at, at, outcome: 'nothing' })).toBeNull();
    expect(lastRunProblem(undefined)).toBeNull();
  });
});

describe('the days of «Programar» (design d-02)', () => {
  it('reads a repeat as weekdays and writes the picked days back; all seven is every day; none is no repeat', () => {
    expect(weekdaysOf({ every: 1 })).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(weekdaysOf({ weekdays: [1, 3] })).toEqual([1, 3]);
    expect(repeatOfDays([6, 1, 2, 3, 4, 5])).toEqual({ weekdays: [1, 2, 3, 4, 5, 6] });
    expect(repeatOfDays([0, 1, 2, 3, 4, 5, 6])).toEqual({ every: 1 });
    expect(repeatOfDays([])).toBeNull();
  });

  it('where it posts, as the list says it', () => {
    expect(scheduleWhere({ kind: 'channel', chatId: 'c1', name: 'planta-asfalto' })).toBe('# planta-asfalto');
    expect(scheduleWhere({ kind: 'direct' })).toBe('tu chat con la app');
  });
});

describe('what «Programar» sends', () => {
  it('the wire body the server validates back into the same schedule', () => {
    // Arrange
    const input = { command: 'asistencia', text: 'hoy', time: '10:30', repeat: { weekdays: [1, 2, 3, 4, 5, 6] }, place: { chatId: '6ad8b0cb30ce97957f4acc04' }, onlyIfSomething: true };
    // Act
    const body = scheduleRequestOf(input);
    // Assert
    expect(body).toEqual({ command: 'asistencia', text: 'hoy', time: '10:30', repeat: { weekdays: [1, 2, 3, 4, 5, 6] }, chat_id: '6ad8b0cb30ce97957f4acc04', only_if_something: true });
    expect(validateScheduleInput(body)).toEqual({ ok: true, input });
    expect(scheduleRequestOf({ ...input, place: 'direct' }).chat_id).toBe('direct');
  });
});
