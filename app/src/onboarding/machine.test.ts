import { describe, expect, it } from 'vitest';
import {
  countdownLabel,
  credentialOfSignIn,
  isCompleteOtp,
  mapVerifyFailure,
  normalizeEmailInput,
  shouldAutoSubmitOtp,
} from './machine';

describe('normalizeEmailInput', () => {
  it('normaliza igual que el server (trim + minúsculas)', () => {
    expect(normalizeEmailInput('  Papa@Gmail.com ')).toBe('papa@gmail.com');
  });

  it('rechaza lo que no es email, incluidos no-strings', () => {
    expect(normalizeEmailInput('sin-arroba')).toBe('');
    expect(normalizeEmailInput(undefined)).toBe('');
  });
});

describe('auto-submit del OTP', () => {
  it('con el sexto dígito se envía solo', () => {
    expect(shouldAutoSubmitOtp('12345', '123456')).toBe(true);
  });

  it('no re-envía si ya estaba completo (editar un dígito)', () => {
    expect(shouldAutoSubmitOtp('123456', '123457')).toBe(false);
  });

  it('letras o menos de 6 dígitos no completan', () => {
    expect(isCompleteOtp('12a456')).toBe(false);
    expect(isCompleteOtp('12345')).toBe(false);
  });
});

describe('mapVerifyFailure', () => {
  it('401: muestra el mensaje genérico del server tal cual', () => {
    expect(mapVerifyFailure(401, 'Ese código no es correcto o ya venció. Pide uno nuevo.')).toContain(
      'no es correcto'
    );
  });

  /** La ausencia de respuesta NO es un rechazo: el texto invita a reintentar. */
  it('503 y sin-red: reintentables, nunca suenan a rechazo', () => {
    expect(mapVerifyFailure(503)).toMatch(/inténtalo/i);
    expect(mapVerifyFailure('network')).toMatch(/conexión|internet/i);
    expect(mapVerifyFailure(503)).not.toMatch(/no es correcto|venció/i);
  });
});

describe('credentialOfSignIn', () => {
  it('keeps the key an email account has in `phone`, and a missing photo is null', () => {
    const credential = credentialOfSignIn({ deviceSecret: 's', jwt: 'j', user: { id: 'u1', name: null, phone: 'mail:abc' } }, 'd1');
    expect(credential).toEqual({ userId: 'u1', deviceId: 'd1', deviceSecret: 's', jwt: 'j', phone: 'mail:abc', name: null, avatarUrl: null });
  });
});

describe('countdownLabel', () => {
  it('writes minutes and two digits of seconds', () => {
    expect(countdownLabel(42)).toBe('0:42');
    expect(countdownLabel(60)).toBe('1:00');
    expect(countdownLabel(5)).toBe('0:05');
  });
});
