import jwt from 'jsonwebtoken';

/**
 * Sesiones de Lilachat. constroad-auth dice QUIÉN SOS una vez; cuánto dura esa
 * respuesta lo decide cada app (su README). Acá: JWT propio de 24 h, y el
 * refresh re-valida la credencial del device contra el servicio — una
 * revocación pega como mucho en 24 h, o al instante en el próximo refresh.
 */
const SESSION_TTL = '24h';
/** Solo fuera de producción. En prod, sin secreto no se arranca (fail-closed). */
const DEV_FALLBACK_SECRET = 'lilachat-dev-only-secret';

export function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET || '';
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET es obligatorio en producción');
  }
  return DEV_FALLBACK_SECRET;
}

export type SessionClaims = { userId: string; deviceId: string; email: string };

export function signSession(claims: SessionClaims): string {
  return jwt.sign(claims, resolveJwtSecret(), { expiresIn: SESSION_TTL });
}

export function verifySession(token: string): SessionClaims | null {
  try {
    return jwt.verify(token, resolveJwtSecret()) as SessionClaims;
  } catch {
    return null;
  }
}
