import { describe, expect, it } from 'vitest';
import { textoDelFijado } from './mensajesFijados.js';

describe('textoDelFijado', () => {
  it('el texto que trae la lista, en una sola línea', () => {
    expect(textoDelFijado({ senderId: 'a', kind: 'text', body: 'Mañana a las 5\nen la puerta' })).toBe('Mañana a las 5 en la puerta');
  });

  it('en un chat secreto la lista no trae texto: usa el descifrado del teléfono', () => {
    expect(textoDelFijado({ senderId: 'a', kind: 'text' }, 'Clave del wifi: 1234')).toBe('Clave del wifi: 1234');
  });

  it('un adjunto sin pie dice qué es', () => {
    expect(textoDelFijado({ senderId: 'a', kind: 'image', mime: 'image/jpeg' })).toBe('Foto');
    expect(textoDelFijado({ senderId: 'a', kind: 'voice', mime: 'audio/m4a' })).toBe('Nota de voz');
    expect(textoDelFijado({ senderId: 'a', kind: 'file', mime: 'application/pdf' })).toBe('Archivo');
    expect(textoDelFijado({ senderId: 'a', kind: 'video', mime: 'video/mp4' })).toBe('Video');
  });

  it('sin nada que mostrar, no inventa', () => {
    expect(textoDelFijado({ senderId: 'a', kind: 'text' })).toBe('Mensaje');
  });
});
