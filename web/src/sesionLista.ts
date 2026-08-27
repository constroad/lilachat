/**
 * ¿Ya se puede abrir el socket?
 *
 * Abrirlo con el token GUARDADO —que puede estar vencido— antes de que el
 * refresco lo renueve hace que el server rechace el handshake y socket.io
 * reintente: son los «WebSocket connection failed» del arranque. Se espera a que
 * la sesión quede resuelta y el primer handshake sale con un token vivo.
 *
 * Sin secreto no hay refresco que esperar: es una sesión vieja o una recién
 * creada al canjear el código, y hacerla esperar dejaría la web sin tiempo real.
 */
export function puedeAbrirSocket(params: {
  userId: string | null;
  tieneSecreto: boolean;
  refrescoResuelto: boolean;
}): boolean {
  if (!params.userId) return false;
  return params.tieneSecreto ? params.refrescoResuelto : true;
}
