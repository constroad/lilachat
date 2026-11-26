import { useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { documentTypeOf, DRIVE_DOCUMENT_MIME_TYPES, DRIVE_PASTE_EMPTY, DRIVE_QUEUED, DRIVE_UPLOAD_DONE, driveJobLabel, newFieldJob, watchFieldRun, type FieldJob, type FieldJobFile, type FieldRunWatch, DRIVE_VIDEO_SECONDS, driveUploadRequest, IMPORT_NOT_A_TRACE, importFileType, manualPhotoOf, OBSERVATION_VIDEO_SECONDS, type TraceUpload, noticeOf, uploadToDrive, type DriveFileFacts, type DriveUpload, type DriveUploadDeps, type EvidenceFile, type ManualPhotoUpload, type ObservationLiftRequest, type ObservationRegisterRequest, type ObservationWriteDeps, type AreaCreateRequest, type AreaEditRequest, type AreaRemoveRequest, stampFieldsOf, type GeoPoint, type ShotLabel, type TimemarkStampAsked } from '@lilachat/shared';
import * as FileSystem from 'expo-file-system/legacy';
import { submitAppForm } from '../../chat/commands/commandsApi';
import { openCamera, type CapturedShot } from '../../chat/camara/cameraRequests';
import { BASE_URL } from '../../api/client';
import { shrinkPhotoFile } from '../../chat/shrinkPhoto';
import { getSocket } from '../../chat/socketClient';
import { subirPorXhr } from '../../chat/subidaXhr';
import { openReportForm } from './reports/reportsApi';
import type { ServiceAskTarget } from './useServiceAsk';
import { clipboardImage } from './drivePaste';
import { enqueueFieldWork, keepFieldFile, onFieldJobDone, registerFieldHandler } from './fieldQueueStore';

export type DriveFile = { uri: string; name: string; mime: string; /** A shot of the new camera: our server burns it and forwards it (José 12/11). */ stamp?: TimemarkStampAsked };
type Sender = { jwt: string; chatId: string };
/** What a send needs of a Portal ticket: Drive's and the visit's (José 14/11) alike. */
type TicketTarget = Pick<DriveUpload, 'url' | 'fields' | 'fileField'>;
type UploadState = { sending: boolean; progress: number; message: string; failed: boolean };
type UploadTarget = { target: ServiceAskTarget; chatId: string; serviceId: string; onDone: () => void };

const IDLE: UploadState = { sending: false, progress: 0, message: '', failed: false };
const NOT_A_DOCUMENT = 'Solo se suben documentos PDF, Word, Excel o PowerPoint.';
/** A 60-second video on a field connection: 6 MB took 11 s from an office (06/11). */
const UPLOAD_TIMEOUT_MS = 10 * 60_000;
const CAMERA_DENIED = 'Lilachat necesita permiso para usar la cámara.';
const MS_PER_SECOND = 1000;

/**
 * Straight to Portal: the file never goes through Lilachat, and no session travels with it.
 * By XHR, as every upload of the app: `fetch` cannot send a file by its `uri` (`subidaXhr`).
 */
export async function sendToDrive(upload: TicketTarget, file: DriveFile, clientUploadId: string, onProgress: (ratio: number) => void, sender: Sender): Promise<{ status?: number; message?: string; mediaId?: string }> {
  const reply = file.stamp ? await sendStamped(upload, file, clientUploadId, onProgress, sender) : await subirPorXhr({ url: upload.url, form: ticketForm(upload, file, clientUploadId), timeoutMs: UPLOAD_TIMEOUT_MS, onProgress });
  if (reply.tipo === 'fallo') return { message: reply.motivo };
  const { message, mediaId } = reply.payload;
  return { status: reply.status, ...(typeof message === 'string' ? { message } : {}), ...(typeof mediaId === 'string' ? { mediaId } : {}) };
}

function ticketForm(upload: TicketTarget, file: DriveFile, clientUploadId: string): FormData {
  const form = new FormData();
  Object.entries(upload.fields).forEach(([name, value]) => form.append(name, value));
  form.append('clientUploadId', clientUploadId);
  form.append(upload.fileField, { uri: file.uri, name: file.name, type: file.mime } as unknown as Blob);
  return form;
}

/**
 * A shot of the new camera goes ONCE to Lilachat's server, whole: it burns the stamp while it
 * compresses it and forwards it to the same ticket, server to server (José 12/11, «ok si»).
 */
function sendStamped(upload: TicketTarget, file: DriveFile, clientUploadId: string, onProgress: (ratio: number) => void, sender: Sender) {
  const form = new FormData();
  form.append('target', upload.url);
  form.append('fileField', upload.fileField);
  form.append('fields', JSON.stringify(upload.fields));
  form.append('clientUploadId', clientUploadId);
  form.append('chatId', sender.chatId);
  Object.entries(stampFieldsOf(file.stamp)).forEach(([name, value]) => form.append(name, value));
  form.append('file', { uri: file.uri, name: file.name, type: file.mime } as unknown as Blob);
  return subirPorXhr({ url: `${BASE_URL}/api/stamped-forward`, token: sender.jwt, form, timeoutMs: UPLOAD_TIMEOUT_MS, onProgress });
}

/** A shot of the new camera: whole (the server shrinks it once), with its length for the ticket's limit. */
async function preparedShot(shot: CapturedShot): Promise<{ source: DriveFile; facts: DriveFileFacts }> {
  const info = await FileSystem.getInfoAsync(shot.uri).catch(() => null);
  const sizeBytes = info?.exists && typeof info.size === 'number' ? info.size : undefined;
  const name = `${shot.mime.startsWith('video/') ? 'video' : 'foto'}-${Date.now()}.${shot.mime.split('/')[1]}`;
  return { source: { uri: shot.uri, name, mime: shot.mime, stamp: shot.stamp }, facts: { mime: shot.mime, ...(sizeBytes ? { sizeBytes } : {}), ...(shot.seconds ? { seconds: shot.seconds } : {}) } };
}

/** A photo leaves at Portal's size; a video goes as it is, with its length for the ticket's limit. */
async function prepared(asset: ImagePicker.ImagePickerAsset): Promise<{ source: DriveFile; facts: DriveFileFacts }> {
  const isVideo = asset.type === 'video';
  const mime = asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg');
  const name = asset.fileName ?? `archivo.${mime.split('/')[1]}`;
  if (isVideo) return { source: { uri: asset.uri, name, mime }, facts: { mime, ...(asset.fileSize ? { sizeBytes: asset.fileSize } : {}), ...(asset.duration ? { seconds: asset.duration / MS_PER_SECOND } : {}) } };
  const photo = await shrinkPhotoFile({ uri: asset.uri, mimeType: mime, fileName: name, sizeBytes: asset.fileSize ?? 0, width: asset.width, height: asset.height });
  return { source: { uri: photo.uri, name: photo.fileName, mime: photo.mimeType }, facts: { mime: photo.mimeType, sizeBytes: photo.sizeBytes } };
}

const depsOf = ({ target, chatId, serviceId }: Omit<UploadTarget, 'onDone'>, onProgress: (ratio: number) => void): DriveUploadDeps<DriveFile> => ({
  open: () => openReportForm(target, serviceId, driveUploadRequest()),
  submit: (commandId) => submitAppForm(target.jwt, { chatId }, commandId, {}),
  notice: (commandId) => noticeOf(getSocket(), commandId),
  send: (upload, file, clientUploadId) => sendToDrive(upload, file, clientUploadId, onProgress, { jwt: target.jwt, chatId }),
});

/** Each step tells the watch what it got, so the queue knows «no signal» from «Portal said no». */
function watched<F>(deps: DriveUploadDeps<F>, watch: FieldRunWatch): DriveUploadDeps<F> {
  return {
    open: async () => {
      const opened = await deps.open();
      watch.open({ ok: opened.ok, status: (opened as { status?: number }).status });
      return opened;
    },
    submit: async (commandId) => {
      const reply = await deps.submit(commandId);
      watch.submit(reply);
      return reply;
    },
    notice: async (commandId) => {
      const heard = await deps.notice(commandId);
      watch.notice(heard !== null);
      return heard;
    },
    send: async (ticket, file, clientUploadId) => {
      const sent = await deps.send(ticket, file, clientUploadId);
      watch.send(sent.status);
      return sent;
    },
  };
}

/** One kept file to the service's Drive with its own key as `clientUploadId` (Portal answers the same file on a resend). */
export function uploadKeptFile(file: FieldJobFile, scope: FieldJob['scope'], jwt: string, watch: FieldRunWatch, clientUploadId: string = file.key) {
  const { spaceId, clientId, serviceId, chatId } = scope;
  const deps = watched(depsOf({ target: { jwt, spaceId, clientId }, chatId, serviceId }, () => undefined), watch);
  const source: DriveFile = { uri: file.ref, name: file.name, mime: file.mime, ...(file.stamp ? { stamp: file.stamp } : {}) };
  const facts: DriveFileFacts = { mime: file.mime, ...(file.sizeBytes ? { sizeBytes: file.sizeBytes } : {}), ...(file.seconds ? { seconds: file.seconds } : {}) };
  return uploadToDrive(deps, { source, facts }, clientUploadId);
}

/** The queue's sender of a Drive file: the same ticket and send, the job's key as `clientUploadId` (Portal dedupes it). */
export async function sendDriveJob(job: FieldJob, jwt: string) {
  const file = job.files[0];
  if (!file) return { outcome: 'refuse' as const, message: 'El archivo ya no está en el teléfono.' };
  const watch = watchFieldRun();
  return watch.verdictOf(await uploadKeptFile(file, job.scope, jwt, watch, job.key));
}
registerFieldHandler('drive_file', sendDriveJob);

/**
 * A photo, video or document to the service's Drive (José, 06/11). Since 26/11 (José, a site
 * without signal) it is kept on the phone and goes by the field queue, with or without signal: one
 * way to write, one rule of error. The list is asked again when a file of this service landed.
 */
export function useDriveUpload(upload: UploadTarget) {
  const [state, setState] = useState<UploadState>(IDLE);
  const { serviceId } = upload;
  const onDone = useRef(upload.onDone);
  onDone.current = upload.onDone;
  useEffect(() => {
    const stop = onFieldJobDone((job) => {
      if (job.kind !== 'drive_file' || job.scope.serviceId !== serviceId) return;
      setState({ ...IDLE, message: DRIVE_UPLOAD_DONE });
      onDone.current();
    });
    return () => void stop();
  }, [serviceId]);
  const sendFile = async (ready: Promise<{ source: DriveFile; facts: DriveFileFacts }>) => {
    setState({ ...IDLE, sending: true });
    try {
      const { source, facts } = await ready;
      const kept = await keepFieldFile({ uri: source.uri, name: source.name, mime: source.mime, ...(facts.sizeBytes ? { sizeBytes: facts.sizeBytes } : {}), ...(facts.seconds ? { seconds: facts.seconds } : {}), ...(source.stamp ? { stamp: source.stamp } : {}) });
      const scope = { spaceId: upload.target.spaceId, clientId: upload.target.clientId, serviceId, chatId: upload.chatId };
      await enqueueFieldWork(newFieldJob({ key: Crypto.randomUUID(), kind: 'drive_file', scope, label: driveJobLabel(source.mime), payload: {}, files: [kept], now: Date.now() }));
      setState({ ...IDLE, message: DRIVE_QUEUED });
    } catch (error) {
      console.warn('drive: keep file', error instanceof Error ? error.name : 'unknown');
      setState({ ...IDLE, message: 'No se pudo guardar el archivo en el teléfono.', failed: true });
    }
  };
  const fromGallery = async (picked: ImagePicker.ImagePickerResult) => {
    const asset = picked.canceled ? null : picked.assets[0];
    if (asset) await sendFile(prepared(asset));
  };
  // José 12/11: the Drive's photos and videos come from the new camera, with its stamp.
  const fromCamera = async (video: boolean) => {
    const shot = await openCamera({ title: video ? 'Video al Drive' : 'Foto al Drive', video: { maxSeconds: DRIVE_VIDEO_SECONDS, first: video } });
    if (shot === 'denied') return setState({ ...IDLE, message: CAMERA_DENIED, failed: true });
    if (shot) await sendFile(preparedShot(shot));
  };
  // Jeremy via José 13/11: a PDF, Word, Excel or PowerPoint to the Drive too.
  const fromFiles = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: [...DRIVE_DOCUMENT_MIME_TYPES] });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return;
    const mime = documentTypeOf(asset.name, asset.mimeType ?? '');
    if (!mime) return setState({ ...IDLE, message: NOT_A_DOCUMENT, failed: true });
    await sendFile(Promise.resolve({ source: { uri: asset.uri, name: asset.name, mime }, facts: { mime, ...(asset.size ? { sizeBytes: asset.size } : {}) } }));
  };
  // José 19/11 (design cc-05): «Pegar del portapapeles», a copied image goes up like a gallery photo.
  const fromClipboard = async () => {
    const image = await clipboardImage().catch((error: Error) => (console.warn('drive: clipboard image', error.name), null));
    if (!image) return setState({ ...IDLE, message: DRIVE_PASTE_EMPTY, failed: true });
    await sendFile(shrinkPhotoFile({ uri: image.uri, mimeType: image.mime, fileName: image.name, sizeBytes: 0, width: image.width, height: image.height }).then((photo) => ({ source: { uri: photo.uri, name: photo.fileName, mime: photo.mimeType }, facts: { mime: photo.mimeType, sizeBytes: photo.sizeBytes } })));
  };
  return {
    ...state,
    pasteImage: () => void fromClipboard(),
    pickDocument: () => void fromFiles(),
    takePhoto: () => void fromCamera(false),
    recordVideo: () => void fromCamera(true),
    pickFromGallery: () => void ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 1 }).then(fromGallery),
  };
}

