import { describe, expect, it } from 'vitest';
import { contactNoteOf, isQuietNow, quietHoursLabel, quietHoursOf, ROUTINE_NOTE_MAX } from './routines.js';

/** Pending 17 (design `automatizaciones`): a chat quiet on a schedule, and a note for the next time I talk to someone. */
describe('quiet hours', () => {
  it('accepts days and a range; refuses anything else', () => {
    expect(quietHoursOf({ days: [1, 2, 3, 4, 5], from: '18:00', to: '08:00', tz: 'America/Lima' })).toEqual({ days: [1, 2, 3, 4, 5], from: '18:00', to: '08:00', tz: 'America/Lima' });
    expect(quietHoursOf({ days: [], from: '18:00', to: '08:00', tz: 'America/Lima' })).toBeNull();
    expect(quietHoursOf({ days: [1, 9], from: '18:00', to: '08:00', tz: 'America/Lima' })).toBeNull();
    expect(quietHoursOf({ days: [1], from: '25:00', to: '08:00', tz: 'America/Lima' })).toBeNull();
    expect(quietHoursOf({ days: [1], from: '08:00', to: '08:00', tz: 'America/Lima' })).toBeNull();
    expect(quietHoursOf({ days: [1], from: '08:00', to: '09:00', tz: 'Nada/Falso' })).toBeNull();
  });

  it('a range inside one day: quiet only within it, on its days, in its zone', () => {
    const office = { days: [1, 2, 3, 4, 5], from: '09:00', to: '13:00', tz: 'America/Lima' };
    // Thursday 29/10/2026 10:00 in Lima = 15:00 UTC.
    expect(isQuietNow(office, new Date('2026-10-29T15:00:00Z'))).toBe(true);
    expect(isQuietNow(office, new Date('2026-10-29T18:00:00Z'))).toBe(false);
    // Saturday 31/10 10:00 in Lima.
    expect(isQuietNow(office, new Date('2026-10-31T15:00:00Z'))).toBe(false);
  });

  it('a range across midnight belongs to the day it starts', () => {
    const night = { days: [5], from: '22:00', to: '07:00', tz: 'America/Lima' };
    // Friday 30/10 23:00 Lima = Saturday 04:00 UTC: quiet.
    expect(isQuietNow(night, new Date('2026-10-31T04:00:00Z'))).toBe(true);
    // Saturday 31/10 06:00 Lima: still Friday's night.
    expect(isQuietNow(night, new Date('2026-10-31T11:00:00Z'))).toBe(true);
    // Saturday 31/10 23:00 Lima: Saturday is not in the days.
    expect(isQuietNow(night, new Date('2026-11-01T04:00:00Z'))).toBe(false);
  });

  it('says it the way the screen shows it', () => {
    expect(quietHoursLabel({ days: [1, 2, 3, 4, 5], from: '18:00', to: '08:00', tz: 'America/Lima' })).toBe('Lun a vie · 18:00–08:00');
    expect(quietHoursLabel({ days: [0, 1, 2, 3, 4, 5, 6], from: '22:00', to: '07:00', tz: 'America/Lima' })).toBe('Todos los días · 22:00–07:00');
    expect(quietHoursLabel({ days: [0, 6], from: '00:00', to: '23:59', tz: 'America/Lima' })).toBe('Sáb y dom · 00:00–23:59');
    expect(quietHoursLabel({ days: [1, 3], from: '12:00', to: '14:00', tz: 'America/Lima' })).toBe('Lun, mié · 12:00–14:00');
  });
});

describe('contact note', () => {
  it('trims, refuses empty, caps the length', () => {
    expect(contactNoteOf({ text: '  Preguntarle por la factura  ' })).toEqual({ text: 'Preguntarle por la factura' });
    expect(contactNoteOf({ text: '   ' })).toBeNull();
    expect(contactNoteOf({ text: 'x'.repeat(ROUTINE_NOTE_MAX + 1) })).toBeNull();
    expect(contactNoteOf('hola')).toBeNull();
  });
});
