import { describe, expect, it } from 'vitest';
import { agregarFijado, esSinVencimiento, fijadosVigentes, MAXIMO_DE_FIJADOS, puedeFijarEnElChat, textoDelVencimiento, venceDelFijado } from './mensajesFijados.js';

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
  it('«sin vencimiento» (20/10, como Slack) queda fijado hasta que alguien lo saque', () => {
    const hasta = venceDelFijado('siempre', AHORA);
    expect(hasta).not.toBeNull();
    expect(esSinVencimiento(hasta!, AHORA)).toBe(true);
    expect(esSinVencimiento(venceDelFijado('30d', AHORA)!, AHORA)).toBe(false);
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
  it('hasta 50 (20/10, como Slack): el siguiente saca al fijado hace más tiempo', () => {
    expect(MAXIMO_DE_FIJADOS).toBe(50);
    const lista = Array.from({ length: MAXIMO_DE_FIJADOS }, (_, i) => fijado(i + 1, MAXIMO_DE_FIJADOS - i, 10));
    const nueva = agregarFijado(lista, fijado(99, 0, 24), AHORA);
    expect(nueva).toHaveLength(MAXIMO_DE_FIJADOS);
    expect(nueva[0]?.seq).toBe(99);
    expect(nueva.some((uno) => uno.seq === 1)).toBe(false);
  });

  it('cuatro fijados ya no sacan a nadie (antes el tope era 3)', () => {
    const lista = [fijado(1, 3, 10), fijado(2, 2, 10), fijado(3, 1, 10)];
    expect(agregarFijado(lista, fijado(4, 0, 24), AHORA).map((uno) => uno.seq)).toEqual([4, 3, 2, 1]);
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

describe('textoDelVencimiento', () => {
  it('sin vencimiento, días u horas que quedan', () => {
    expect(textoDelVencimiento(venceDelFijado('siempre', AHORA)!, AHORA)).toBe('sin vencimiento');
    expect(textoDelVencimiento(new Date(AHORA + 6 * 24 * 3_600_000 + 60_000).toISOString(), AHORA)).toBe('vence en 6 días');
    expect(textoDelVencimiento(new Date(AHORA + 26 * 3_600_000).toISOString(), AHORA)).toBe('vence en 1 día');
    expect(textoDelVencimiento(new Date(AHORA + 7 * 24 * 3_600_000 - 60_000).toISOString(), AHORA)).toBe('vence en 7 días');
    expect(textoDelVencimiento(new Date(AHORA + 23 * 3_600_000).toISOString(), AHORA)).toBe('vence en 23 h');
    expect(textoDelVencimiento(new Date(AHORA + 5 * 3_600_000).toISOString(), AHORA)).toBe('vence en 5 h');
    expect(textoDelVencimiento(new Date(AHORA + 10 * 60_000).toISOString(), AHORA)).toBe('vence en menos de 1 h');
  });
});
