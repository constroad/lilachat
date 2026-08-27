/**
 * Cuándo tiene que estar encendido el servicio en primer plano.
 *
 * El servicio sostiene el proceso para que el socket no se caiga con la app
 * atrás. Su precio es una notificación permanente en la bandeja, así que cuándo
 * está encendido no es un detalle: dejarla puesta sin sesión sería molestar sin
 * dar nada a cambio.
 */
export type DecisionServicio = 'encender' | 'apagar';

export function decidirServicio(params: {
  haySesion: boolean;
  /** Lo que reporta `AppState` de React Native. */
  estado: 'active' | 'background' | 'inactive' | string;
  /**
   * Lo que eligió la persona en Ajustes. Sin valor guardado todavía: encendido.
   *
   * Existe desde el 27/08/2026. La notificación permanente **no se puede quitar
   * manteniendo los mensajes**: es el trato que impone Android para dejar vivo
   * un socket propio, y WhatsApp se lo ahorra porque usa FCM —un canal del
   * sistema operativo— que acá se descartó a propósito. Como el precio es fijo,
   * lo que se puede dar es la ELECCIÓN: apagarlo saca la notificación y también
   * los mensajes con la app cerrada.
   */
  enSegundoPlano?: boolean;
}): DecisionServicio {
  if (!params.haySesion) return 'apagar';
  if (params.enSegundoPlano === false) return 'apagar';

  // Encendido SIEMPRE que haya sesión, también con la app adelante: esperar a
  // que salga deja una ventana —el momento de la transición, el más frágil— en
  // la que Android puede matar el proceso antes de que el servicio arranque.
  return 'encender';
}
