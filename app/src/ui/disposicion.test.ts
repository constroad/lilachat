import { describe, expect, it } from 'vitest';
import { ANCHO_DE_LISTA, ANCHO_MAXIMO_DE_CONTENIDO, ANCHO_MAXIMO_DE_FORMULARIO, disposicion } from './disposicion';

/**
 * La app gira y tiene versión tablet (FL10, auditoría §46.3; regla de toda app
 * RN del workspace). Medidas en dp, como `useWindowDimensions`.
 */
describe('disposicion', () => {
  it('teléfono parado: nada cambia', () => {
    expect(disposicion({ ancho: 411, alto: 866 })).toEqual({ apaisada: false, tablet: false, amplia: false, dosPaneles: false });
  });

  it('teléfono girado: amplia (riel lateral y contenido centrado), un solo panel', () => {
    expect(disposicion({ ancho: 866, alto: 411 })).toEqual({ apaisada: true, tablet: false, amplia: true, dosPaneles: false });
  });

  it('tablet, en las dos orientaciones: dos paneles, como WhatsApp', () => {
    expect(disposicion({ ancho: 1280, alto: 800 })).toMatchObject({ tablet: true, dosPaneles: true });
    expect(disposicion({ ancho: 800, alto: 1280 })).toMatchObject({ tablet: true, dosPaneles: true, apaisada: false });
  });

  it('tablet chica parada: no entran la lista y el chat, un solo panel', () => {
    expect(disposicion({ ancho: 600, alto: 960 })).toMatchObject({ tablet: true, amplia: true, dosPaneles: false });
  });

  it('la lista del panel izquierdo y el ancho máximo del contenido', () => {
    expect(ANCHO_DE_LISTA).toBe(380);
    expect(ANCHO_MAXIMO_DE_CONTENIDO).toBe(720);
    expect(ANCHO_MAXIMO_DE_FORMULARIO).toBe(480);
  });
});
