import { describe, expect, it } from 'vitest';
import { busquedaValida, escaparRegex, extractoDeCoincidencia } from './busquedaDeMensajes.js';

describe('busquedaValida', () => {
  it('exige al menos 2 caracteres (sin contar espacios)', () => {
    expect(busquedaValida('a')).toBe(false);
    expect(busquedaValida('  x  ')).toBe(false);
    expect(busquedaValida('ho')).toBe(true);
    expect(busquedaValida('')).toBe(false);
  });
});

describe('escaparRegex', () => {
  it('escapa los metacaracteres, para buscar el texto literal', () => {
    // Sin escapar, «(» suelto rompe el regex y tira la búsqueda entera.
    expect(escaparRegex('¿cómo (estás)?')).toBe('¿cómo \\(estás\\)\\?');
    expect(escaparRegex('a.b*c')).toBe('a\\.b\\*c');
  });

  it('el texto normal queda igual', () => {
    expect(escaparRegex('cumpleaños')).toBe('cumpleaños');
  });
});

describe('extractoDeCoincidencia', () => {
  it('centra el trozo en la coincidencia y marca dónde cae', () => {
    const body = 'Che, el cumpleaños de la abuela es el sábado a las 6';
    const { texto, desde, largo } = extractoDeCoincidencia(body, 'cumple', 5);
    expect(texto).toContain('cumpleaños');
    // El resaltado cae sobre «cumple».
    expect(texto.slice(desde, desde + largo).toLowerCase()).toBe('cumple');
  });

  it('sin recorte al principio no pone «…» adelante', () => {
    const r = extractoDeCoincidencia('hola mundo', 'hola', 30);
    expect(r.texto).toBe('hola mundo');
    expect(r.desde).toBe(0);
  });

  it('es insensible a mayúsculas', () => {
    const r = extractoDeCoincidencia('La CLAVE es 1234', 'clave', 20);
    expect(r.texto.slice(r.desde, r.desde + r.largo)).toBe('CLAVE');
  });
});
