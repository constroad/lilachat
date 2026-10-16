import { describe, expect, it } from 'vitest';
import { esHuella, huellaDeBytes, huellaDeTrozos } from './huella.js';

/**
 * La huella es el ÚNICO criterio de deduplicación (spec §6): si se calcula
 * distinto en el teléfono y en el server, cada foto se sube dos veces y nadie
 * se entera. Por eso se fija contra vectores conocidos, no contra sí misma.
 */
const VACIO = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

const bytes = (texto: string) => new TextEncoder().encode(texto);

describe('huellaDeBytes', () => {
  it('coincide con los vectores estándar de sha256', () => {
    expect(huellaDeBytes(new Uint8Array())).toBe(VACIO);
    expect(huellaDeBytes(bytes('abc'))).toBe(ABC);
  });

  it('sale en hexadecimal minúscula de 64 caracteres', () => {
    expect(huellaDeBytes(bytes('lilafotos'))).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('huellaDeTrozos', () => {
  /**
   * Un video de 2 GB no entra en memoria: el teléfono lo lee por partes. La
   * huella de las partes tiene que ser LA MISMA que la del archivo entero, o
   * el server nunca reconoce lo que ya tiene.
   */
  it('en trozos da lo mismo que entera', async () => {
    const entera = huellaDeBytes(bytes('abc'));

    const porTrozos = await huellaDeTrozos([bytes('a'), bytes('b'), bytes('c')]);

    expect(porTrozos).toBe(entera);
  });

  it('acepta un iterable asíncrono, que es como llega un stream', async () => {
    async function* stream() {
      yield bytes('ab');
      yield bytes('c');
    }

    expect(await huellaDeTrozos(stream())).toBe(ABC);
  });

  it('sin trozos es la huella del archivo vacío', async () => {
    expect(await huellaDeTrozos([])).toBe(VACIO);
  });

  it('un trozo vacío en el medio no altera el resultado', async () => {
    expect(await huellaDeTrozos([bytes('ab'), new Uint8Array(), bytes('c')])).toBe(ABC);
  });
});

describe('esHuella', () => {
  /** Lo que manda el teléfono llega por la red: el server lo valida antes de usarlo como clave. */
  it('acepta solo 64 hex minúsculas', () => {
    expect(esHuella(ABC)).toBe(true);
    expect(esHuella(ABC.toUpperCase())).toBe(false);
    expect(esHuella(ABC.slice(0, 63))).toBe(false);
    expect(esHuella(`${ABC}0`)).toBe(false);
    expect(esHuella('')).toBe(false);
  });

  it('rechaza lo que no es string', () => {
    expect(esHuella(null)).toBe(false);
    expect(esHuella(undefined)).toBe(false);
    expect(esHuella(123)).toBe(false);
    expect(esHuella({ huella: ABC })).toBe(false);
  });
});
