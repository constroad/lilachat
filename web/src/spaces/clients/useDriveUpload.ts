import { useState } from 'react';
import { documentTypeOf, stampFieldsOf, type TimemarkStampAsked, DRIVE_UPLOAD_DONE, driveUploadRequest, IMPORT_NOT_A_TRACE, importFileType, manualPhotoOf, type TraceUpload, noticeOf, uploadToDrive, type DriveFileFacts, type DriveUpload, type DriveUploadDeps, type ManualPhotoUpload, type AreaCreateRequest, type AreaRemoveRequest, type ObservationLiftRequest, type ObservationRegisterRequest, type ObservationWriteDeps } from '@lilachat/shared';
import { submitAppForm } from '../../chat/commands/commandsApi';
import { shrinkPhotoBlob } from '../../chat/shrinkPhoto';
import { stampOfFile } from '../../chat/camera/shotStamp';
import { currentSocket } from '../../useSocket';
import { openReportForm } from './reports/reportsApi';
import type { ServiceAskTarget } from './useServiceAsk';

export type DriveFile = { blob: Blob; name: string; /** Lilachat's camera: the server burns it on the way (`/api/stamped-forward`). */ stamp?: TimemarkStampAsked };
type Sender = { jwt: string; chatId: string };
/** What a send needs of a Portal ticket: Drive's and the visit's (José 14/11) alike. */
type TicketTarget = Pick<DriveUpload, 'url' | 'fields' | 'fileField'>;
type UploadState = { sending: boolean; message: string; failed: boolean };
type UploadTarget = { target: ServiceAskTarget; chatId: string; serviceId: string; onDone: () => void };

const IDLE: UploadState = { sending: false, message: '', failed: false };

/** Straight to Portal: the file never goes through Lilachat, and no session travels with it. */
async function sendToDrive(upload: TicketTarget, file: DriveFile, clientUploadId: string, fields?: Record<string, string>): Promise<{ status?: number; message?: string; mediaId?: string }> {
  const body = new FormData();
  Object.entries(upload.fields).forEach(([name, value]) => body.append(name, value));
  body.append('clientUploadId', clientUploadId);
  // The file's own fields (`captura` on the Medición picture, 12/11) after the ticket's: they never replace them.
  Object.entries(fields ?? {}).forEach(([name, value]) => body.append(name, value));
  body.append(upload.fileField, file.blob, file.name);
  try {
    const response = await fetch(upload.url, { method: 'POST', body });
    const { message, mediaId } = (await response.json().catch(() => ({}))) as { message?: unknown; mediaId?: unknown };
    return { status: response.status, ...(typeof message === 'string' ? { message } : {}), ...(typeof mediaId === 'string' ? { mediaId } : {}) };
  } catch {
    return {};
  }
}

/**
 * A shot of Lilachat's camera goes ONCE to Lilachat's server, whole: it burns the stamp while it
 * compresses it and forwards it to the same ticket, server to server (as the APK, José 12/11).
 */
async function sendStamped(upload: TicketTarget, file: DriveFile, clientUploadId: string, sender: Sender): Promise<{ status?: number; message?: string; mediaId?: string }> {
  const body = new FormData();
  body.append('target', upload.url);
  body.append('fileField', upload.fileField);
  body.append('fields', JSON.stringify(upload.fields));
  body.append('clientUploadId', clientUploadId);
  body.append('chatId', sender.chatId);
  Object.entries(stampFieldsOf(file.stamp)).forEach(([name, value]) => body.append(name, value));
  body.append('file', file.blob, file.name);
  try {
    const response = await fetch('/api/stamped-forward', { method: 'POST', headers: { Authorization: `Bearer ${sender.jwt}` }, body });
    const { message, mediaId } = (await response.json().catch(() => ({}))) as { message?: unknown; mediaId?: unknown };
    return { status: response.status, ...(typeof message === 'string' ? { message } : {}), ...(typeof mediaId === 'string' ? { mediaId } : {}) };
  } catch {
    return {};
  }
}

export const sendFor = (sender: Sender) => (upload: TicketTarget, file: DriveFile, clientUploadId: string, fields?: Record<string, string>) =>
  file.stamp ? sendStamped(upload, file, clientUploadId, sender) : sendToDrive(upload, file, clientUploadId, fields);

/** How long a video lasts, from its header. A browser that cannot read it leaves the question to Portal. */
function videoSecondsOf(file: Blob): Promise<number | undefined> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const address = URL.createObjectURL(file);
    const finish = (seconds?: number) => {
      URL.revokeObjectURL(address);
      resolve(seconds);
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () => finish(Number.isFinite(video.duration) ? video.duration : undefined);
    video.onerror = () => finish();
    video.src = address;
  });
}

