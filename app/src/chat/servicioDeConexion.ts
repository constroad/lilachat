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
}): DecisionServicio {
  if (!params.haySesion) return 'apagar';

  // Encendido SIEMPRE que haya sesión, también con la app adelante: esperar a
  // que salga deja una ventana —el momento de la transición, el más frágil— en
  // la que Android puede matar el proceso antes de que el servicio arranque.
  return 'encender';
}
