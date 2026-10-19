import { describe, expect, it } from 'vitest';
import { leerNovedades, lineasDeNotas } from './novedades';

/**
 * José, 19/10: «sale que hay una actualización; debería mostrar un preview con
 * todas las novedades y recién allí dar la opción de descargar».
 */
describe('leerNovedades', () => {
  it('toma las versiones con notas, de la más nueva a la más vieja', () => {
    const crudo = [
      { version: '0.1.95', versionCode: 96, notas: '• Fotos' },
      { version: '0.1.97', versionCode: 98, notas: '• Emojis' },
    ];
    expect(leerNovedades(crudo)).toEqual([
      { version: '0.1.97', versionCode: 98, notas: '• Emojis' },
      { version: '0.1.95', versionCode: 96, notas: '• Fotos' },
    ]);
  });

  it('lo que no tiene forma se descarta; un server viejo (sin el campo) da ninguna', () => {
    expect(leerNovedades([{ version: 1 }, null, { version: '0.1.9', versionCode: 9, notas: '   ' }])).toEqual([]);
    expect(leerNovedades(undefined)).toEqual([]);
  });
});

describe('lineasDeNotas', () => {
  it('una línea por novedad, sin la viñeta ni las vacías', () => {
    expect(lineasDeNotas('• Emojis en la barra.\n\n- Menciones\n* Fotos en grande ')).toEqual(['Emojis en la barra.', 'Menciones', 'Fotos en grande']);
  });
});
