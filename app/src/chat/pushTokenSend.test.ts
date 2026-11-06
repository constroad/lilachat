import { describe, expect, it } from 'vitest';
import { PUSH_TOKEN_RESEND_MS, pushStatusLine, pushTokenSendDue, type SentPushToken } from './pushTokenSend';

const NOW = 1_800_000_000_000;
const SENT: SentPushToken = { token: 'token-a', jwt: 'jwt-a', at: NOW };

describe('pushTokenSendDue', () => {
  it('sends when nothing was sent in this run of the app', () => {
    expect(pushTokenSendDue(null, 'token-a', 'jwt-a', NOW)).toBe(true);
  });

  it('does not send the same token again on each return to the app', () => {
    expect(pushTokenSendDue(SENT, 'token-a', 'jwt-a', NOW + PUSH_TOKEN_RESEND_MS - 1)).toBe(false);
  });

  it('sends at once when Firebase rotated the token', () => {
    expect(pushTokenSendDue(SENT, 'token-b', 'jwt-a', NOW + 1)).toBe(true);
  });

  it('sends at once for another session', () => {
    expect(pushTokenSendDue(SENT, 'token-a', 'jwt-b', NOW + 1)).toBe(true);
  });

  it('sends again once the wait is over, so a row the server lost comes back', () => {
    expect(pushTokenSendDue(SENT, 'token-a', 'jwt-a', NOW + PUSH_TOKEN_RESEND_MS)).toBe(true);
  });
});

describe('pushStatusLine', () => {
  it('says it has not tried yet', () => {
    expect(pushStatusLine(null, NOW)).toBe('Avisos: sin registrar todavía');
  });

  it('says how long ago the token reached the server', () => {
    expect(pushStatusLine({ kind: 'sent', at: NOW - 5 * 60_000 }, NOW)).toBe('Avisos: registrados hace 5 min');
  });

  it('says the permission is off', () => {
    expect(pushStatusLine({ kind: 'denied', at: NOW }, NOW)).toBe('Avisos: sin permiso en este teléfono');
  });

  it('says the server refused it, with the code', () => {
    expect(pushStatusLine({ kind: 'refused', at: NOW, status: 401 }, NOW)).toBe('Avisos: el server no aceptó el registro (401)');
  });

  it('says it could not reach the server', () => {
    expect(pushStatusLine({ kind: 'failed', at: NOW }, NOW)).toBe('Avisos: no se pudo registrar');
  });
});
