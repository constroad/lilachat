import { useSyncExternalStore } from 'react';
import { BASE_URL, type PerfilPropio } from '../api/client';
import { saveCredential, type Credential } from '../auth/credentialStore';
import { subirFotoRedonda, type FotoElegida } from '../chat/fotoDeGrupo';
import { leerPerfil, perfilVisible, type Cambiado } from './perfilVisible';

/**
 * Mi nombre y mi foto (FL9; auditoría §46.2: no había cómo ponérselos).
 *
 * La credencial trae los del último arranque; lo cambiado en esta sesión vive
 * acá para que la cabecera y Ajustes lo muestren al instante, y se guarda en la
 * credencial para el próximo arranque (que igual lo repara con el server).
 */
let cambiado: Cambiado | null = null;
const oyentes = new Set<() => void>();
const suscribir = (oyente: () => void) => {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
};

export function usePerfilPropio(credential: Credential): { name: string | null; avatarUrl: string | null } {
  const propio = useSyncExternalStore(suscribir, () => cambiado);
  return perfilVisible(credential, propio);
}

export async function aplicarPerfil(credential: Credential, perfil: PerfilPropio): Promise<void> {
  cambiado = { userId: credential.userId, name: perfil.name, avatarUrl: perfil.avatarUrl };
  oyentes.forEach((oyente) => oyente());
  await saveCredential({ ...credential, name: perfil.name, avatarUrl: perfil.avatarUrl }).catch(() => undefined);
}

export async function subirFotoDePerfil(
  jwt: string,
  foto: FotoElegida
): Promise<{ ok: true; perfil: PerfilPropio } | { ok: false; motivo: string }> {
  const r = await subirFotoRedonda({ url: `${BASE_URL}/api/me/perfil/foto`, jwt, foto });
  if (!r.ok) return r;
  const perfil = leerPerfil(r.payload.perfil);
  return perfil ? { ok: true, perfil } : { ok: false, motivo: 'No se pudo cambiar la foto.' };
}
