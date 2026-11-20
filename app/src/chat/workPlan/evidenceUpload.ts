import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import type { TimemarkStampAsked } from '@lilachat/shared';
import { agendaDelete, agendaPost } from '../../agenda/agendaApi';
import { openCamera } from '../camara/cameraRequests';
import { CAMERA_DENIED } from '../camara/FormCamera';
import { uploadMedia } from '../mediaUpload';
import { shrinkPhotoFile } from '../shrinkPhoto';

type Picked = { uri: string; fileName: string; mimeType: string; sizeBytes: number; width?: number; height?: number; stamp?: TimemarkStampAsked };
/** `camera`: the app's camera with its stamp (José 19/11, design cc-06: the camera of a pending row). */
export type EvidenceSource = 'photo' | 'file' | 'camera';

/**
 * A shot of the app's camera, with its stamp. It goes whole: the server shrinks it once while it
 * burns the stamp, as every stamped shot of the chat (José 12/11). 'denied' without the permission.
 */
async function shoot(): Promise<Picked | null | 'denied'> {
  const shot = await openCamera({ title: 'Evidencia de la tarea' });
  if (!shot || shot === 'denied') return shot;
  const info = await FileSystem.getInfoAsync(shot.uri).catch(() => null);
  const sizeBytes = info?.exists && typeof info.size === 'number' ? info.size : 0;
  return { uri: shot.uri, fileName: `evidencia-${Date.now()}.${shot.mime.split('/')[1] ?? 'jpg'}`, mimeType: shot.mime, sizeBytes, stamp: shot.stamp };
}

/** One photo (lighter by Portal's standard, as every upload) or one document, or null when nothing was chosen. */
async function pick(source: EvidenceSource): Promise<Picked | null> {
  if (source === 'file') {
    const chosen = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    const asset = chosen.canceled ? null : chosen.assets?.[0];
    return asset ? { uri: asset.uri, fileName: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream', sizeBytes: asset.size ?? 0 } : null;
  }
  const chosen = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false });
  const asset = chosen.canceled ? null : chosen.assets?.[0];
  if (!asset) return null;
  const photo = { uri: asset.uri, fileName: asset.fileName ?? `evidencia-${Date.now()}.jpg`, mimeType: asset.mimeType ?? 'image/jpeg', sizeBytes: asset.fileSize, width: asset.width, height: asset.height };
  return shrinkPhotoFile(photo);
}

/**
 * Evidence of a task (pending 21, design e2-18): the file goes up as a message
 * of the channel with the task in its caption, and then that message is linked
 * to the task. Returns an error to show, or null when it is done or nothing was chosen.
 */
export async function attachEvidence(params: { jwt: string; chatId: string; checklistId: string; itemId: string; taskText: string; source: EvidenceSource; onProgress?: (ratio: number) => void }): Promise<string | null> {
  const file = params.source === 'camera' ? await shoot() : await pick(params.source);
  if (file === 'denied') return CAMERA_DENIED;
  if (!file) return null;
  const uploaded = await uploadMedia({ token: params.jwt, chatId: params.chatId, clientKey: Crypto.randomUUID(), ...file, caption: `Evidencia · ${params.taskText}`, onProgress: params.onProgress });
  if (!uploaded.ok) return uploaded.reason;
  const linked = await agendaPost<{ ok: boolean }>(`/checklists/${params.checklistId}/items/${params.itemId}/evidence`, params.jwt, { seq: uploaded.seq });
  return linked.ok ? null : (linked.message ?? 'El archivo quedó en el chat, pero no se pudo unir a la tarea.');
}

/** Unlinks it from the task; the message stays in the chat. */
export async function detachEvidence(params: { jwt: string; checklistId: string; itemId: string; seq: number }): Promise<string | null> {
  const removed = await agendaDelete<{ ok: boolean }>(`/checklists/${params.checklistId}/items/${params.itemId}/evidence/${params.seq}`, params.jwt);
  return removed.ok ? null : (removed.message ?? 'No se pudo quitar el archivo.');
}

/** Ticks or reopens a task (the plan's own route: the server checks who may). */
export async function toggleTask(params: { jwt: string; checklistId: string; itemId: string }): Promise<string | null> {
  const response = await agendaPost(`/checklists/${params.checklistId}/items/${params.itemId}/toggle`, params.jwt, {});
  return response.ok ? null : (response.message ?? 'No se pudo marcar la tarea.');
}
