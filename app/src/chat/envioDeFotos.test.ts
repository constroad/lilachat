import { describe, expect, it } from 'vitest';
import { armarEnvioDeFotos, quitarFoto, MAXIMO_DE_FOTOS, sendTitleOf } from './envioDeFotos';
import { shotsKeyOf } from './envioDeFotos';

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

  /** La forma de la foto viaja con ella (FL9): la burbuja la respeta. */
  it('lleva el ancho y el alto que dio la galería', () => {
    const [foto] = armarEnvioDeFotos([{ uri: 'c', width: 4000, height: 3000 }], {});

    expect(foto).toMatchObject({ width: 4000, height: 3000 });
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

/** José 12/11: a shot of the chat's camera asks the server for its stamp; a gallery pick never does. */
describe('the camera stamp of a shot', () => {
  it('goes with the shot that carries it and with no other', () => {
    // Arrange
    const stamp = { timemark: true as const, point: { lat: -12, lng: -77, precision: 6 }, logo: true };
    // Act
    const sent = armarEnvioDeFotos([{ uri: 'cam', stamp }, { uri: 'gal' }], {});
    // Assert
    expect(sent[0]).toMatchObject({ uri: 'cam', stamp });
    expect(sent[1]).not.toHaveProperty('stamp');
  });
});

/** E2E 12/11: a video from the chat camera said «1 foto» over its send screen. */
describe('sendTitleOf', () => {
  it('names photos, videos or both by what was picked', () => {
    // Arrange
    const photo = { uri: 'a', mimeType: 'image/jpeg' };
    const video = { uri: 'b', mimeType: 'video/mp4' };
    // Act
    const titles = [sendTitleOf([photo]), sendTitleOf([video]), sendTitleOf([video, video]), sendTitleOf([photo, video]), sendTitleOf([photo, photo])];
    // Assert
    expect(titles).toEqual(['1 foto', '1 video', '2 videos', '2 archivos', '2 fotos']);
  });
});

// José 13/11: «tomo foto o video, ingreso el mensaje pero el mensaje no llega, solo la foto». The camera
// handed «Enviar» a NEW list on each render (every second, for the live clock): the captions reset.
describe('shotsKeyOf', () => {
  it('the same shots in a new list keep their key, so the captions stay', () => {
    const shot = { uri: 'file:///cam/1.jpg' };
    expect(shotsKeyOf([shot])).toBe(shotsKeyOf([{ ...shot }]));
  });

  it('another shot, one more or none changes it', () => {
    expect(shotsKeyOf([{ uri: 'a' }])).not.toBe(shotsKeyOf([{ uri: 'b' }]));
    expect(shotsKeyOf([{ uri: 'a' }])).not.toBe(shotsKeyOf([{ uri: 'a' }, { uri: 'b' }]));
    expect(shotsKeyOf([])).toBe('');
  });
});
