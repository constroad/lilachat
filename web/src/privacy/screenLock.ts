/**
 * The web's «Bloqueo de pantalla», like WhatsApp Web (R31/10; debt of §163:
 * the app had a lock and the web did not). The password never leaves this browser
 * and is kept only as a salted PBKDF2 hash, per person. It guards the screen
 * from whoever sits at an unattended computer; it is not encryption of the
 * data (the same promise WhatsApp Web makes).
 */
export const LOCK_AFTER_MINUTES = [1, 15, 60] as const;
export type LockAfter = (typeof LOCK_AFTER_MINUTES)[number];
export const LOCK_AFTER_LABEL: Record<LockAfter, string> = { 1: '1 minuto', 15: '15 minutos', 60: '1 hora' };
export const PASSWORD_MIN = 6;

export type ScreenLock = { salt: string; hash: string; afterMinutes: LockAfter };

const STORAGE_PREFIX = 'lilachat.screenLock.';
const PBKDF2_ITERATIONS = 150_000;
const HASH_BITS = 256;
const SALT_BYTES = 16;
const MINUTE_MS = 60_000;
/** Told to the gate in this tab when the lock is created, changed or removed. */
export const LOCK_CHANGED_EVENT = 'lilachat:screen-lock-changed';
/** «Bloquear ahora». */
export const LOCK_NOW_EVENT = 'lilachat:screen-lock-now';

export function newPasswordError(password: string, confirmation: string): string | null {
  if (password.trim().length < PASSWORD_MIN) return `Usa al menos ${PASSWORD_MIN} caracteres.`;
  if (password !== confirmation) return 'Las contraseñas no coinciden.';
  return null;
}

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

async function hashPassword(password: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, HASH_BITS);
  return toBase64(new Uint8Array(bits));
}

export async function createLock(password: string, afterMinutes: LockAfter): Promise<ScreenLock> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return { salt: toBase64(salt), hash: await hashPassword(password, salt), afterMinutes };
}

export async function passwordMatches(lock: ScreenLock, password: string): Promise<boolean> {
  return (await hashPassword(password, fromBase64(lock.salt))) === lock.hash;
}

export const isIdleTooLong = (lastActivityAt: number, now: number, afterMinutes: LockAfter): boolean => now - lastActivityAt >= afterMinutes * MINUTE_MS;

const isLock = (value: unknown): value is ScreenLock => {
  const lock = value as Partial<ScreenLock> | null;
  return typeof lock?.salt === 'string' && typeof lock.hash === 'string' && LOCK_AFTER_MINUTES.includes(lock.afterMinutes as LockAfter);
};

export function readLock(userId: string): ScreenLock | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_PREFIX + userId) ?? 'null');
    return isLock(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function saveLock(userId: string, lock: ScreenLock | null): void {
  try {
    if (lock) localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(lock));
    else localStorage.removeItem(STORAGE_PREFIX + userId);
  } catch (error) {
    console.warn('[bloqueo] no se pudo guardar:', error instanceof Error ? error.message : error);
  }
  window.dispatchEvent(new Event(LOCK_CHANGED_EVENT));
}
