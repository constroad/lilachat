import { describe, expect, it } from 'vitest';
import { extensionDe, nombreDeArchivo } from './archivoDescargado';

describe('extensionDe', () => {
  it('mapea los tipos que manejamos', () => {
    expect(extensionDe('image/jpeg')).toBe('jpg');
    expect(extensionDe('image/png')).toBe('png');
    expect(extensionDe('video/mp4')).toBe('mp4');
  });

  it('no le importa la caja', () => {
    expect(extensionDe('IMAGE/PNG')).toBe('png');
  });

  /**
   * **Android decide con qué app abrir un archivo por su extensión.** Una
   * desconocida deja la foto guardada sin poder abrirse con nada, así que ante
   * la duda se usa `jpg`, que es lo que casi siempre es.
   */
  it('un tipo desconocido cae en jpg, no en vacío', () => {
    expect(extensionDe('application/octet-stream')).toBe('jpg');
    expect(extensionDe(undefined)).toBe('jpg');
    expect(extensionDe('')).toBe('jpg');
  });
});

describe('nombreDeArchivo', () => {
  const cuando = new Date(2026, 7, 28, 11, 44);

  /**
   * La fecha adelante para que ordene sola, y el origen escrito: quien abre la
   * galería meses después reconoce de dónde salió sin tener que abrirla.
   */
  it('lleva el origen y la fecha', () => {
    expect(nombreDeArchivo({ cuando, mime: 'image/jpeg', seq: 12 })).toBe(
      'Lilachat-2026-08-28-1144-12.jpg'
    );
  });

  it('rellena mes, día y hora con cero', () => {
    const enero = new Date(2026, 0, 5, 9, 7);

    expect(nombreDeArchivo({ cuando: enero, mime: 'image/png', seq: 1 })).toBe(
      'Lilachat-2026-01-05-0907-1.png'
    );
  });

  /**
   * **Dos fotos del mismo minuto no pueden llamarse igual.** Sin el `seq`, la
   * segunda se guardaría encima de la primera y se perdería una sin avisar.
   */
  it('el seq desempata dentro del mismo minuto', () => {
    const a = nombreDeArchivo({ cuando, mime: 'image/jpeg', seq: 12 });
    const b = nombreDeArchivo({ cuando, mime: 'image/jpeg', seq: 13 });

    expect(a).not.toBe(b);
  });

  it('sin tipo conocido igual da un nombre usable', () => {
    expect(nombreDeArchivo({ cuando, seq: 3 })).toMatch(/^Lilachat-.*\.jpg$/);
  });
});
