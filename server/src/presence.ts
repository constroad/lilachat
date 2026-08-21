/**
 * Quién está en línea (F4).
 *
 * Vive en MEMORIA del proceso, y eso es una decisión: la presencia es
 * verdadera solo mientras el socket existe, y el socket vive en este proceso.
 * Persistirla en Mongo obligaría a limpiarla al arrancar —si no, un reinicio
 * deja a todo el mundo «en línea» para siempre— y a escribir en cada conexión y
 * desconexión, que en una app de chat es constante.
 *
 * El día que haya más de un proceso, esto se muda a Redis. Hoy hay uno.
 */

/** Un usuario puede tener VARIOS dispositivos: se cuenta, no se marca. */
const connectionsByUser = new Map<string, number>();

export function markOnline(userId: string): { becameOnline: boolean } {
  const current = connectionsByUser.get(userId) ?? 0;
  connectionsByUser.set(userId, current + 1);
  // Solo el PRIMER socket cambia el estado: abrir la app en el teléfono
  // teniendo la web abierta no vuelve a avisar «se conectó» a todo el mundo.
  return { becameOnline: current === 0 };
}

export function markOffline(userId: string): { becameOffline: boolean } {
  const current = connectionsByUser.get(userId) ?? 0;
  const next = Math.max(0, current - 1);
  if (next === 0) connectionsByUser.delete(userId);
  else connectionsByUser.set(userId, next);
  // Cerrar UN dispositivo teniendo otro abierto no pone a nadie fuera de línea.
  return { becameOffline: current > 0 && next === 0 };
}

export function isOnline(userId: string): boolean {
  return (connectionsByUser.get(userId) ?? 0) > 0;
}

export function onlineAmong(userIds: string[]): string[] {
  return userIds.filter(isOnline);
}

/** Solo para tests: la memoria no se comparte entre casos. */
export function __resetPresence(): void {
  connectionsByUser.clear();
}
