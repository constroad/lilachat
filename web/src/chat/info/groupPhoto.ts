import { shrinkPhotoBlob } from '../shrinkPhoto';

export type GroupPhotoResult = { ok: true; avatarUrl?: string } | { ok: false; status: number; message: string };

/**
 * The group's photo as a file (the common `api` sends JSON): from its info,
 * and since pending 7 also right after creating it. Portal's standard: it goes
 * lighter first (28/10).
 */
export async function uploadGroupPhoto(jwt: string, chatId: string, file: File): Promise<GroupPhotoResult> {
  const photo = await shrinkPhotoBlob(file, file.name);
  const form = new FormData();
  form.append('file', photo.blob, photo.name);
  try {
    const response = await fetch(`/api/chats/${chatId}/avatar`, { method: 'POST', headers: { Authorization: `Bearer ${jwt}` }, body: form });
    const body = (await response.json().catch(() => ({}))) as { message?: string; avatarUrl?: string };
    return response.ok ? { ok: true, avatarUrl: body.avatarUrl } : { ok: false, status: response.status, message: body.message ?? 'No se pudo cambiar la foto.' };
  } catch {
    return { ok: false, status: 0, message: 'Sin conexión. Revisa tu internet.' };
  }
}
