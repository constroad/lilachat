import { describe, expect, it } from 'vitest';
import { cuandoSuena, ETIQUETA_DE_REPETICION } from './recordatorios';

/** Cómo se lee cuándo suena un recordatorio: la tarjeta del chat y la lista del grupo (19/10). */
describe('cuandoSuena', () => {
  const ahora = new Date('2026-10-19T10:00:00');

  it('una vez: el día y la hora', () => {
    expect(cuandoSuena({ startsAt: '2026-10-19T18:00:00', recurrence: 'once', active: true }, ahora)).toMatch(/^Hoy, 6:00/);
  });

  it('repetido: cada cuánto y la próxima', () => {
    expect(cuandoSuena({ startsAt: '2026-10-18T07:00:00', recurrence: 'daily', active: true }, ahora)).toMatch(/^Diario · Mañana, 7:00/);
  });

  it('apagado o ya pasado, lo dice', () => {
    expect(cuandoSuena({ startsAt: '2026-10-19T18:00:00', recurrence: 'once', active: false }, ahora)).toBe('Apagado');
    expect(cuandoSuena({ startsAt: '2026-10-10T18:00:00', recurrence: 'once', active: true }, ahora)).toBe('Ya pasó');
  });

  it('las etiquetas de repetición', () => {
    expect(ETIQUETA_DE_REPETICION).toEqual({ once: 'Una vez', daily: 'Diario', weekly: 'Semanal' });
  });
});
