import { describe, expect, it } from 'vitest';
import { mensajeSubido } from './mensajeSubido';

const MENSAJE = {
  _id: '6a90cf9012ab34cd56ef7890',
  chatId: '6a90cf9012ab34cd56ef7891',
  seq: 7,
  senderId: '665f1a2b3c4d5e6f70818293',
  clientKey: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
  kind: 'image',
  at: '2026-10-19T20:31:00.000Z',
  media: { mediaId: 'image-1.jpg', url: 'https://lila.constroad.com/files/x/image-1.jpg', mime: 'image/jpeg' },
};

/** Auditoría (19/10): la foto desaparecía entre «subió» y el `msg.new` (socket caído). */
describe('mensajeSubido', () => {
  it('la respuesta de la subida trae el mensaje confirmado, listo para el chat', () => {
    expect(mensajeSubido({ message: MENSAJE })).toEqual(MENSAJE);
  });

  it('un server viejo (sin mensaje, o a medias) no inventa nada', () => {
    expect(mensajeSubido({})).toBeUndefined();
    expect(mensajeSubido({ message: { seq: 7 } })).toBeUndefined();
    expect(mensajeSubido({ message: { ...MENSAJE, seq: 'siete' } })).toBeUndefined();
  });
});
