import { describe, expect, it } from 'vitest';
import { clasificarMedias, extraerLinks, type MensajeClasificable } from './mediasDelChat.js';

const foto = (seq: number): MensajeClasificable => ({ seq, media: { mime: 'image/jpeg' } });
const video = (seq: number): MensajeClasificable => ({ seq, media: { mime: 'video/mp4' } });
const pdf = (seq: number): MensajeClasificable => ({ seq, media: { mime: 'application/pdf' } });
const voz = (seq: number): MensajeClasificable => ({ seq, media: { mime: 'audio/m4a' } });
const texto = (seq: number, body: string): MensajeClasificable => ({ seq, body });

describe('clasificarMedias', () => {
  it('separa fotos/videos, documentos y links', () => {
    const r = clasificarMedias([
      foto(1),
      pdf(2),
      texto(3, 'miren esto https://obra.com/plano'),
      video(4),
      texto(5, 'sin link'),
      voz(6),
    ]);

    expect(r.medias.map((m) => m.seq)).toEqual([1, 4]);
    expect(r.docs.map((m) => m.seq)).toEqual([2]);
    expect(r.links.map((l) => l.seq)).toEqual([3]);
  });

  /** Una nota de voz NO es un documento: no va en «Docs». */
  it('la voz no cuenta como documento', () => {
    expect(clasificarMedias([voz(1)]).docs).toEqual([]);
  });

  /** Un mensaje borrado no aparece en ninguna sección. */
  it('lo borrado se ignora', () => {
    const borrado: MensajeClasificable = { seq: 1, media: { mime: 'image/jpeg' }, deletedAt: 'x' };
    expect(clasificarMedias([borrado]).medias).toEqual([]);
  });
});

describe('extraerLinks', () => {
  it('saca la primera url del texto', () => {
    expect(extraerLinks('mirá https://a.com y https://b.com')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('acepta http y www', () => {
    expect(extraerLinks('www.obra.pe/plano')).toEqual(['http://www.obra.pe/plano']);
  });

  it('sin url, lista vacía', () => {
    expect(extraerLinks('hola qué tal')).toEqual([]);
  });

  it('no confunde un correo con un link', () => {
    expect(extraerLinks('escribime a jose@x.com')).toEqual([]);
  });
});
