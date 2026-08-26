import { describe, expect, it } from 'vitest';
import { validarInvitacion } from './invitacion.js';

/**
 * Invitar tiene que ADMITIR, no solo compartir un enlace.
 *
 * El 26/08/2026 Wilson instaló Lilachat y no pudo entrar: ni por WhatsApp ni por
 * correo le llegaba el código. La causa no era el envío — el server **no manda
 * nada** a un número que no tenga una admisión previa, y contesta 200 igual para
 * no revelar quién existe (anti-enumeración, deliberado).
 *
 * El botón «Invitar» compartía el enlace de descarga y **nunca creaba la
 * invitación**. La persona instalaba la app y quedaba afuera para siempre, sin
 * que el sistema pudiera decirle por qué.
 */
describe('validarInvitacion', () => {
  it('un celular peruano se acepta, normalizado', () => {
    expect(validarInvitacion({ telefono: '+51 999 111 222', yoSoy: '999000111' })).toEqual({
      ok: true,
      phone: '999111222',
    });
  });

  it('el formato de la agenda no importa', () => {
    expect(validarInvitacion({ telefono: '999-111-222', yoSoy: '999000111' })).toEqual({
      ok: true,
      phone: '999111222',
    });
  });

  it('algo que no es un celular se rechaza', () => {
    expect(validarInvitacion({ telefono: 'no soy un número', yoSoy: '999000111' }).ok).toBe(false);
  });

  it('vacío se rechaza', () => {
    expect(validarInvitacion({ telefono: '', yoSoy: '999000111' }).ok).toBe(false);
  });

  /**
   * Invitarse a uno mismo no crea nada útil y sí crea una fila rara: quien ya
   * está adentro no necesita admisión.
   */
  it('no me puedo invitar a mí mismo', () => {
    const salida = validarInvitacion({ telefono: '+51999000111', yoSoy: '999000111' });

    expect(salida.ok).toBe(false);
    expect(salida.ok === false && salida.motivo).toMatch(/tuyo|mismo/i);
  });

  /**
   * Un fijo de Lima (7 dígitos) no puede recibir WhatsApp ni entrar: aceptarlo
   * crearía una admisión que nunca va a servir para nada.
   */
  it('un número que no es celular se rechaza', () => {
    expect(validarInvitacion({ telefono: '014567890', yoSoy: '999000111' }).ok).toBe(false);
  });
});
