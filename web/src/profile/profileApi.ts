import type { Birthday, MyProfile } from '@lilachat/shared';
import { api } from '../api';
import { shrinkPhotoBlob } from '../chat/shrinkPhoto';

/** The profile Lilachat requires (backlog 17), the same `/api/me` the phone uses. */
export const getProfile = (jwt: string) => api<{ profile: MyProfile }>('/me/profile', { jwt });
export const saveProfile = (jwt: string, change: { name?: string; birthday?: Birthday; birthdayVisible?: boolean }) => api<{ profile: MyProfile }>('/me/profile', { jwt, method: 'PUT', body: change });
export const requestEmailCode = (jwt: string, email: string) => api<{ sent: boolean }>('/me/email/code', { jwt, body: { email } });
export const verifyEmailCode = (jwt: string, email: string, code: string) => api<{ profile: MyProfile }>('/me/email/verify', { jwt, body: { email, code } });

/** The optional photo of «Crea tu usuario»: same compression and route as the phone's. */
export async function uploadProfilePhoto(jwt: string, file: File): Promise<{ ok: true; avatarUrl: string | null } | { ok: false; message: string }> {
  const photo = await shrinkPhotoBlob(file, file.name);
  const form = new FormData();
  form.append('file', photo.blob, photo.name);
  try {
    const response = await fetch('/api/me/perfil/foto', { method: 'POST', headers: { Authorization: `Bearer ${jwt}` }, body: form });
    const payload = (await response.json().catch(() => ({}))) as { perfil?: { avatarUrl?: string | null }; message?: string };
    return response.ok && payload.perfil ? { ok: true, avatarUrl: payload.perfil.avatarUrl ?? null } : { ok: false, message: payload.message ?? 'No se pudo subir la foto.' };
  } catch {
    return { ok: false, message: 'No se pudo subir la foto.' };
  }
}
