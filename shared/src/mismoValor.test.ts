import { describe, expect, it } from 'vitest';
import { mismoValor } from './mismoValor.js';

describe('mismoValor', () => {
  it('objetos y listas anidados con el mismo contenido son iguales', () => {
    expect(mismoValor({ a: 1, b: { c: [1, 'x'] } }, { b: { c: [1, 'x'] }, a: 1 })).toBe(true);
  });

  it('un campo distinto, de más o una lista de otro largo no', () => {
    expect(mismoValor({ a: 1 }, { a: 2 })).toBe(false);
    expect(mismoValor({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(mismoValor([1, 2], [1, 2, 3])).toBe(false);
    expect(mismoValor([1], { 0: 1 })).toBe(false);
  });

  it('un campo `undefined` cuenta como ausente: así lo deja JSON', () => {
    expect(mismoValor({ a: 1, b: undefined }, { a: 1 })).toBe(true);
  });

  it('null no es un objeto vacío', () => {
    expect(mismoValor(null, {})).toBe(false);
    expect(mismoValor(null, null)).toBe(true);
  });
});
