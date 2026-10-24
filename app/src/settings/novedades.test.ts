import { describe, expect, it } from 'vitest';
import { leerNovedades, lineasDeNotas, newerAudiences } from './novedades';

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

describe('who the newer versions are for (José, 24/10)', () => {
  const notes = [
    { version: '0.1.168', versionCode: 169, notas: 'Lilachat 0.1.168\nPara: chats personales\n\n- Stickers nuevos.' },
    { version: '0.1.167', versionCode: 168, notas: 'Lilachat 0.1.167\nPara: modo empresa\n\n- Ajustes del espacio abajo.' },
    { version: '0.1.166', versionCode: 167, notas: 'Lilachat 0.1.166\n\n- Clima por horas.' },
  ];

  it('reads the audience of each version newer than mine, up to the published one', () => {
    expect(newerAudiences(notes, 167, 169)).toEqual(['personal', 'spaces']);
    expect(newerAudiences(notes, 166, 168)).toEqual(['spaces', 'all']);
    expect(newerAudiences(notes, 169, 169)).toEqual([]);
  });

  it('the audience line is not shown as one of the news', () => {
    expect(lineasDeNotas(notes[1]!.notas)).toEqual(['Lilachat 0.1.167', 'Ajustes del espacio abajo.']);
  });
});
