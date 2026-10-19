import { describe, expect, it } from 'vitest';
import { recorteDeMensaje } from './mensajeLargo';

/** José, 19/10: «los mensajes largos deberían poder colapsarse», como WhatsApp («Leer más»). */
describe('recorteDeMensaje', () => {
  it('un mensaje corto no se recorta', () => {
    expect(recorteDeMensaje('Hola, ¿cómo estás?')).toEqual({ recortado: false, texto: 'Hola, ¿cómo estás?' });
  });

  it('uno largo se corta en una palabra, antes del tope, con puntos suspensivos', () => {
    const largo = 'palabra '.repeat(200).trim();
    const { recortado, texto } = recorteDeMensaje(largo);

    expect(recortado).toBe(true);
    expect(texto.length).toBeLessThanOrEqual(700 + 1);
    expect(texto.endsWith('palabra…')).toBe(true);
  });

  it('muchas líneas cortas también cuentan', () => {
    const lineas = Array.from({ length: 30 }, (_, i) => `línea ${i + 1}`).join('\n');
    const { recortado, texto } = recorteDeMensaje(lineas);

    expect(recortado).toBe(true);
    expect(texto.split('\n')).toHaveLength(15);
    expect(texto.endsWith('línea 15…')).toBe(true);
  });

  it('justo en el tope no se recorta: «Leer más» por un carácter sería ridículo', () => {
    const justo = 'a'.repeat(700);
    expect(recorteDeMensaje(justo).recortado).toBe(false);
  });

  it('una sola palabra enorme (un link) se corta igual', () => {
    const { recortado, texto } = recorteDeMensaje('https://x.pe/' + 'a'.repeat(900));
    expect(recortado).toBe(true);
    expect(texto.length).toBeLessThanOrEqual(701);
  });
});
