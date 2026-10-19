import { describe, expect, it } from 'vitest';
import { PosicionEnLaLista } from './finalDeLaConversacion';

/** Alto de la lista en el emulador (dp), con el pie y la cabecera. */
const ALTO = 643;

/** Arrastrar con el dedo hasta `offset` y soltar. */
function arrastrarHasta(posicion: PosicionEnLaLista, offset: number, contenido: number): boolean {
  posicion.alEmpezarArrastre();
  posicion.alScrollear({ offset, alto: ALTO, contenido });
  return posicion.alTerminarArrastre({ offset, alto: ALTO, contenido });
}

describe('PosicionEnLaLista', () => {
  it('abajo de todo está pegada al final', () => {
    // Arrange
    const posicion = new PosicionEnLaLista();
    // Act
    const pegada = posicion.alScrollear({ offset: 7195, alto: ALTO, contenido: 7838 });
    // Assert
    expect(pegada).toBe(true);
  });

  it('arrastrar hacia arriba la despega', () => {
    const posicion = new PosicionEnLaLista();
    expect(arrastrarHasta(posicion, 2000, 7838)).toBe(false);
  });

  it('volver abajo con el dedo la pega otra vez', () => {
    const posicion = new PosicionEnLaLista();
    arrastrarHasta(posicion, 2000, 7838);

    expect(arrastrarHasta(posicion, 7195, 7838)).toBe(true);
  });

  it('un scroll que NO es del dedo nunca la despega (emulador, 19/10)', () => {
    // La lista, al acomodarse, mandó «8 dp» con 916 de contenido: leído como
    // lejos, nadie seguía al final y el chat abría a medio camino.
    const posicion = new PosicionEnLaLista();
    posicion.alCambiarTamaño(651);
    posicion.alCambiarTamaño(916);

    expect(posicion.alScrollear({ offset: 8, alto: ALTO, contenido: 651 })).toBe(true);
  });

  it('un evento de scroll atrasado no manda sobre el tamaño medido (emulador, 18/10)', () => {
    // Al reabrir el chat: el estimado era 9032, el medido 7838, y el último
    // evento llegó DESPUÉS con el 9032 viejo.
    const posicion = new PosicionEnLaLista();
    posicion.alCambiarTamaño(9032);
    posicion.alCambiarTamaño(7838);

    expect(arrastrarHasta(posicion, 7187, 9032)).toBe(true);
  });

  it('la primera medición no opina', () => {
    const posicion = new PosicionEnLaLista();
    expect(posicion.alCambiarTamaño(7838)).toBeUndefined();
  });

  it('pegada, si lo de abajo crece, pide seguir: también antes del primer scroll', () => {
    // La tarjeta de un recordatorio con imagen crece ~300 dp al cargar.
    const posicion = new PosicionEnLaLista();
    posicion.alCambiarTamaño(5000);

    expect(posicion.alCambiarTamaño(5700)).toBe('seguir');
  });

  it('leyendo arriba, crecer no mueve nada', () => {
    const posicion = new PosicionEnLaLista();
    posicion.alCambiarTamaño(7838);
    arrastrarHasta(posicion, 2000, 7838);

    expect(posicion.alCambiarTamaño(8200)).toBeUndefined();
  });

  it('con el dedo encima no se la arrastra al final', () => {
    const posicion = new PosicionEnLaLista();
    posicion.alCambiarTamaño(7838);
    posicion.alEmpezarArrastre();

    expect(posicion.alCambiarTamaño(8200)).toBeUndefined();
  });

  it('achicarse hasta quedar abajo la vuelve a pegar', () => {
    const posicion = new PosicionEnLaLista();
    posicion.alCambiarTamaño(9032);
    arrastrarHasta(posicion, 7187, 9032);

    expect(posicion.alCambiarTamaño(7838)).toBe('cerca');
  });

  it('justo en el margen de 160 dp ya cuenta como lejos', () => {
    const posicion = new PosicionEnLaLista();
    expect(arrastrarHasta(posicion, 7838 - ALTO - 160, 7838)).toBe(false);
    expect(arrastrarHasta(posicion, 7838 - ALTO - 159, 7838)).toBe(true);
  });
});
