/**
 * Hasta qué `seq` acusar lectura en la web: el último CONFIRMADO, sea de quien
 * sea (auditoría 19/10: solo contaba el último ajeno, y mi propia línea de
 * sistema —«Fijaste un mensaje»— quedaba sin leer con el chat abierto). Solo
 * con la pestaña a la vista y la lista abajo; una vez por `seq`.
 */
export function seqParaAcusar(params: {
  mensajes: readonly { seq: number; estado?: string }[];
  ultimoAvisado: number;
  visible: boolean;
  pegado: boolean;
}): number | null {
  if (!params.visible || !params.pegado) return null;
  const ultimo = [...params.mensajes].reverse().find((uno) => !uno.estado);
  return ultimo && ultimo.seq > params.ultimoAvisado ? ultimo.seq : null;
}
