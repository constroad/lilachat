import { describe, expect, it } from 'vitest';
import { decidirServicio, queHacerConElSocket, reusarSocket } from './servicioDeConexion';

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

/**
 * Cuándo `connectSocket` reusa el socket que ya existe. Antes solo reusaba uno
 * CONECTADO: en el arranque, TabsShell creaba el socket, el efecto de `App`
 * corría un instante después —todavía conectando— y lo reemplazaba por otro.
 * Los listeners de TabsShell quedaban colgados de un socket muerto.
 */
describe('reusarSocket', () => {
  it('sin socket: no hay nada que reusar', () => {
    expect(reusarSocket(null)).toBe(false);
  });

  it('conectado: se reusa', () => {
    expect(reusarSocket({ connected: true, active: true })).toBe(true);
  });

  it('todavía conectando (o reconectando solo): se reusa, no se reemplaza', () => {
    expect(reusarSocket({ connected: false, active: true })).toBe(true);
  });

  it('cortado a propósito (pausa o logout): se crea uno nuevo', () => {
    expect(reusarSocket({ connected: false, active: false })).toBe(false);
  });
});

/**
 * FL8: un socket PAUSADO (app en segundo plano) se reconecta, no se reemplaza.
 * Reemplazarlo dejaba a quien escuchaba en el viejo —las llamadas de la sesión—
 * sordo: al tocar el push «Llamada de…» la app abría el chat y la oferta llegaba
 * al socket nuevo, sin nadie escuchando.
 */
describe('queHacerConElSocket', () => {
  it('sin socket (arranque o después de cerrar sesión): crear', () => {
    expect(queHacerConElSocket(null)).toBe('crear');
  });

  it('conectado o conectando: reusar tal cual', () => {
    expect(queHacerConElSocket({ connected: true, active: true })).toBe('reusar');
    expect(queHacerConElSocket({ connected: false, active: true })).toBe('reusar');
  });

  it('pausado (desconectado a mano): reconectar el MISMO, con sus oyentes', () => {
    expect(queHacerConElSocket({ connected: false, active: false })).toBe('reconectar');
  });
});
