import { describe, expect, it } from 'vitest';
import { indexarParaBuscar, buscarEn } from './busqueda';

/**
 * Buscar en la agenda sin que se sienta pesado.
 *
 * José, 26/08/2026: «el filtrado de contactos está muy pesado, demora».
 * El filtro corría en CADA render sobre ~600 contactos, y por cada uno armaba
 * un string nuevo y lo bajaba a minúsculas. O sea: 600 concatenaciones y 600
 * `toLowerCase` por cada tecla.
 *
 * La clave de búsqueda se calcula UNA vez, al cargar la agenda. Después buscar
 * es solo `includes` sobre texto ya listo.
 */
const contacto = (nombre: string, telefono: string) => ({ id: telefono, nombre, telefono });

describe('indexarParaBuscar', () => {
  it('deja la clave lista y en minúsculas', () => {
    const [uno] = indexarParaBuscar([contacto('Mamá', '999111222')]);

    expect(uno.busqueda).toContain('mam');
    expect(uno.busqueda).toContain('999111222');
  });

  /**
   * **Sin tildes.** Buscar «mama» tiene que encontrar a «Mamá»: nadie escribe
   * la tilde en un buscador, y no encontrar a la propia madre por eso es
   * exactamente la clase de detalle que hace sentir rota una app.
   */
  it('la tilde no esconde a nadie', () => {
    const indexados = indexarParaBuscar([contacto('Mamá', '999111222')]);

    expect(buscarEn(indexados, 'mama')).toHaveLength(1);
  });

  it('encuentra por teléfono, con el formato que sea', () => {
    const indexados = indexarParaBuscar([contacto('Tía', '+51 988 777 666')]);

    expect(buscarEn(indexados, '988777666')).toHaveLength(1);
  });
});

describe('buscarEn', () => {
  const indexados = indexarParaBuscar([
    contacto('Mamá', '999111222'),
    contacto('Wilson', '960397018'),
    contacto('Wilfredo', '992774738'),
  ]);

  it('sin nada escrito devuelve todo, sin copiar la lista', () => {
    expect(buscarEn(indexados, '')).toBe(indexados);
    expect(buscarEn(indexados, '   ')).toBe(indexados);
  });

  it('encuentra a varios por el mismo prefijo', () => {
    expect(buscarEn(indexados, 'wil').map((uno) => uno.nombre)).toEqual(['Wilson', 'Wilfredo']);
  });

  it('lo que no está, no está', () => {
    expect(buscarEn(indexados, 'zzz')).toEqual([]);
  });
});