/** A photo of «Registrar avance» (o-06): to the service's Drive first, its id rides with the progress. */
export const mapPhotoUploader = (target: ServiceAskTarget, chatId: string, serviceId: string): ManualPhotoUpload<CapturedShot> => async (shot) =>
  manualPhotoOf(await uploadToDrive(depsOf({ target, chatId, serviceId }, () => undefined), await preparedShot(shot), Crypto.randomUUID()));

/** A field photo for «Registrar avance» (o-06) from the new camera (José 12/11); null when the person closes it. */
export async function takeFieldPhoto(): Promise<{ shot: CapturedShot } | { message: string } | null> {
  const shot = await openCamera({ title: 'Foto del avance' });
  if (shot === 'denied') return { message: CAMERA_DENIED };
  return shot ? { shot } : null;
}

export type TraceFile = { uri: string; name: string; type: string; sizeBytes?: number };

/** A KMZ or KML from the phone's files for «Importar» (o-12); null when the person cancels. */
export async function pickTraceFile(): Promise<TraceFile | null> {
  const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: '*/*' });
  const asset = picked.canceled ? null : picked.assets[0];
  return asset ? { uri: asset.uri, name: asset.name, type: asset.mimeType ?? '', ...(asset.size ? { sizeBytes: asset.size } : {}) } : null;
}

