import { describe, expect, it } from 'vitest';
import { estaCercaDelFinal, filasDeLaConversacion, sigueEnElFinal } from './filasDeLaConversacion';
import type { MensajeEnPantalla } from './types';

const m = (seq: number, senderId: string, at: string): MensajeEnPantalla => ({
  chatId: 'c1',
  seq,
  senderId,
  clientKey: `k${seq}`,
  kind: 'text',
  body: 'x',
  at,
});

describe('filasDeLaConversacion', () => {
  it('marca el chip de día, el bloque del mismo autor y el último del bloque', () => {
    const filas = filasDeLaConversacion([
      m(1, 'a', '2026-10-18T15:00:00.000Z'),
      m(2, 'a', '2026-10-19T15:00:00.000Z'),
      m(3, 'a', '2026-10-19T15:01:00.000Z'),
      m(4, 'b', '2026-10-19T15:02:00.000Z'),
    ]);

    expect(filas.map((f) => [f.nuevoDia, f.agrupado, f.ultimoDelGrupo])).toEqual([
      [true, false, true],
      [true, false, false],
      [false, true, true],
      [false, false, true],
    ]);
  });

  it('un mensaje de sistema corta el bloque', () => {
    const filas = filasDeLaConversacion([
      m(1, 'a', '2026-10-19T15:00:00.000Z'),
      { ...m(2, 'a', '2026-10-19T15:00:30.000Z'), kind: 'system' },
      m(3, 'a', '2026-10-19T15:01:00.000Z'),
    ]);

    expect(filas[2]?.agrupado).toBe(false);
  });

  it('lista vacía, sin filas', () => {
    expect(filasDeLaConversacion([])).toEqual([]);
  });
});

describe('estaCercaDelFinal', () => {
  it('a menos de 160 px del fondo está pegada', () => {
    expect(estaCercaDelFinal({ scrollTop: 900, clientHeight: 600, scrollHeight: 1600 })).toBe(true);
  });

  it('leyendo arriba no', () => {
    expect(estaCercaDelFinal({ scrollTop: 200, clientHeight: 600, scrollHeight: 1600 })).toBe(false);
  });
});

describe('sigueEnElFinal', () => {
  it('llegar abajo pega siempre', () => {
    expect(sigueEnElFinal({ cerca: true, pegadoAntes: false, msDesdeElGesto: 99_999 })).toBe(true);
  });

  it('alejarse con la rueda o el dedo despega', () => {
    expect(sigueEnElFinal({ cerca: false, pegadoAntes: true, msDesdeElGesto: 50 })).toBe(false);
  });

  it('alejarse sin gesto (una foto que cargó) NO despega (E2E, 19/10)', () => {
    expect(sigueEnElFinal({ cerca: false, pegadoAntes: true, msDesdeElGesto: 5000 })).toBe(true);
  });

  it('leyendo arriba, sin gesto, sigue despegada', () => {
    expect(sigueEnElFinal({ cerca: false, pegadoAntes: false, msDesdeElGesto: 5000 })).toBe(false);
  });
});
