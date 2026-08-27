import { describe, expect, it } from 'vitest';
import { decidirServicio } from './servicioDeConexion';

/**
 * Cuándo corre el servicio en primer plano — y por lo tanto, cuándo hay
 * notificación permanente en la bandeja.
 */
describe('decidirServicio', () => {
  it('con sesión y la app adelante: encendido', () => {
    expect(decidirServicio({ haySesion: true, estado: 'active', enSegundoPlano: true })).toBe(
      'encender'
    );
  });

  /**
   * Encendido TAMBIÉN con la app adelante: esperar a que salga deja una ventana
   * —la transición, el momento más frágil— en la que Android puede matar el
   * proceso antes de que el servicio arranque.
   */
  it('con sesión y la app atrás: encendido', () => {
    expect(decidirServicio({ haySesion: true, estado: 'background', enSegundoPlano: true })).toBe(
      'encender'
    );
  });

  it('sin sesión: apagado, no se molesta a quien no está usando la app', () => {
    expect(decidirServicio({ haySesion: false, estado: 'active', enSegundoPlano: true })).toBe(
      'apagar'
    );
  });

  /**
   * **El interruptor de José (27/08/2026).**
   *
   * «A cada rato me aparece la burbuja de "conectado para recibir mensajes",
   * eso es incorrecto, WhatsApp no hace eso». Es verdad que WhatsApp no la
   * muestra, y es verdad que nosotros no podemos evitarla: WhatsApp recibe por
   * FCM, un canal del sistema operativo, y acá se decidió no usar Firebase. Sin
   * FCM, Android exige esta notificación para dejar vivo un socket propio.
   *
   * Como el precio no se puede bajar, se le da a la persona la decisión: apagar
   * el servicio quita la notificación y, con ella, los mensajes con la app
   * cerrada. Es un intercambio, y lo elige quien lo paga.
   */
  it('con el interruptor apagado: apagado, aunque haya sesión', () => {
    expect(decidirServicio({ haySesion: true, estado: 'active', enSegundoPlano: false })).toBe(
      'apagar'
    );
  });

  /**
   * Sin preferencia guardada todavía, el servicio va ENCENDIDO. Una app de
   * mensajería que por defecto no te entrega los mensajes está rota; quien no
   * quiera la notificación la apaga y sabe lo que pierde.
   */
  it('sin preferencia guardada: encendido', () => {
    expect(decidirServicio({ haySesion: true, estado: 'active' })).toBe('encender');
  });
});
