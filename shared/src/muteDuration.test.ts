import { describe, expect, it } from 'vitest';
import { isMuteFor, isMutedNow, MUTE_OPTIONS, mutedUntilFor, mutedUntilText } from './muteDuration.js';
import { notificationLevel } from './menciones.js';

const NOW = new Date('2026-10-31T15:00:00.000Z');

/** Mute for 8 hours, 1 week or always, like WhatsApp (R31/10; §66 left it pending). */
describe('mutedUntilFor', () => {
  it('8 horas and 1 semana end at a time; siempre has no end', () => {
    expect(mutedUntilFor('8h', NOW)?.toISOString()).toBe('2026-10-31T23:00:00.000Z');
    expect(mutedUntilFor('1w', NOW)?.toISOString()).toBe('2026-11-07T15:00:00.000Z');
    expect(mutedUntilFor('always', NOW)).toBeNull();
  });

  it('the three options, in WhatsApp\'s order; anything else is not a duration', () => {
    expect(MUTE_OPTIONS.map((option) => option.label)).toEqual(['8 horas', '1 semana', 'Siempre']);
    expect(isMuteFor('8h')).toBe(true);
    expect(isMuteFor('1y')).toBe(false);
    expect(isMuteFor(undefined)).toBe(false);
  });
});

describe('isMutedNow', () => {
  it('muted with no end stays muted; with an end, only until it', () => {
    expect(isMutedNow({ muted: true }, NOW)).toBe(true);
    expect(isMutedNow({ muted: true, mutedUntil: '2026-10-31T15:00:01.000Z' }, NOW)).toBe(true);
    expect(isMutedNow({ muted: true, mutedUntil: '2026-10-31T15:00:00.000Z' }, NOW)).toBe(false);
    expect(isMutedNow({ muted: true, mutedUntil: new Date('2026-10-30T00:00:00.000Z') }, NOW)).toBe(false);
  });

  it('not muted is never muted, whatever the end says; a broken end counts as no end', () => {
    expect(isMutedNow({}, NOW)).toBe(false);
    expect(isMutedNow({ muted: false, mutedUntil: '2026-12-01T00:00:00.000Z' }, NOW)).toBe(false);
    expect(isMutedNow({ muted: true, mutedUntil: 'mañana' }, NOW)).toBe(true);
  });

  it('an expired silence rings again: the level is «todo», even with «nada»', () => {
    expect(notificationLevel({ muted: true, avisos: 'nada', mutedUntil: '2026-10-31T14:00:00.000Z' }, NOW)).toBe('todo');
    expect(notificationLevel({ muted: true, mutedUntil: '2026-10-31T16:00:00.000Z' }, NOW)).toBe('menciones');
  });
});

describe('mutedUntilText', () => {
  it('today says the hour, another day says the date, and no end says nothing more', () => {
    const lima = 'America/Lima';
    expect(mutedUntilText('2026-10-31T23:00:00.000Z', NOW, lima)).toBe('Silenciado hasta las 18:00');
    expect(mutedUntilText('2026-11-07T15:00:00.000Z', NOW, lima)).toBe('Silenciado hasta el 7 nov.');
    expect(mutedUntilText(null, NOW, lima)).toBe('Silenciado');
  });
});
