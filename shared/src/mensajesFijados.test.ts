import { describe, expect, it } from 'vitest';
import { agregarFijado, fijadosVigentes, MAXIMO_DE_FIJADOS, puedeFijarEnElChat, venceDelFijado } from './mensajesFijados.js';

const AHORA = Date.parse('2026-10-19T12:00:00.000Z');
const fijado = (seq: number, horasAtras: number, horasQueQuedan: number) => ({
  seq,
  por: '6650f1c2a3b4c5d6e7f80911',
  en: new Date(AHORA - horasAtras * 3_600_000).toISOString(),
  hasta: new Date(AHORA + horasQueQuedan * 3_600_000).toISOString(),
});

describe('venceDelFijado', () => {
  it('24 horas, 7 días o 30 días desde ahora; otra cosa no vale', () => {
    expect(venceDelFijado('24h', AHORA)).toBe('2026-10-20T12:00:00.000Z');
    expect(venceDelFijado('7d', AHORA)).toBe('2026-10-26T12:00:00.000Z');
    expect(venceDelFijado('30d', AHORA)).toBe('2026-11-18T12:00:00.000Z');
    expect(venceDelFijado('1y', AHORA)).toBeNull();
  });
});

describe('fijadosVigentes', () => {
  it('saca los vencidos y deja el último fijado primero', () => {
    const lista = [fijado(3, 5, 10), fijado(7, 1, 10), fijado(9, 30, -1)];
    expect(fijadosVigentes(lista, AHORA).map((uno) => uno.seq)).toEqual([7, 3]);
  });

  it('sin lista, vacío', () => {
    expect(fijadosVigentes(undefined, AHORA)).toEqual([]);
  });
});

describe('agregarFijado', () => {
  it('hasta 3: el cuarto saca al fijado hace más tiempo, como WhatsApp', () => {
    const lista = [fijado(1, 3, 10), fijado(2, 2, 10), fijado(3, 1, 10)];
    const nueva = agregarFijado(lista, fijado(4, 0, 24), AHORA);
    expect(nueva.map((uno) => uno.seq)).toEqual([4, 3, 2]);
    expect(nueva).toHaveLength(MAXIMO_DE_FIJADOS);
  });

  it('volver a fijar el mismo mensaje renueva su plazo sin duplicarlo', () => {
    const nueva = agregarFijado([fijado(5, 3, 1)], fijado(5, 0, 720), AHORA);
    expect(nueva).toHaveLength(1);
    expect(nueva[0]?.hasta).toBe(new Date(AHORA + 720 * 3_600_000).toISOString());
  });

  it('los vencidos no ocupan lugar', () => {
    const nueva = agregarFijado([fijado(1, 50, -2), fijado(2, 2, 10)], fijado(3, 0, 24), AHORA);
    expect(nueva.map((uno) => uno.seq)).toEqual([3, 2]);
  });
});

describe('puedeFijarEnElChat', () => {
  it('en un 1:1 y en un borrador, cualquiera; en un grupo, solo los admins', () => {
    expect(puedeFijarEnElChat({ kind: 'direct', esAdmin: false })).toBe(true);
    expect(puedeFijarEnElChat({ kind: 'notas', esAdmin: false })).toBe(true);
    expect(puedeFijarEnElChat({ kind: 'group', esAdmin: true })).toBe(true);
    expect(puedeFijarEnElChat({ kind: 'group', esAdmin: false })).toBe(false);
  });
});
