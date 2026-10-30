/**
 * Blocked contacts and the app lock (pending 9), like WhatsApp. The
 * texts live here so the phone and the web say the same thing.
 */

/** In my 1:1 with someone I blocked, instead of the composer. */
export const BLOCKED_BY_ME_COMPOSER = 'Bloqueaste a este contacto. Desbloquéalo desde su info para escribirle.';

export const blockConfirmText = (name: string) => `¿Bloquear a ${name}? No podrá llamarte ni escribirte por este chat, y ninguno verá si el otro está en línea. Los grupos en común siguen igual.`;

export const blockActionLabel = (blockedByMe: boolean, name: string) => (blockedByMe ? `Desbloquear a ${name}` : `Bloquear a ${name}`);

export const blockedListEmptyText = 'No bloqueaste a nadie.';

/** How long the phone may stay in the background before Lilachat asks for the fingerprint again. */
export const APP_LOCK_DELAYS = [
  { ms: 0, label: 'Inmediatamente' },
  { ms: 60_000, label: 'Después de 1 minuto' },
  { ms: 30 * 60_000, label: 'Después de 30 minutos' },
] as const;

export const DEFAULT_APP_LOCK_DELAY_MS = 60_000;

/** A stored delay that is not one of the choices falls back to the default. */
export function appLockDelayOf(raw: unknown): number {
  return APP_LOCK_DELAYS.some((delay) => delay.ms === raw) ? (raw as number) : DEFAULT_APP_LOCK_DELAY_MS;
}

/**
 * Whether coming back to the app must show the lock. `hiddenAt` null means it
 * never left (or just started cold): a cold start with the lock on always asks.
 */
export function appLockDue(input: { enabled: boolean; delayMs: number; hiddenAt: number | null; now: number; coldStart?: boolean }): boolean {
  if (!input.enabled) return false;
  if (input.coldStart) return true;
  if (input.hiddenAt === null) return false;
  return input.now - input.hiddenAt >= input.delayMs;
}