/** The trace to the service's Drive: its type by the name, since Android often sends a .kmz as anything. */
export const mapTraceUploader = (target: ServiceAskTarget, chatId: string, serviceId: string): TraceUpload<TraceFile> => async (file) => {
  const mime = importFileType(file.name, file.type);
  if (!mime) return { ok: false, message: IMPORT_NOT_A_TRACE };
  const source = { uri: file.uri, name: file.name, mime };
  const facts = { mime, ...(file.sizeBytes ? { sizeBytes: file.sizeBytes } : {}) };
  return manualPhotoOf(await uploadToDrive(depsOf({ target, chatId, serviceId }, () => undefined), { source, facts }, Crypto.randomUUID()));
};

/** A photo or video of an observation as the screen shows it before it leaves the phone. */
export type EvidencePreview = { uri: string; mime: string; seconds?: number };
export type CapturedEvidence = { file: EvidenceFile<DriveFile>; preview: EvidencePreview };

/**
 * One photo or one video of an observation (José 11/11, designs `ob-02` and `ob-03`) from the new
 * camera with its stamp (José 12/11); a video stops at 30 s. Null when the person closes it.
 */
export async function captureEvidence(kind: 'photo' | 'video', title?: string): Promise<CapturedEvidence | { message: string } | null> {
  const shot = await openCamera({ title: title ?? (kind === 'video' ? 'Video de la observación' : 'Foto de la observación'), video: { maxSeconds: OBSERVATION_VIDEO_SECONDS, first: kind === 'video' } });
  if (shot === 'denied') return { message: CAMERA_DENIED };
  if (!shot) return null;
  const ready = await preparedShot(shot);
  const preview = { uri: ready.source.uri, mime: ready.facts.mime, ...(ready.facts.seconds ? { seconds: ready.facts.seconds } : {}) };
  return { file: { key: Crypto.randomUUID(), ...ready }, preview };
}

