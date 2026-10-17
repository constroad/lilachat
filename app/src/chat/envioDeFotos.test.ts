import { describe, expect, it } from 'vitest';
import { armarEnvioDeFotos, quitarFoto, MAXIMO_DE_FOTOS } from './envioDeFotos';

/** Varias fotos con su pie, como WhatsApp (FL9b; auditoría §46.2). */
describe('armarEnvioDeFotos', () => {
  const fotos = [
    { uri: 'a', fileName: 'a.jpg', mimeType: 'image/jpeg', fileSize: 10 },
    { uri: 'b', fileName: null, mimeType: null, fileSize: null },
  ];

  it('cada foto con su pie, sin espacios de más; sin pie, nada', () => {
    expect(armarEnvioDeFotos(fotos, { a: '  la del parque ', b: '   ' })).toEqual([
      { uri: 'a', fileName: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 10, caption: 'la del parque' },
      { uri: 'b', fileName: 'foto.jpg', mimeType: 'image/jpeg', sizeBytes: 0, caption: undefined },
    ]);
  });

  it('respeta el orden en que se eligieron', () => {
    expect(armarEnvioDeFotos([...fotos].reverse(), {}).map((f) => f.uri)).toEqual(['b', 'a']);
  });

  it('el tope de fotos es el de WhatsApp en un envío corto', () => {
    expect(MAXIMO_DE_FOTOS).toBe(10);
  });
});

describe('quitarFoto', () => {
  it('saca una y el índice actual queda dentro de lo que queda', () => {
    expect(quitarFoto(['a', 'b', 'c'], 2, 2)).toEqual({ fotos: ['a', 'b'], actual: 1 });
    expect(quitarFoto(['a', 'b', 'c'], 0, 1)).toEqual({ fotos: ['b', 'c'], actual: 0 });
    expect(quitarFoto(['a'], 0, 0)).toEqual({ fotos: [], actual: 0 });
  });
});
