import { describe, expect, it } from 'vitest';
import { ageOn, birthdayCardFor, isBirthdayToday, limaDayKey, limaHour } from './birthdays.js';
import { textoDeAviso } from './avisoDeGrupo.js';

describe('birthdays in chats (pending 17)', () => {
  it('the day and the hour are Lima\'s, whatever the server\'s zone', () => {
    // 04:30 UTC on the 23rd is 23:30 of the 22nd in Lima.
    expect(limaDayKey(new Date('2026-10-23T04:30:00.000Z'))).toBe('2026-10-22');
    expect(limaHour(new Date('2026-10-23T13:00:00.000Z'))).toBe(8);
  });

  it('a birthday is today by day and month; the age only with the year', () => {
    expect(isBirthdayToday({ day: 22, month: 10 }, '2026-10-22')).toBe(true);
    expect(isBirthdayToday({ day: 22, month: 11 }, '2026-10-22')).toBe(false);
    expect(ageOn({ day: 22, month: 10, year: 1997 }, '2026-10-22')).toBe(29);
    expect(ageOn({ day: 22, month: 10 }, '2026-10-22')).toBeUndefined();
  });

  it('the line in the chat names who, and the age when it is known', () => {
    expect(textoDeAviso({ quien: 'Carla', esMio: false, evento: 'cumpleanos', valor: '29' })).toBe('🎂 Hoy cumple Carla · 29 años');
    expect(textoDeAviso({ quien: 'Carla', esMio: false, evento: 'cumpleanos' })).toBe('🎂 Hoy cumple Carla');
    expect(textoDeAviso({ quien: 'Tú', esMio: true, evento: 'cumpleanos' })).toBe('🎂 ¡Hoy es tu cumpleaños! Tus chats lo saben.');
  });

  it('the card shows for today\'s notice of someone else, once', () => {
    // Arrange
    const notice = { seq: 40, at: '2026-10-22T13:05:00.000Z', senderId: 'carla', system: { evento: 'cumpleanos', valor: '29' } };
    // Act / Assert
    expect(birthdayCardFor([notice], { me: 'jose', todayKey: '2026-10-22', seen: () => false })).toEqual({ seq: 40, who: 'carla', age: 29 });
    expect(birthdayCardFor([notice], { me: 'carla', todayKey: '2026-10-22', seen: () => false })).toBeNull();
    expect(birthdayCardFor([notice], { me: 'jose', todayKey: '2026-10-23', seen: () => false })).toBeNull();
    expect(birthdayCardFor([notice], { me: 'jose', todayKey: '2026-10-22', seen: () => true })).toBeNull();
  });

  it('a notice deleted for everyone shows no card', () => {
    // Arrange
    const now = new Date('2026-10-22T20:00:00Z');
    const rows = [{ seq: 9, at: now.toISOString(), senderId: 'ana', deletedAt: '2026-10-22T20:10:00Z', system: { evento: 'cumpleanos', valor: '36' } }];
    // Act / Assert
    expect(birthdayCardFor(rows, { me: 'jose', todayKey: limaDayKey(now), seen: () => false })).toBeNull();
  });
});
