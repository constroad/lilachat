import { describe, expect, it } from 'vitest';
import { aplanarAgenda } from './aplanarAgenda';

/**
 * Datos como los de una agenda de verdad: con tildes, sin nombre, con varios
 * números y con entradas vacías. La lección de `plausible-zero-hides-the-bug`:
 * con `{name: 'a', phone: '1'}` esto pasa siempre y no prueba nada.
 */
describe('aplanarAgenda', () => {
  it('una fila por NÚMERO, no por persona', () => {
    const filas = aplanarAgenda([
      { id: 'c1', name: 'María Ángeles Ñuñez', phoneNumbers: [{ number: '+51987654321' }, { number: '+51912345678' }] },
    ]);

    expect(filas).toHaveLength(2);
    expect(filas.map((f) => f.telefono)).toEqual(['+51987654321', '+51912345678']);
  });

  /** Misma persona, dos números: dos claves distintas o React los funde en uno. */
  it('los ids de una misma persona no se repiten', () => {
    const filas = aplanarAgenda([
      { id: 'c1', name: 'Wilson', phoneNumbers: [{ number: '111' }, { number: '222' }] },
    ]);

    expect(new Set(filas.map((f) => f.id)).size).toBe(2);
  });

  it('sin nombre, se muestra el número', () => {
    expect(aplanarAgenda([{ id: 'c2', phoneNumbers: [{ number: '+51900000006' }] }])[0].nombre).toBe(
      '+51900000006'
    );
  });

  it('un contacto sin teléfonos no aporta filas', () => {
    expect(aplanarAgenda([{ id: 'c3', name: 'Solo email' }])).toEqual([]);
  });

  /** Un número en blanco no es un número: sería una fila vacía e ininvitable. */
  it('descarta números vacíos o en blanco', () => {
    expect(aplanarAgenda([{ id: 'c4', name: 'X', phoneNumbers: [{ number: '   ' }, { number: '' }] }])).toEqual(
      []
    );
  });

  it('recorta los espacios que deja la agenda', () => {
    const [fila] = aplanarAgenda([{ id: 'c5', name: '  Ana  ', phoneNumbers: [{ number: ' 999 ' }] }]);

    expect(fila).toMatchObject({ nombre: 'Ana', telefono: '999' });
  });
});
