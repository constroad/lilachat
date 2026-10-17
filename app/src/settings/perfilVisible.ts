import type { PerfilPropio } from '../api/client';

/** Lo cambiado en esta sesión, con la cuenta que lo cambió (FL9). PURO. */
export type Cambiado = { userId: string; name: string | null; avatarUrl: string | null };

/** Puro: el payload del server, o `null` si no es un perfil. */
export function leerPerfil(payload: unknown): PerfilPropio | null {
  if (!payload || typeof payload !== 'object') return null;
  const campos = payload as Record<string, unknown>;
  if (typeof campos.phone !== 'string') return null;
  return {
    name: typeof campos.name === 'string' ? campos.name : null,
    phone: campos.phone,
    avatarUrl: typeof campos.avatarUrl === 'string' ? campos.avatarUrl : null,
  };
}

/** Puro: lo de esta sesión gana, pero solo si es de la MISMA cuenta. */
export function perfilVisible(
  credencial: { userId: string; name: string | null; avatarUrl?: string | null },
  propio: Cambiado | null
): { name: string | null; avatarUrl: string | null } {
  if (propio && propio.userId === credencial.userId) return { name: propio.name, avatarUrl: propio.avatarUrl };
  return { name: credencial.name, avatarUrl: credencial.avatarUrl ?? null };
}
