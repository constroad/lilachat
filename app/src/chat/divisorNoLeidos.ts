/**
 * Dónde va «N mensajes no leídos» al abrir un chat (FL9; auditoría §46.2: no
 * había divisor y el chat siempre abría abajo). Motor PURO.
 *
 * Se cuentan desde el final los mensajes AJENOS que no son avisos: el número
 * de no leídos que trae la lista dice cuántos son, y el divisor va arriba del
 * primero de ellos.
 */
export function seqDelDivisor(
  filas: readonly { seq?: number; senderId?: string; kind?: string }[],
  yo: string,
  noLeidos: number
): number | null {
  if (noLeidos <= 0) return null;
  let contados = 0;
  let primero: number | null = null;
  for (let indice = filas.length - 1; indice >= 0; indice--) {
    const fila = filas[indice];
    if (!fila || typeof fila.seq !== 'number' || fila.senderId === yo || fila.kind === 'system') continue;
    primero = fila.seq;
    contados++;
    if (contados === noLeidos) break;
  }
  return primero;
}

/**
 * Con el `readSeq` del server (auditoría 19/10): el divisor va arriba del
 * primer mensaje AJENO (no aviso) después de lo leído, y dice cuántos ajenos
 * hay. El contador de la lista cuenta también lo propio y los avisos, y el
 * divisor quedaba más arriba de lo nuevo.
 */
export function divisorDesdeLeido(
  filas: readonly { seq?: number; senderId?: string; kind?: string }[],
  yo: string,
  readSeq: number
): { seq: number; cantidad: number } | null {
  const nuevos = filas.filter((fila) => typeof fila.seq === 'number' && fila.seq > readSeq && fila.senderId !== yo && fila.kind !== 'system');
  const primero = nuevos[0]?.seq;
  return typeof primero === 'number' ? { seq: primero, cantidad: nuevos.length } : null;
}
