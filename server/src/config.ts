/**
 * Config del server. Regla (`constroad-security` §2): una env var es para un
 * SECRETO o una URL; lo demás es constante con el valor real de producción.
 * Los secretos (llave de constroad-auth, etc.) se agregan fail-closed cuando
 * exista el código que los usa — declarar variables que nadie lee es deuda.
 */
const DEFAULT_PORT = 4003;

export function resolvePort(rawPort: string | undefined = process.env.PORT): number {
  if (!rawPort) return DEFAULT_PORT;
  const parsed = Number(rawPort);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`PORT inválido: "${rawPort}"`);
  }
  return parsed;
}
