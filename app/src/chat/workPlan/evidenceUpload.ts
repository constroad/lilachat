import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { isUnreachable, supersededTicks, taskJobOf, type FieldJob, type FieldJobVerdict, type TaskJobPayload, type TimemarkStampAsked } from '@lilachat/shared';
import { enqueueFieldWork, fieldQueueNow, keepFieldFile, registerFieldHandler } from '../../spaces/clients/fieldQueueStore';
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

/** A refusal the person reads, or a retry when nothing came back (or the server was down). */
const verdictOfReply = (reply: { ok: boolean; status?: number; message?: string }, failed: string, done?: Record<string, string>): FieldJobVerdict => {
  const steps = done ? { done } : {};
  if (reply.ok) return { outcome: 'done' };
  if (isUnreachable(reply) || reply.status === 409 || reply.status === 401) return { outcome: 'retry', reached: reply.status !== undefined, ...steps };
  return { outcome: 'refuse', message: reply.message ?? failed, ...steps };
};

/**
 * The queue's sender of a task's evidence: the file goes up as a message of the channel (the job's key
 * is its `clientKey`: the server answers the same message on a resend), then that message is linked to
 * the task (the server links a `seq` once). The message's `seq` is kept, so a retry only links.
 */
async function sendEvidence(job: FieldJob, jwt: string): Promise<FieldJobVerdict> {
  const payload = job.payload as unknown as Extract<TaskJobPayload, { kind: 'task_evidence' }>;
  const file = job.files[0];
  let seq = Number(job.done.seq ?? 0);
  if (!seq) {
    if (!file) return { outcome: 'refuse', message: 'El archivo ya no está en el teléfono.' };
    const uploaded = await uploadMedia({ token: jwt, chatId: job.scope.chatId, clientKey: job.key, uri: file.ref, fileName: file.name, mimeType: file.mime, sizeBytes: file.sizeBytes ?? 0, ...(file.stamp ? { stamp: file.stamp } : {}), caption: `Evidencia · ${payload.taskText}` });
    if (!uploaded.ok) return uploaded.retryable ? { outcome: 'retry', reached: false } : { outcome: 'refuse', message: uploaded.reason };
    seq = uploaded.seq;
  }
  const linked = await agendaPost<{ ok: boolean }>(`/checklists/${payload.checklistId}/items/${payload.itemId}/evidence`, jwt, { seq });
  return verdictOfReply(linked, 'El archivo quedó en el chat, pero no se pudo unir a la tarea.', { seq: String(seq) });
}
registerFieldHandler('task_evidence', sendEvidence);

/**
 * Evidence of a task (pending 21, design e2-18): since 26/11 (José, a site without signal) the file is kept on
 * the phone and goes by the field queue. Returns an error to show, or null when it is queued or nothing was chosen.
 */
export async function attachEvidence(params: { jwt: string; chatId: string; checklistId: string; itemId: string; taskText: string; source: EvidenceSource; onProgress?: (ratio: number) => void }): Promise<string | null> {
  const file = params.source === 'camera' ? await shoot() : await pick(params.source);
  if (file === 'denied') return CAMERA_DENIED;
  if (!file) return null;
  const kept = await keepFieldFile({ uri: file.uri, name: file.fileName, mime: file.mimeType, ...(file.sizeBytes ? { sizeBytes: file.sizeBytes } : {}), ...(file.stamp ? { stamp: file.stamp } : {}) });
  const payload: TaskJobPayload = { kind: 'task_evidence', checklistId: params.checklistId, itemId: params.itemId, taskText: params.taskText };
  await enqueueFieldWork(taskJobOf({ key: Crypto.randomUUID(), chatId: params.chatId, payload, files: [kept], now: Date.now() }));
  return null;
}

/** Unlinks it from the task; the message stays in the chat. */
export async function detachEvidence(params: { jwt: string; checklistId: string; itemId: string; seq: number }): Promise<string | null> {
  const removed = await agendaDelete<{ ok: boolean }>(`/checklists/${params.checklistId}/items/${params.itemId}/evidence/${params.seq}`, params.jwt);
  return removed.ok ? null : (removed.message ?? 'No se pudo quitar el archivo.');
}

/** The queue's sender of a tick: it says the state it wants, so a resend never flips it back. */
async function sendTick(job: FieldJob, jwt: string): Promise<FieldJobVerdict> {
  const payload = job.payload as unknown as Extract<TaskJobPayload, { kind: 'task_toggle' }>;
  const response = await agendaPost(`/checklists/${payload.checklistId}/items/${payload.itemId}/toggle`, jwt, { done: payload.done });
  return verdictOfReply(response, 'No se pudo marcar la tarea.');
}
registerFieldHandler('task_toggle', sendTick);

/** Ticks or reopens a task (the plan's own route: the server checks who may), by the field queue since 26/11. */
export async function toggleTask(params: { chatId: string; checklistId: string; itemId: string; done: boolean }): Promise<string | null> {
  const job = taskJobOf({ key: Crypto.randomUUID(), chatId: params.chatId, payload: { kind: 'task_toggle', checklistId: params.checklistId, itemId: params.itemId, done: params.done }, files: [], now: Date.now() });
  await enqueueFieldWork(job, supersededTicks(fieldQueueNow(), job));
  return null;
}
