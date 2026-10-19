import { describe, expect, it } from 'vitest';
import { PosicionEnLaLista } from './finalDeLaConversacion';

/** Alto de la lista en el emulador (dp), con el pie y la cabecera. */
const ALTO = 643;

describe('PosicionEnLaLista', () => {
  it('abajo de todo está cerca del final', () => {
    // Arrange
    const posicion = new PosicionEnLaLista();
    // Act
    const cerca = posicion.alScrollear({ offset: 7195, alto: ALTO, contenido: 7838 });
    // Assert
    expect(cerca).toBe(true);
  });

  it('leyendo arriba está lejos', () => {
    const posicion = new PosicionEnLaLista();
    expect(posicion.alScrollear({ offset: 2000, alto: ALTO, contenido: 7838 })).toBe(false);
  });

  it('un evento de scroll atrasado no manda sobre el tamaño medido (emulador, 18/10)', () => {
    // Al reabrir el chat: el tamaño estimado era 9032, el medido 7838, y el
    // último evento de scroll llegó DESPUÉS con el 9032 viejo. Se veía el
    // botón «bajar» estando abajo de todo.
    const posicion = new PosicionEnLaLista();
    posicion.alCambiarTamaño(9032);
    posicion.alCambiarTamaño(7838);

    expect(posicion.alScrollear({ offset: 7187, alto: ALTO, contenido: 9032 })).toBe(true);
  });

  it('sin tamaño medido todavía, usa el del evento', () => {
    const posicion = new PosicionEnLaLista();
    expect(posicion.alScrollear({ offset: 7187, alto: ALTO, contenido: 9032 })).toBe(false);
  });

  it('un cambio de tamaño que deja cerca lo dice', () => {
    const posicion = new PosicionEnLaLista();
    posicion.alScrollear({ offset: 7187, alto: ALTO, contenido: 9032 });

    expect(posicion.alCambiarTamaño(7838)).toBe(true);
  });

  it('un cambio de tamaño nunca aleja: crecer abajo lo resuelve el autoscroll', () => {
    // Llega un mensaje estando abajo: el contenido crece antes de que la lista
    // baje sola. Decir «lejos» ahí haría parpadear el botón.
    const posicion = new PosicionEnLaLista();
    posicion.alScrollear({ offset: 7195, alto: ALTO, contenido: 7838 });

    expect(posicion.alCambiarTamaño(8200)).toBeUndefined();
  });

  it('antes del primer scroll no opina', () => {
    // Sin alto de la lista no hay con qué medir.
    const posicion = new PosicionEnLaLista();
    expect(posicion.alCambiarTamaño(7838)).toBeUndefined();
  });

  it('justo en el margen de 160 dp ya cuenta como lejos', () => {
    const posicion = new PosicionEnLaLista();
    expect(posicion.alScrollear({ offset: 7838 - ALTO - 160, alto: ALTO, contenido: 7838 })).toBe(false);
    expect(posicion.alScrollear({ offset: 7838 - ALTO - 159, alto: ALTO, contenido: 7838 })).toBe(true);
  });
});
