import { describe, expect, it } from 'vitest';
import { decideInstall, installMessage } from './installDecision';

const HASH = 'a'.repeat(64);
const OTRO = 'b'.repeat(64);

describe('decideInstall — instala', () => {
  it('cuando el hash del archivo es el que declaró el catálogo', () => {
    expect(decideInstall({ expected: HASH, actual: HASH })).toEqual({ install: true });
  });

  it('sin importar mayúsculas ni espacios alrededor', () => {
    // El CLI puede mandarlo en mayúsculas; el server lo guarda en minúsculas.
    expect(decideInstall({ expected: HASH.toUpperCase(), actual: ` ${HASH} ` }).install).toBe(true);
  });

  it('cuando el tamaño también coincide', () => {
    const v = decideInstall({ expected: HASH, actual: HASH, expectedSize: 100, actualSize: 100 });
    expect(v.install).toBe(true);
  });
});

describe('decideInstall — NO instala', () => {
  it('cuando el hash no coincide', () => {
    expect(decideInstall({ expected: HASH, actual: OTRO })).toEqual({
      install: false,
      reason: 'bad-hash',
    });
  });

  it('cuando el catálogo no trajo hash: se falla CERRADO', () => {
    // Al revés que la compuerta de versión. Sin hash no hay verificación
    // posible, y sin verificación no se le entrega un binario al sistema.
    for (const sin of [undefined, null, '', 'no-es-un-hash', 123]) {
      expect(decideInstall({ expected: sin, actual: HASH })).toEqual({
        install: false,
        reason: 'no-expected-hash',
      });
    }
  });

  it('cuando no se pudo calcular el hash del archivo', () => {
    expect(decideInstall({ expected: HASH, actual: null })).toEqual({
      install: false,
      reason: 'unreadable-hash',
    });
  });

  it('un hash de 63 caracteres no pasa por válido', () => {
    expect(decideInstall({ expected: 'a'.repeat(63), actual: HASH }).install).toBe(false);
  });

  it('cuando el tamaño no coincide, aunque el hash sí', () => {
    // No debería poder pasar; si pasa, algo está mal y no se instala.
    const v = decideInstall({ expected: HASH, actual: HASH, expectedSize: 100, actualSize: 40 });
    expect(v).toEqual({ install: false, reason: 'wrong-size' });
  });

  it('el tamaño se evalúa antes que el hash, para dar el motivo útil', () => {
    const v = decideInstall({ expected: HASH, actual: OTRO, expectedSize: 100, actualSize: 40 });
    expect(v).toEqual({ install: false, reason: 'wrong-size' });
  });
});

describe('installMessage', () => {
  it('la descarga cortada se explica como lo que es', () => {
    const v = decideInstall({ expected: HASH, actual: HASH, expectedSize: 1, actualSize: 2 });
    expect(installMessage(v)).toMatch(/incompleta/);
  });

  it('un hash distinto no culpa a la señal', () => {
    expect(installMessage(decideInstall({ expected: HASH, actual: OTRO }))).toMatch(/no coincide/);
  });

  it('cuando se instala no hay nada que decir', () => {
    expect(installMessage({ install: true })).toBeNull();
  });
});
