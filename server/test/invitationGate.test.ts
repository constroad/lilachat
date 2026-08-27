import { describe, expect, it } from 'vitest';
import {
  GENERIC_OTP_RESPONSE,
  decideOtpRequest,
  normalizeEmail,
} from '../src/invitationGate.js';

/**
 * El gate es NUESTRO (spec §5.1): constroad-auth le manda el código a
 * cualquiera que lo pida, así que quien decide si se pide es Lilachat.
 */
describe('normalizeEmail', () => {
  it('recorta, baja a minúsculas y coerciona a string', () => {
    expect(normalizeEmail('  Papa@Gmail.com ')).toBe('papa@gmail.com');
    expect(normalizeEmail(42 as unknown as string)).toBe('');
    expect(normalizeEmail({ $ne: '' } as unknown as string)).toBe('');
  });

  it('rechaza lo que no tiene forma de email', () => {
    expect(normalizeEmail('sin-arroba')).toBe('');
    expect(normalizeEmail('')).toBe('');
  });
});

describe('decideOtpRequest', () => {
  it('invitado → se pide el código de verdad', () => {
    expect(decideOtpRequest({ invited: true })).toBe('forward');
  });

  /**
   * NO invitado → se FINGE: misma respuesta, cero llamadas al servicio. Decirle
   * «no estás en la lista» le confirma a un extraño quién sí está; y llamar
   * igual al servicio le gasta SMTP a cualquiera con un gmail.
   */
  it('no invitado → se finge, nunca se llama al servicio', () => {
    expect(decideOtpRequest({ invited: false })).toBe('pretend');
  });

  it('la respuesta genérica no afirma ni niega membresía', () => {
    expect(GENERIC_OTP_RESPONSE.message).not.toMatch(/lista|invitad|registrad[oa]\b/i);
  });
});

/**
 * Registro ABIERTO (26/08/2026, decisión de José).
 *
 * Lilachat y LilaStore pasaron a ser públicas: cualquiera puede entrar. El gate
 * de admisión dejaba afuera justo a la familia que se quería adentro — Wilson
 * instaló la app y nunca recibió un código.
 *
 * La rama cerrada NO se borra: es un interruptor, y estos tests siguen fijando
 * qué pasa de cada lado.
 */
describe('decideOtpRequest — registro abierto', () => {
  it('con el registro abierto, a cualquiera se le manda', () => {
    expect(decideOtpRequest({ invited: false, registroAbierto: true })).toBe('forward');
  });

  it('un invitado sigue recibiendo, obviamente', () => {
    expect(decideOtpRequest({ invited: true, registroAbierto: true })).toBe('forward');
  });

  /** Cerrado, todo sigue como antes: el extraño no dispara ni un envío. */
  it('cerrado, al extraño se le finge', () => {
    expect(decideOtpRequest({ invited: false, registroAbierto: false })).toBe('pretend');
  });

  /** Sin el interruptor se comporta como siempre: cerrado por omisión. */
  it('sin decir nada, queda cerrado', () => {
    expect(decideOtpRequest({ invited: false })).toBe('pretend');
  });
});
