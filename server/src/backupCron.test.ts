import { describe, expect, it } from 'vitest';
import { shouldRunBackup } from './backupCron.js';

/**
 * Cuándo toca respaldar.
 *
 * El job es nocturno y el proceso puede haber estado caído a esa hora — un
 * reinicio, un deploy, la mini apagada. Si la condición fuera «son las 4:30»,
 * bastaría con no estar vivo ese minuto para saltarse el respaldo del día
 * entero, y nadie se enteraría hasta necesitarlo.
 *
 * Por eso la pregunta no es la HORA sino: ¿ya hay un respaldo de hoy?
 */
const hora = (iso: string) => new Date(iso);

describe('shouldRunBackup', () => {
  it('a la hora de la noche y sin respaldo de hoy, corre', () => {
    expect(
      shouldRunBackup({
        now: hora('2026-08-24T09:30:00Z'), // 04:30 en Lima
        lastAt: hora('2026-08-23T09:30:00Z'),
      })
    ).toBe(true);
  });

  it('con un respaldo de hoy ya hecho, no corre de nuevo', () => {
    expect(
      shouldRunBackup({
        now: hora('2026-08-24T15:00:00Z'),
        lastAt: hora('2026-08-24T09:30:00Z'),
      })
    ).toBe(false);
  });

  /**
   * El caso que justifica todo: la mini estuvo apagada a las 4:30 y arranca a
   * las 9. El respaldo del día se hace igual, tarde pero se hace.
   */
  it('si se pasó la hora y falta el de hoy, corre igual', () => {
    expect(
      shouldRunBackup({
        now: hora('2026-08-24T14:00:00Z'),
        lastAt: hora('2026-08-23T09:30:00Z'),
      })
    ).toBe(true);
  });

  /** Antes de la hora de la noche, se espera: no se adelanta el del día. */
  it('temprano en el día no se adelanta', () => {
    expect(
      shouldRunBackup({
        now: hora('2026-08-24T06:00:00Z'), // 01:00 en Lima
        lastAt: hora('2026-08-23T09:30:00Z'),
      })
    ).toBe(false);
  });

  it('sin ningún respaldo previo, corre en cuanto llega la hora', () => {
    expect(shouldRunBackup({ now: hora('2026-08-24T09:30:00Z'), lastAt: null })).toBe(true);
  });
});