/** A photo leaves at Portal's size; a video goes as it is, with its length when the browser reads it. */
export async function prepared(file: File): Promise<{ source: DriveFile; facts: DriveFileFacts }> {
  const stamp = stampOfFile(file);
  if (stamp) return preparedShot(file, stamp);
  // A document goes with its real type: a browser often leaves a PDF or an Excel without one (Jeremy, 13/11).
  const document = documentTypeOf(file.name, file.type);
  if (document) return { source: { blob: new Blob([file], { type: document }), name: file.name }, facts: { mime: document, sizeBytes: file.size } };
  if (file.type.startsWith('image/')) {
    const photo = await shrinkPhotoBlob(file, file.name);
    return { source: { blob: photo.blob, name: photo.name }, facts: { mime: photo.mime, sizeBytes: photo.blob.size } };
  }
  const seconds = file.type.startsWith('video/') ? await videoSecondsOf(file) : undefined;
  return { source: { blob: file, name: file.name }, facts: { mime: file.type, sizeBytes: file.size, ...(seconds === undefined ? {} : { seconds }) } };
}

/** A shot of the camera: whole (the server shrinks it once), and a video as the MP4 the server turns it into. */
async function preparedShot(file: File, stamp: TimemarkStampAsked): Promise<{ source: DriveFile; facts: DriveFileFacts }> {
  const video = file.type.startsWith('video/');
  const seconds = video ? await videoSecondsOf(file) : undefined;
  return { source: { blob: file, name: file.name, stamp }, facts: { mime: video ? 'video/mp4' : file.type, sizeBytes: file.size, ...(seconds === undefined ? {} : { seconds }) } };
}

const depsOf = ({ target, chatId, serviceId }: Omit<UploadTarget, 'onDone'>): DriveUploadDeps<DriveFile> => ({
  open: () => openReportForm(target, serviceId, driveUploadRequest()),
  submit: (commandId) => submitAppForm(target.jwt, { chatId }, commandId, {}),
  notice: (commandId) => noticeOf(currentSocket(), commandId),
  send: sendFor({ jwt: target.jwt, chatId }),
});

/** A photo or a video to the service's Drive (José, 06/11). The list is asked again when it landed. */
export function useDriveUpload(upload: UploadTarget) {
  const [state, setState] = useState<UploadState>(IDLE);
  const send = async (file: File) => {
    setState({ ...IDLE, sending: true });
    const result = await uploadToDrive(depsOf(upload), await prepared(file), crypto.randomUUID());
    setState(result.ok ? { ...IDLE, message: DRIVE_UPLOAD_DONE } : { sending: false, message: result.message, failed: true });
    if (result.ok) upload.onDone();
  };
  return { ...state, send };
}

/** A photo of «Registrar avance» (o-06): to the service's Drive first, its id rides with the progress. */
export const mapPhotoUploader = (target: ServiceAskTarget, chatId: string, serviceId: string): ManualPhotoUpload<File> => async (file) =>
  manualPhotoOf(await uploadToDrive(depsOf({ target, chatId, serviceId }), await prepared(file), crypto.randomUUID()));

/** A KMZ or KML for «Importar» (o-12): its type by the name, since browsers often leave it blank. */
export const mapTraceUploader = (target: ServiceAskTarget, chatId: string, serviceId: string): TraceUpload<File> => async (file) => {
  const mime = importFileType(file.name, file.type);
  if (!mime) return { ok: false, message: IMPORT_NOT_A_TRACE };
  const source = { blob: file, name: file.name };
  return manualPhotoOf(await uploadToDrive(depsOf({ target, chatId, serviceId }), { source, facts: { mime, sizeBytes: file.size } }, crypto.randomUUID()));
};

/** An observation's or an area's write from the browser (an iPhone's PWA is the field's form too): the run, its answer and each file straight to Portal. */
export const observationWriteDeps = (to: Omit<UploadTarget, 'onDone'>, request: ObservationRegisterRequest | ObservationLiftRequest | AreaCreateRequest | AreaRemoveRequest): ObservationWriteDeps<DriveFile> => ({
  open: () => openReportForm(to.target, to.serviceId, request),
  submit: (commandId, values) => submitAppForm(to.target.jwt, { chatId: to.chatId }, commandId, values),
  notice: (commandId) => noticeOf(currentSocket(), commandId),
  send: sendFor({ jwt: to.target.jwt, chatId: to.chatId }),
});

