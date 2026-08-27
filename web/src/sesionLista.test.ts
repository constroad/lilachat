import { describe, expect, it } from 'vitest';
import { puedeAbrirSocket } from './sesionLista';

/**
 * Cuándo abrir el socket, para no hacerlo con un token que está por cambiar.
 *
 * El ruido de «WebSocket connection failed» del arranque salía de esto: la web
 * abría el socket con el token GUARDADO —que puede estar vencido— antes de que
 * el refresco lo renovara. El server lo rechazaba, socket.io reintentaba, y de
 * ahí los errores. Una vez conectado no fallaba más, que es justo la firma de
 * este problema.
 */
describe('puedeAbrirSocket', () => {
  it('sin sesión no se abre nada', () => {
    expect(puedeAbrirSocket({ userId: null, tieneSecreto: false, refrescoResuelto: false })).toBe(
      false
    );
  });

  /**
   * Con secreto hay que ESPERAR al refresco: abrir antes es abrir con el token
   * viejo, que es exactamente lo que causaba el ruido.
   */
  it('con secreto, espera a que el refresco termine', () => {
    expect(puedeAbrirSocket({ userId: 'u1', tieneSecreto: true, refrescoResuelto: false })).toBe(
      false
    );
    expect(puedeAbrirSocket({ userId: 'u1', tieneSecreto: true, refrescoResuelto: true })).toBe(
      true
    );
  });

  /**
   * Sin secreto no hay nada que esperar —sesión vieja, o recién creada al
   * canjear el código— y hacerla esperar dejaría la web sin tiempo real.
   */
  it('sin secreto abre de una', () => {
    expect(puedeAbrirSocket({ userId: 'u1', tieneSecreto: false, refrescoResuelto: false })).toBe(
      true
    );
  });
});
