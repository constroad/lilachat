import { describe, expect, it } from 'vitest';
import { formatPhoneDisplay, internalPhoneKey, isRealPhone, normalizePeruPhone, toInternationalPhone } from './phone.js';

describe('normalizePeruPhone', () => {
  it('acepta el celular escrito como sea', () => {
    expect(normalizePeruPhone('902049935')).toBe('902049935');
    expect(normalizePeruPhone('902 049 935')).toBe('902049935');
    expect(normalizePeruPhone('+51 902-049 935')).toBe('902049935');
  });

  /**
   * Los ceros de marcación internacional se sacan ANTES de buscar el código de
   * país. Al revés —como estaba en el motor original de Portal— `0051 9…` nunca
   * se reconocía y quien marca como desde un fijo quedaba afuera sin explicación.
   */
  it('los ceros de marcación internacional no lo rompen', () => {
    expect(normalizePeruPhone('0051902049935')).toBe('902049935');
    expect(normalizePeruPhone('051902049935')).toBe('902049935');
  });

  it('rechaza lo que no es un celular peruano', () => {
    expect(normalizePeruPhone('12345')).toBe('');
    expect(normalizePeruPhone('802049935')).toBe(''); // no empieza en 9
    expect(normalizePeruPhone('')).toBe('');
    expect(normalizePeruPhone({ $ne: '' })).toBe('');
  });
});

describe('toInternationalPhone', () => {
  it('agrega el código de país para el servicio', () => {
    expect(toInternationalPhone('902049935')).toBe('51902049935');
  });

  it('un número inválido no se manda a medias', () => {
    expect(toInternationalPhone('123')).toBe('');
  });
});

describe('formatPhoneDisplay', () => {
  it('se lee en grupos de tres', () => {
    expect(formatPhoneDisplay('902049935')).toBe('902 049 935');
  });

  it('lo que no es número se muestra tal cual, sin inventar formato', () => {
    expect(formatPhoneDisplay('abc')).toBe('abc');
  });
});

describe('internal key of an email account (spec INGRESO-POR-ESPACIO §4)', () => {
  it('is not a real phone, not even when its digits would form one', () => {
    expect(isRealPhone(internalPhoneKey('902049935'))).toBe(false);
    expect(isRealPhone('app:902049935:1')).toBe(false);
    expect(isRealPhone(undefined)).toBe(false);
  });

  it('never normalizes into a number, however its digits fall', () => {
    expect(normalizePeruPhone(internalPhoneKey('9a0b2c0d4e9f9g3h5'))).toBe('');
    expect(toInternationalPhone(internalPhoneKey('902049935'))).toBe('');
  });

  it('a stored phone is a real phone', () => {
    expect(isRealPhone('902049935')).toBe(true);
  });

  it('never shows on screen', () => {
    expect(formatPhoneDisplay(internalPhoneKey('6adbb02ec9d066b069307eb4'))).toBe('');
    expect(formatPhoneDisplay('902049935')).toBe('902 049 935');
  });
});
