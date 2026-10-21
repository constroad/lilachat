import { describe, expect, it } from 'vitest';
import { callBackOptions, combinarFecha, opcionesRapidas, valorInicial } from './cuando.js';

/**
 * Elegir CUÁNDO en avisos y eventos (José, 17/10/2026: «no hay como elegir una
 * hora específica, qué pésimo UI/UX»). Antes solo había «En 1 hora / En 3 horas
 * / Esta noche / Mañana», y «Esta noche» era AHORA + 9 horas: creado a las 8 de
 * la noche, sonaba a las 5 de la mañana.
 */
const local = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);

describe('opcionesRapidas', () => {
  it('un miércoles a media tarde: en 1 hora, esta noche 20:00, mañana 9:00, este sábado 10:00', () => {
    const ahora = local(2026, 10, 14, 15, 12);

    expect(opcionesRapidas(ahora).map((o) => [o.etiqueta, o.fecha.getTime()])).toEqual([
      ['En 1 hora', local(2026, 10, 14, 16, 12).getTime()],
      ['Esta noche', local(2026, 10, 14, 20).getTime()],
      ['Mañana', local(2026, 10, 15, 9).getTime()],
      ['Este sábado', local(2026, 10, 17, 10).getTime()],
    ]);
  });

  it('«Esta noche» desaparece cuando ya pasaron las 19:00: nunca ofrece algo en el pasado', () => {
    const ahora = local(2026, 10, 17, 20, 30);

    const etiquetas = opcionesRapidas(ahora).map((o) => o.etiqueta);
    expect(etiquetas).not.toContain('Esta noche');
    for (const opcion of opcionesRapidas(ahora)) expect(opcion.fecha.getTime()).toBeGreaterThan(ahora.getTime());
  });

  it('en fin de semana el atajo es «El próximo sábado», el de la semana que viene', () => {
    for (const hoy of [local(2026, 10, 17, 11), local(2026, 10, 18, 11)]) {
      const finde = opcionesRapidas(hoy).find((o) => o.id === 'finde');
      expect(finde?.etiqueta).toBe('El próximo sábado');
      expect(finde?.fecha.getTime()).toBe(local(2026, 10, 24, 10).getTime());
    }
  });

  it('cruza fin de mes sin romperse', () => {
    const ahora = local(2026, 10, 31, 22);

    expect(opcionesRapidas(ahora).find((o) => o.id === 'manana')?.fecha.getTime()).toBe(local(2026, 11, 1, 9).getTime());
  });
});

describe('combinarFecha', () => {
  const previo = local(2026, 10, 20, 18, 45);

  it('elegir el DÍA conserva la hora', () => {
    expect(combinarFecha(previo, local(2026, 12, 24, 3, 0), 'date').getTime()).toBe(local(2026, 12, 24, 18, 45).getTime());
  });

  it('elegir la HORA conserva el día y pone los segundos en cero', () => {
    const elegido = new Date(2000, 0, 1, 7, 30, 59, 500);

    expect(combinarFecha(previo, elegido, 'time').getTime()).toBe(local(2026, 10, 20, 7, 30).getTime());
  });

  it('no muta el previo', () => {
    const copia = previo.getTime();
    combinarFecha(previo, local(2027, 1, 1, 0), 'date');

    expect(previo.getTime()).toBe(copia);
  });
});

describe('valorInicial', () => {
  it('al crear: la próxima hora en punto (no 15:12 + 3 h a lo bruto)', () => {
    expect(valorInicial(undefined, local(2026, 10, 17, 15, 12)).getTime()).toBe(local(2026, 10, 17, 16).getTime());
  });

  it('al editar: la fecha guardada', () => {
    expect(valorInicial('2026-10-25T23:00:00.000Z', local(2026, 10, 17, 15)).toISOString()).toBe('2026-10-25T23:00:00.000Z');
  });

  it('una fecha guardada rota cae a la próxima hora', () => {
    expect(valorInicial('no-es-fecha', local(2026, 10, 17, 15, 12)).getTime()).toBe(local(2026, 10, 17, 16).getTime());
  });
});

/** Backlog 23 (José, 21/10): «Recordarme devolverla», a call is returned soon: 15 min, 1 h, this afternoon, tonight, tomorrow. */
describe('callBackOptions', () => {
  it('in the morning: all five, in local time', () => {
    const now = new Date(2026, 9, 21, 9, 10);
    const options = callBackOptions(now);
    expect(options.map((option) => option.label)).toEqual(['En 15 min', 'En 1 hora', 'Esta tarde', 'Esta noche', 'Mañana']);
    expect(options[0]!.date).toEqual(new Date(2026, 9, 21, 9, 25));
    expect(options[2]!.date).toEqual(new Date(2026, 9, 21, 17, 0));
    expect(options[3]!.date).toEqual(new Date(2026, 9, 21, 20, 0));
    expect(options[4]!.date).toEqual(new Date(2026, 9, 22, 9, 0));
  });
  it('late in the day there is no «this afternoon» nor «tonight» that is less than an hour away', () => {
    expect(callBackOptions(new Date(2026, 9, 21, 16, 30)).map((option) => option.id)).toEqual(['quarter', 'hour', 'tonight', 'tomorrow']);
    expect(callBackOptions(new Date(2026, 9, 21, 19, 30)).map((option) => option.id)).toEqual(['quarter', 'hour', 'tomorrow']);
  });
});
