import { describe, expect, it } from 'vitest';
import {
  BACKUP_RETENTION_DAYS,
  backupFileName,
  expiredBackups,
  parseBackupName,
  summarizeBackups,
} from './backup.js';

/**
 * Las decisiones del respaldo, sin tocar disco ni red.
 *
 * Un backup es fácil de creer y difícil de comprobar: el job corre de noche,
 * escribe un archivo y nadie lo mira hasta que hace falta. Por eso las reglas
 * que deciden QUÉ se borra y QUÉ se muestra viven acá con test propio — el
 * error caro es borrar de más, y ese no avisa.
 */
describe('backupFileName / parseBackupName', () => {
  /**
   * El nombre lleva la fecha en UTC y en formato ordenable. Con la hora local
   * el orden alfabético se rompe dos veces al año, justo cuando cambia el
   * horario — y el «último backup» pasaría a ser uno viejo.
   */
  it('el nombre ordena por fecha alfabéticamente', () => {
    const antes = backupFileName(new Date('2026-08-24T04:30:00Z'));
    const despues = backupFileName(new Date('2026-08-25T04:30:00Z'));

    expect(antes).toBe('lilachat-2026-08-24T043000Z.tar.gz');
    expect([despues, antes].sort()).toEqual([antes, despues]);
  });

  it('la fecha se puede leer de vuelta del nombre', () => {
    const at = new Date('2026-08-24T04:30:00Z');

    expect(parseBackupName(backupFileName(at))?.toISOString()).toBe(at.toISOString());
  });

  /** Un archivo ajeno en la carpeta no es un backup y no se interpreta. */
  it('un nombre que no es nuestro devuelve null', () => {
    expect(parseBackupName('notas.txt')).toBeNull();
    expect(parseBackupName('lilachat-lo-que-sea.tar.gz')).toBeNull();
  });
});

describe('expiredBackups', () => {
  const nombre = (iso: string) => backupFileName(new Date(iso));
  const ahora = new Date('2026-08-24T05:00:00Z');

  it('borra lo más viejo que la retención', () => {
    const vencidos = expiredBackups(
      [nombre('2026-07-01T04:30:00Z'), nombre('2026-08-20T04:30:00Z')],
      ahora
    );

    expect(vencidos).toEqual([nombre('2026-07-01T04:30:00Z')]);
  });

  /**
   * NUNCA se borra el último que queda. Un reloj mal puesto —o una máquina que
   * estuvo apagada un mes— haría que todo se vea vencido, y la limpieza dejaría
   * cero respaldos: exactamente el día en que hacen falta.
   */
  it('jamás deja la carpeta vacía, aunque todo esté vencido', () => {
    const viejo = nombre('2025-01-01T04:30:00Z');
    const menosViejo = nombre('2025-02-01T04:30:00Z');

    const vencidos = expiredBackups([viejo, menosViejo], ahora);

    expect(vencidos).toEqual([viejo]);
    expect(vencidos).not.toContain(menosViejo);
  });

  it('con un solo backup no borra nada', () => {
    expect(expiredBackups([nombre('2020-01-01T04:30:00Z')], ahora)).toEqual([]);
  });

  /** Lo que no reconoce, no lo toca: borrar archivos ajenos es imperdonable. */
  it('ignora archivos que no son backups nuestros', () => {
    expect(expiredBackups(['notas.txt', '.DS_Store'], ahora)).toEqual([]);
  });

  it('la retención por defecto son 30 días', () => {
    expect(BACKUP_RETENTION_DAYS).toBe(30);
  });
});

describe('summarizeBackups', () => {
  it('el último es el más reciente, no el último de la lista', () => {
    const resumen = summarizeBackups(
      [
        { name: backupFileName(new Date('2026-08-20T04:30:00Z')), sizeBytes: 100 },
        { name: backupFileName(new Date('2026-08-24T04:30:00Z')), sizeBytes: 200 },
        { name: backupFileName(new Date('2026-08-22T04:30:00Z')), sizeBytes: 50 },
      ],
      new Date('2026-08-24T06:00:00Z')
    );

    expect(resumen.lastAt?.toISOString()).toBe('2026-08-24T04:30:00.000Z');
    expect(resumen.count).toBe(3);
    expect(resumen.totalBytes).toBe(350);
    expect(resumen.stale).toBe(false);
  });

  /**
   * Sin respaldos, o con el último de hace más de dos días, la pantalla tiene
   * que DECIRLO. Un cartel verde de «todo bien» sobre una carpeta vacía es peor
   * que no tener pantalla: convence de que hay respaldo cuando no lo hay.
   */
  it('marca como vencido el respaldo viejo', () => {
    const resumen = summarizeBackups(
      [{ name: backupFileName(new Date('2026-08-20T04:30:00Z')), sizeBytes: 100 }],
      new Date('2026-08-24T06:00:00Z')
    );

    expect(resumen.stale).toBe(true);
  });

  it('sin respaldos lo dice, y no finge estar al día', () => {
    const resumen = summarizeBackups([], new Date('2026-08-24T06:00:00Z'));

    expect(resumen.count).toBe(0);
    expect(resumen.lastAt).toBeNull();
    expect(resumen.stale).toBe(true);
  });
});
