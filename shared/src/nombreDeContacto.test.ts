import { describe, expect, it } from 'vitest';
import { indexarAgendaPorTelefono, nombreDeContacto } from './nombreDeContacto.js';

/**
 * El caso real que lo motiva (27/08/2026): José chatea con Wilson y lee
 * «960397018». Wilson no se puso nombre en Lilachat, así que el server cae al
 * teléfono — pero José SÍ lo tiene guardado en su agenda.
 */
describe('nombreDeContacto', () => {
  const agenda = indexarAgendaPorTelefono([
    { nombre: 'Wilson', telefono: '+51 960 397 018' },
    { nombre: 'Ana Ñuñez', telefono: '987654321' },
  ]);

  it('gana el nombre de MI agenda', () => {
    expect(nombreDeContacto({ delServidor: '960397018', telefono: '960397018', agenda })).toBe(
      'Wilson'
    );
  });

  /**
   * **También le gana al nombre que la persona se puso.** Si lo guardaste como
   * «Wilson albañil», eso es lo que reconocés de un vistazo — es lo que hace
   * WhatsApp.
   */
  it('mi agenda le gana al nombre que se puso la persona', () => {
    expect(
      nombreDeContacto({ delServidor: 'Wilson Zamora', telefono: '960397018', agenda })
    ).toBe('Wilson');
  });

  /** Sin el contacto guardado, se usa el nombre que eligió la persona. */
  it('sin agenda, vale el nombre del servidor', () => {
    expect(
      nombreDeContacto({ delServidor: 'Wilson Zamora', telefono: '960397018', agenda: new Map() })
    ).toBe('Wilson Zamora');
  });

  /** Y si nadie tiene nombre, queda el número — que es mejor que un vacío. */
  it('sin nada, queda el número', () => {
    expect(
      nombreDeContacto({ delServidor: '960397018', telefono: '960397018', agenda: new Map() })
    ).toBe('960397018');
  });

  /**
   * Los dos lados vienen escritos distinto: la agenda guarda «+51 960 397 018»
   * y el server manda «960397018». Sin normalizar, no encuentra nada — que es
   * justo el síntoma que se arregla.
   */
  it('cruza formatos distintos del mismo número', () => {
    expect(nombreDeContacto({ telefono: '+51-960-397-018', agenda })).toBe('Wilson');
    expect(nombreDeContacto({ telefono: '51960397018', agenda })).toBe('Wilson');
  });

  /** Un grupo tiene nombre propio y no tiene teléfono: se respeta tal cual. */
  it('un grupo conserva su nombre', () => {
    expect(nombreDeContacto({ delServidor: 'Obra Chillón', telefono: null, agenda })).toBe(
      'Obra Chillón'
    );
  });

  it('sin datos no devuelve «undefined»', () => {
    expect(nombreDeContacto({ agenda })).toBe('');
  });
});

describe('indexarAgendaPorTelefono', () => {
  it('normaliza la clave para que el cruce funcione', () => {
    expect(indexarAgendaPorTelefono([{ nombre: 'Wilson', telefono: '+51 960 397 018' }])).toEqual(
      new Map([['960397018', 'Wilson']])
    );
  });

  /**
   * Un contacto cuyo «nombre» es su propio número no aporta nada, y dejarlo
   * pasar haría que le gane al nombre que la persona sí eligió en Lilachat.
   */
  it('descarta contactos cuyo nombre es el propio número', () => {
    expect(indexarAgendaPorTelefono([{ nombre: '960397018', telefono: '960397018' }]).size).toBe(0);
  });

  it('descarta lo que no es un celular válido', () => {
    expect(indexarAgendaPorTelefono([{ nombre: 'Fijo', telefono: '014455666' }]).size).toBe(0);
  });

  /** Con el número repetido gana el PRIMERO: si no, el nombre depende del orden. */
  it('el primero gana ante duplicados', () => {
    const indice = indexarAgendaPorTelefono([
      { nombre: 'Wilson', telefono: '960397018' },
      { nombre: 'Wilson trabajo', telefono: '960397018' },
    ]);

    expect(indice.get('960397018')).toBe('Wilson');
  });
});
