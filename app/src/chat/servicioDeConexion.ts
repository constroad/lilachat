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

/**
 * Si `connectSocket` puede quedarse con el socket que ya existe.
 *
 * `active` es de socket.io: verdadero mientras conecta o reconecta solo, falso
 * tras un `disconnect()` a propósito. Reemplazar uno que está conectando dejaba
 * los listeners de quien lo creó colgados de un socket descartado.
 */
export function reusarSocket(socket: { connected: boolean; active: boolean } | null): boolean {
  if (!socket) return false;
  return socket.connected || socket.active;
}

/**
 * Qué hace `connectSocket` con el socket que hay (FL8). Uno pausado se
 * RECONECTA en vez de reemplazarse: sus oyentes (llamadas, cola, chat) siguen
 * enganchados. Solo se crea uno nuevo si no hay ninguno (arranque o después
 * de cerrar sesión, que lo descarta).
 */
export function queHacerConElSocket(socket: { connected: boolean; active: boolean } | null): 'crear' | 'reusar' | 'reconectar' {
  if (!socket) return 'crear';
  return reusarSocket(socket) ? 'reusar' : 'reconectar';
}

/** Si el socket puede pausarse al ir al fondo, o tiene que esperar a que termine la llamada. */
export type PausaDelSocket = { enLlamada: boolean; pausaPendiente: boolean };

/**
 * En plena llamada el socket NO se pausa al ir al fondo (FL11): por ahí llega
 * que el otro colgó, contestó o mandó un candidato. La pausa queda pendiente y
 * se aplica al terminar la llamada si la app sigue atrás; volver adelante la
 * cancela.
 */
export function pausaDelSocket(
  estado: PausaDelSocket,
  evento: 'pausar' | 'reanudar' | 'llamada' | 'fin-de-llamada'
): { estado: PausaDelSocket; desconectar: boolean } {
  switch (evento) {
    case 'pausar':
      return estado.enLlamada ? { estado: { ...estado, pausaPendiente: true }, desconectar: false } : { estado, desconectar: true };
    case 'reanudar':
      return { estado: { ...estado, pausaPendiente: false }, desconectar: false };
    case 'llamada':
      return { estado: { ...estado, enLlamada: true }, desconectar: false };
    case 'fin-de-llamada':
      return { estado: { enLlamada: false, pausaPendiente: false }, desconectar: estado.pausaPendiente };
  }
}
