import { describe, expect, it } from 'vitest';
import { decidirServicio } from './servicioDeConexion';

/**
 * Cuándo encender el servicio en primer plano.
 *
 * José, 26/08/2026: «notificación permanente, sin Firebase». El servicio
 * mantiene vivo el proceso —y con él el socket— cuando la app queda atrás; sin
 * él Android la suspende y los mensajes entran recién al volver a abrir.
 *
 * El precio es esa notificación fija en la bandeja, y por eso importa cuándo
 * está encendido: dejarla puesta sin sesión sería una app que molesta sin dar
 * nada a cambio.
 */
describe('decidirServicio', () => {
  it('con sesión y la app atrás: encendido', () => {
    expect(decidirServicio({ haySesion: true, estado: 'background' })).toBe('encender');
  });

  /**
   * **Con la app adelante también.** Encenderlo recién al salir deja una
   * ventana en la que Android puede matar el proceso antes de que el servicio
   * arranque — y esa ventana es justo el momento de transición, el más frágil.
   */
  it('con sesión y la app adelante: encendido igual', () => {
    expect(decidirServicio({ haySesion: true, estado: 'active' })).toBe('encender');
  });

  /** Sin sesión no hay socket que sostener: la notificación sería puro estorbo. */
  it('sin sesión: apagado', () => {
    expect(decidirServicio({ haySesion: false, estado: 'background' })).toBe('apagar');
    expect(decidirServicio({ haySesion: false, estado: 'active' })).toBe('apagar');
  });

  /**
   * `inactive` es el estado de transición de Android —la pantalla de apps
   * recientes, una llamada entrando—. NO es cerrar la app: apagar el servicio
   * ahí lo prendería y apagaría en cada gesto.
   */
  it('en transición no se apaga nada', () => {
    expect(decidirServicio({ haySesion: true, estado: 'inactive' })).toBe('encender');
  });
});
