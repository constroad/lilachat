import { beforeEach, describe, expect, it } from 'vitest';
import { createLock, isIdleTooLong, LOCK_AFTER_MINUTES, newPasswordError, passwordMatches, readLock, saveLock } from './screenLock';

/** The web's «Bloqueo de pantalla», like WhatsApp Web (R31/10; debt of §163). */
describe('newPasswordError', () => {
  it('asks for at least 6 characters and the same password twice', () => {
    expect(newPasswordError('12345', '12345')).toBe('Usa al menos 6 caracteres.');
    expect(newPasswordError('obra2026', 'obra2025')).toBe('Las contraseñas no coinciden.');
    expect(newPasswordError('obra2026', 'obra2026')).toBeNull();
  });

  it('spaces at the ends do not count toward the length', () => {
    expect(newPasswordError('  abc  ', '  abc  ')).toBe('Usa al menos 6 caracteres.');
  });
});

describe('createLock and passwordMatches', () => {
  it('keeps a salted hash, never the password, and only the right one opens', async () => {
    // Arrange / Act
    const lock = await createLock('obra2026', 15);
    // Assert
    expect(JSON.stringify(lock)).not.toContain('obra2026');
    expect(lock.afterMinutes).toBe(15);
    await expect(passwordMatches(lock, 'obra2026')).resolves.toBe(true);
    await expect(passwordMatches(lock, 'obra2025')).resolves.toBe(false);
  });

  it('the same password gives a different hash each time (its own salt)', async () => {
    const [a, b] = await Promise.all([createLock('obra2026', 1), createLock('obra2026', 1)]);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('isIdleTooLong', () => {
  it('locks once the chosen minutes pass without activity, not before', () => {
    expect(LOCK_AFTER_MINUTES).toEqual([1, 15, 60]);
    expect(isIdleTooLong(0, 59_999, 1)).toBe(false);
    expect(isIdleTooLong(0, 60_000, 1)).toBe(true);
    expect(isIdleTooLong(0, 15 * 60_000 - 1, 15)).toBe(false);
  });
});

describe('readLock and saveLock', () => {
  beforeEach(() => localStorage.clear());

  it('each person on this browser has their own lock', async () => {
    // Arrange
    const lock = await createLock('obra2026', 60);
    // Act
    saveLock('jose', lock);
    // Assert
    expect(readLock('jose')).toEqual(lock);
    expect(readLock('maria')).toBeNull();
    saveLock('jose', null);
    expect(readLock('jose')).toBeNull();
  });

  it('something broken in storage reads as no lock, not as a crash', () => {
    localStorage.setItem('lilachat.screenLock.jose', '{roto');
    expect(readLock('jose')).toBeNull();
    localStorage.setItem('lilachat.screenLock.jose', JSON.stringify({ salt: 'x', hash: 'y', afterMinutes: 7 }));
    expect(readLock('jose')).toBeNull();
  });
});
