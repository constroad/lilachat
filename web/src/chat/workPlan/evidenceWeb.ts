import { api } from '../../api';
import { subirArchivo } from '../mediaUpload';
import { shrinkPhotoBlob } from '../shrinkPhoto';

/**
 * Evidence of a task on the web (pending 21, design e2-18): the file goes up as
 * a message of the channel with the task in its caption, then that message is
 * linked to the task. Returns an error to show, or null when it is done.
 */
export async function attachEvidenceWeb(params: { jwt: string; chatId: string; checklistId: string; itemId: string; taskText: string; file: File }): Promise<string | null> {
  const isImage = params.file.type.startsWith('image/');
  const shrunk = isImage ? await shrinkPhotoBlob(params.file, params.file.name, {}) : null;
  const blob = shrunk?.blob ?? params.file;
  const uploaded = await subirArchivo({
    jwt: params.jwt,
    chatId: params.chatId,
    clientKey: crypto.randomUUID(),
    archivo: blob,
    nombre: shrunk?.name ?? params.file.name,
    mime: shrunk?.mime ?? (params.file.type || 'application/octet-stream'),
    caption: `Evidencia · ${params.taskText}`,
    width: shrunk?.width,
    height: shrunk?.height,
    onProgreso: () => undefined,
  });
  if (!uploaded.ok) return uploaded.message;
  if (!uploaded.mensaje) return 'El archivo subió, pero no se pudo unir a la tarea. Recarga e inténtalo de nuevo.';
  const linked = await api<{ ok: boolean }>(`/agenda/checklists/${params.checklistId}/items/${params.itemId}/evidence`, { jwt: params.jwt, body: { seq: uploaded.mensaje.seq } });
  return linked.ok ? null : (linked.message ?? 'El archivo quedó en el chat, pero no se pudo unir a la tarea.');
}

export async function detachEvidenceWeb(params: { jwt: string; checklistId: string; itemId: string; seq: number }): Promise<string | null> {
  const removed = await api<{ ok: boolean }>(`/agenda/checklists/${params.checklistId}/items/${params.itemId}/evidence/${params.seq}`, { jwt: params.jwt, method: 'DELETE' });
  return removed.ok ? null : (removed.message ?? 'No se pudo quitar el archivo.');
}
