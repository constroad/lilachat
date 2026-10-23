import { describe, expect, it } from 'vitest';
import { aQuienSuena, etiquetaDeRecordatorioEnElChat, whenItRings, ETIQUETA_DE_REPETICION } from './recordatorios.js';

/** Cómo se lee cuándo suena un recordatorio: la tarjeta del chat y la lista del grupo (19/10). */
describe('whenItRings', () => {
  const ahora = new Date('2026-10-19T10:00:00');

  it('una vez: el día y la hora', () => {
    expect(whenItRings({ startsAt: '2026-10-19T18:00:00', recurrence: 'once', active: true }, ahora)).toMatch(/^Hoy, 6:00/);
  });

  it('repetido: cada cuánto y la próxima', () => {
    expect(whenItRings({ startsAt: '2026-10-18T07:00:00', recurrence: 'daily', active: true }, ahora)).toMatch(/^Diario · Mañana, 7:00/);
  });

  it('apagado o ya pasado, lo dice', () => {
    expect(whenItRings({ startsAt: '2026-10-19T18:00:00', recurrence: 'once', active: false }, ahora)).toBe('Apagado');
    expect(whenItRings({ startsAt: '2026-10-10T18:00:00', recurrence: 'once', active: true }, ahora)).toBe('Ya pasó');
  });

  it('las etiquetas de repetición', () => {
    expect(ETIQUETA_DE_REPETICION).toEqual({ once: 'Una vez', daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual' });
  });
});

/** José, 20/10: recordatorios también en un 1:1, en un borrador y en el chat contigo. */
describe('aQuienSuena', () => {
  it('dice a quién le va a sonar según el chat', () => {
    expect(aQuienSuena('group', 'Obra')).toBe('Para «Obra»: le suena a todo el grupo.');
    expect(aQuienSuena('direct', 'Ana')).toBe('Con «Ana»: les suena a los dos.');
    expect(aQuienSuena('notas', 'Tú')).toBe('Solo para ti: te suena a ti.');
  });
});

describe('etiquetaDeRecordatorioEnElChat', () => {
  it('en un grupo dice «del grupo»; en el resto, solo «Recordatorio»', () => {
    expect(etiquetaDeRecordatorioEnElChat('group')).toBe('Recordatorio del grupo');
    expect(etiquetaDeRecordatorioEnElChat('direct')).toBe('Recordatorio');
    expect(etiquetaDeRecordatorioEnElChat('notas')).toBe('Recordatorio');
  });
});