/**
 * The AR's own frame with the trace as the zone's photo (José 15/11): no second camera after
 * marking. It goes stamped like a camera shot, so the server burns the same hour and place.
 */
export async function arShotEvidence(uri: string, point: GeoPoint | null, logo: boolean): Promise<CapturedEvidence> {
  const takenAt = new Date().toISOString();
  const ready = await preparedShot({ uri, mime: 'image/jpeg', stamp: { timemark: true, point, logo, takenAt } });
  return { file: { key: Crypto.randomUUID(), ...ready }, preview: { uri: ready.source.uri, mime: ready.facts.mime } };
}

/** The AR shot with each side's meters for the server to burn (José 15/11); another photo goes as it is. */
export function withShotLabels(evidence: CapturedEvidence, labels: readonly ShotLabel[], panel: readonly string[] = []): CapturedEvidence {
  const stamp = evidence.file.source.stamp;
  if (!stamp || (!labels.length && !panel.length)) return evidence;
  return { ...evidence, file: { ...evidence.file, source: { ...evidence.file.source, stamp: { ...stamp, labels, panel } } } };
}

/** An observation's write from this phone: the run of the client's app, its answer, and each file straight to Portal. */
export const observationWriteDeps = (to: Omit<UploadTarget, 'onDone'>, request: ObservationRegisterRequest | ObservationLiftRequest | AreaCreateRequest | AreaEditRequest | AreaRemoveRequest): ObservationWriteDeps<DriveFile> => ({
  open: () => openReportForm(to.target, to.serviceId, request),
  submit: (commandId, values) => submitAppForm(to.target.jwt, { chatId: to.chatId }, commandId, values),
  notice: (commandId) => noticeOf(getSocket(), commandId),
  send: (upload, file, clientUploadId) => sendToDrive(upload, file, clientUploadId, () => undefined, { jwt: to.target.jwt, chatId: to.chatId }),
});

