import { describe, expect, it } from 'vitest';
import { birthdayFieldError, birthdayFromFields, birthdayLabel, canFinishProfile, profileGateAfter, profileGateNow, profileCompleteKey, normalizeEmail, profileMissing, validateBirthday } from './profile.js';

const NOW = new Date('2026-10-21T15:00:00Z');

/** José, 21/10: name, birthday and a verified email are mandatory to sign up (backlog 17). */
describe('profile', () => {
  it('a birthday with or without its year', () => {
    expect(validateBirthday({ day: 29, month: 8 }, NOW)).toEqual({ ok: true, birthday: { day: 29, month: 8 } });
    expect(validateBirthday({ day: 29, month: 8, year: 1990 }, NOW)).toEqual({ ok: true, birthday: { day: 29, month: 8, year: 1990 } });
  });

  it('a day the month does not have, or a year out of range, is refused', () => {
    expect(validateBirthday({ day: 31, month: 4 }, NOW).ok).toBe(false);
    expect(validateBirthday({ day: 30, month: 2 }, NOW).ok).toBe(false);
    expect(validateBirthday({ day: 29, month: 2, year: 2023 }, NOW).ok).toBe(false);
    expect(validateBirthday({ day: 29, month: 2, year: 2024 }, NOW).ok).toBe(true);
    expect(validateBirthday({ day: 29, month: 2 }, NOW).ok).toBe(true);
    expect(validateBirthday({ day: 1, month: 1, year: 1899 }, NOW).ok).toBe(false);
    expect(validateBirthday({ day: 1, month: 1, year: 2027 }, NOW).ok).toBe(false);
    expect(validateBirthday({ day: 0, month: 13 }, NOW).ok).toBe(false);
  });

  it('an email, trimmed and lowercased; one without a domain is not', () => {
    expect(normalizeEmail('  Jose.Zamora@Gmail.COM ')).toBe('jose.zamora@gmail.com');
    expect(normalizeEmail('jose@')).toBe('');
    expect(normalizeEmail('jose zamora@gmail.com')).toBe('');
  });

  it('what is missing, in the order the screen asks for it', () => {
    expect(profileMissing({})).toEqual(['name', 'birthday', 'email']);
    expect(profileMissing({ name: 'José', birthday: { day: 29, month: 8 }, emailVerified: false })).toEqual(['email']);
    expect(profileMissing({ name: ' ', birthday: { day: 29, month: 8 }, emailVerified: true })).toEqual(['name']);
    expect(profileMissing({ name: 'José', birthday: { day: 29, month: 8 }, emailVerified: true })).toEqual([]);
  });

  it('the birthday as people say it', () => {
    expect(birthdayLabel({ day: 29, month: 8 })).toBe('29 de agosto');
  });
});

describe('complete profile screen', () => {
  it('the three boxes make a birthday; the year can stay empty', () => {
    expect(birthdayFromFields({ day: '29', month: '8', year: '' }, NOW)).toEqual({ ok: true, birthday: { day: 29, month: 8 } });
    expect(birthdayFromFields({ day: '05', month: '03', year: '1990' }, NOW)).toEqual({ ok: true, birthday: { day: 5, month: 3, year: 1990 } });
  });

  it('the error shows once day and month are typed, not for empty boxes', () => {
    expect(birthdayFieldError({ day: '', month: '', year: '' }, NOW)).toBeNull();
    expect(birthdayFieldError({ day: '31', month: '', year: '' }, NOW)).toBeNull();
    expect(birthdayFieldError({ day: '31', month: '4', year: '' }, NOW)).toBe('Ese día no existe en ese mes.');
    expect(birthdayFieldError({ day: '29', month: '8', year: '' }, NOW)).toBeNull();
  });

  it('finishing needs a name, a valid birthday and the email proved', () => {
    expect(canFinishProfile({ name: 'Ana', birthdayOk: true, emailVerified: true })).toBe(true);
    expect(canFinishProfile({ name: '  ', birthdayOk: true, emailVerified: true })).toBe(false);
    expect(canFinishProfile({ name: 'Ana', birthdayOk: false, emailVerified: true })).toBe(false);
    expect(canFinishProfile({ name: 'Ana', birthdayOk: true, emailVerified: false })).toBe(false);
  });
});

/** 22/10: the gate showed the chats for an instant and then the form; whoever completed it waited for nothing. */
describe('profile gate', () => {
  const profile = { name: 'Ana', phone: '987654321', avatarUrl: null, email: null, emailVerified: false, birthday: null, birthdayVisible: true, missing: ['birthday' as const, 'email' as const] };

  it('before the answer: someone this device saw complete opens at once; anyone else waits, unless offline or past the limit', () => {
    const before = { answer: null, knownComplete: false, offline: false, gaveUp: false };
    expect(profileGateNow(before)).toEqual({ status: 'checking' });
    expect(profileGateNow({ ...before, knownComplete: true })).toEqual({ status: 'open' });
    expect(profileGateNow({ ...before, offline: true })).toEqual({ status: 'open' });
    expect(profileGateNow({ ...before, gaveUp: true })).toEqual({ status: 'open' });
  });

  it('the answer wins over what the device remembered', () => {
    expect(profileGateNow({ answer: { status: 'blocked', profile }, knownComplete: true, offline: false, gaveUp: true })).toEqual({ status: 'blocked', profile });
  });

  it('the answer decides; without one (no network, an older server) nothing is blocked', () => {
    expect(profileGateAfter({ ok: true, profile })).toEqual({ status: 'blocked', profile });
    expect(profileGateAfter({ ok: true, profile: { ...profile, missing: [] } })).toEqual({ status: 'open' });
    expect(profileGateAfter({ ok: true })).toEqual({ status: 'open' });
    expect(profileGateAfter({ ok: false })).toEqual({ status: 'open' });
  });

  it('remembered per person, not per device', () => {
    expect(profileCompleteKey('u1')).not.toBe(profileCompleteKey('u2'));
  });
});
