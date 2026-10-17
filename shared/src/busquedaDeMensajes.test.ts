import { describe, expect, it } from 'vitest';
import { coincidenciasEnChat, moverCoincidencia, busquedaValida, escaparRegex, extractoDeCoincidencia } from './busquedaDeMensajes.js';

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

/**
 * Buscar DENTRO de un chat (FL9), como WhatsApp: sobre lo que el teléfono ya
 * tiene —incluido lo de un chat secreto, que acá está descifrado— y saltando
 * entre coincidencias con ↑ (más viejo) y ↓ (más nuevo).
 */
describe('coincidenciasEnChat', () => {
  const mensajes = [
    { seq: 1, body: 'Feliz cumpleaños', kind: 'text' },
    { seq: 2, body: 'gracias', kind: 'text' },
    { seq: 3, body: 'CUMPLE de Ana', kind: 'text' },
    { seq: 4, body: 'cumple', kind: 'text', deletedAt: '2026-10-17T00:00:00Z' },
    { seq: 5, body: 'José cumple', kind: 'system' },
    { seq: 6, kind: 'image' },
  ];

  it('por subcadena, sin mayúsculas ni tildes, del más viejo al más nuevo', () => {
    expect(coincidenciasEnChat(mensajes, 'cumple')).toEqual([1, 3]);
    expect(coincidenciasEnChat([{ seq: 9, body: 'mañana a las 8', kind: 'text' }], 'MANANA')).toEqual([9]);
  });

  it('ni eliminados ni avisos del sistema ni media sin texto', () => {
    expect(coincidenciasEnChat(mensajes, 'cumple')).not.toContain(4);
    expect(coincidenciasEnChat(mensajes, 'cumple')).not.toContain(5);
  });

  it('una consulta de menos de 2 letras no busca', () => {
    expect(coincidenciasEnChat(mensajes, 'c')).toEqual([]);
  });

  it('el texto se busca literal: un «(» no rompe nada', () => {
    expect(coincidenciasEnChat([{ seq: 1, body: 'precio (con IGV)', kind: 'text' }], '(con')).toEqual([1]);
  });
});

describe('moverCoincidencia', () => {
  it('↑ va al anterior (más viejo) y ↓ al siguiente, sin pasarse de los bordes', () => {
    expect(moverCoincidencia({ total: 3, actual: 2, hacia: 'anterior' })).toBe(1);
    expect(moverCoincidencia({ total: 3, actual: 0, hacia: 'anterior' })).toBe(0);
    expect(moverCoincidencia({ total: 3, actual: 2, hacia: 'siguiente' })).toBe(2);
  });

  it('sin coincidencias, -1', () => {
    expect(moverCoincidencia({ total: 0, actual: 0, hacia: 'anterior' })).toBe(-1);
  });
});
