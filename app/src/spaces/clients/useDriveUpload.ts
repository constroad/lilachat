import { useState } from 'react';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { DRIVE_UPLOAD_DONE, DRIVE_VIDEO_SECONDS, driveUploadRequest, manualPhotoOf, noticeOf, uploadToDrive, type DriveFileFacts, type DriveUpload, type DriveUploadDeps, type ManualPhotoUpload } from '@lilachat/shared';
import { submitAppForm } from '../../chat/commands/commandsApi';
import { shrinkPhotoFile } from '../../chat/shrinkPhoto';
import { getSocket } from '../../chat/socketClient';
import { subirPorXhr } from '../../chat/subidaXhr';
import { openReportForm } from './reports/reportsApi';
import type { ServiceAskTarget } from './useServiceAsk';

type DriveFile = { uri: string; name: string; mime: string };
type UploadState = { sending: boolean; progress: number; message: string; failed: boolean };
type UploadTarget = { target: ServiceAskTarget; chatId: string; serviceId: string; onDone: () => void };

const IDLE: UploadState = { sending: false, progress: 0, message: '', failed: false };
/** A 60-second video on a field connection: 6 MB took 11 s from an office (06/11). */
const UPLOAD_TIMEOUT_MS = 10 * 60_000;
const CAMERA_DENIED = 'Lilachat necesita permiso para usar la cámara.';
const MS_PER_SECOND = 1000;

/**
 * Straight to Portal: the file never goes through Lilachat, and no session travels with it.
 * By XHR, as every upload of the app: `fetch` cannot send a file by its `uri` (`subidaXhr`).
 */
async function sendToDrive(upload: DriveUpload, file: DriveFile, clientUploadId: string, onProgress: (ratio: number) => void): Promise<{ status?: number; message?: string; mediaId?: string }> {
  const form = new FormData();
  Object.entries(upload.fields).forEach(([name, value]) => form.append(name, value));
  form.append('clientUploadId', clientUploadId);
  form.append(upload.fileField, { uri: file.uri, name: file.name, type: file.mime } as unknown as Blob);
  const reply = await subirPorXhr({ url: upload.url, form, timeoutMs: UPLOAD_TIMEOUT_MS, onProgress });
  if (reply.tipo === 'fallo') return { message: reply.motivo };
  const { message, mediaId } = reply.payload;
  return { status: reply.status, ...(typeof message === 'string' ? { message } : {}), ...(typeof mediaId === 'string' ? { mediaId } : {}) };
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
  send: (upload, file, clientUploadId) => sendToDrive(upload, file, clientUploadId, onProgress),
});

/** A photo or a video to the service's Drive (José, 06/11). The list is asked again when it landed. */
export function useDriveUpload(upload: UploadTarget) {
  const [state, setState] = useState<UploadState>(IDLE);
  const send = async (picked: ImagePicker.ImagePickerResult) => {
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return;
    setState({ ...IDLE, sending: true });
    const showProgress = (progress: number) => setState((current) => ({ ...current, progress }));
    const result = await uploadToDrive(depsOf(upload, showProgress), await prepared(asset), Crypto.randomUUID());
    setState(result.ok ? { ...IDLE, message: DRIVE_UPLOAD_DONE } : { ...IDLE, message: result.message, failed: true });
    if (result.ok) upload.onDone();
  };
  const fromCamera = async (mediaTypes: ImagePicker.MediaType[]) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return setState({ ...IDLE, message: CAMERA_DENIED, failed: true });
    await send(await ImagePicker.launchCameraAsync({ mediaTypes, quality: 1, videoMaxDuration: DRIVE_VIDEO_SECONDS }));
  };
  return {
    ...state,
    takePhoto: () => void fromCamera(['images']),
    recordVideo: () => void fromCamera(['videos']),
    pickFromGallery: () => void ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 1 }).then(send),
  };
}

/** A photo of «Registrar avance» (o-06): to the service's Drive first, its id rides with the progress. */
export const mapPhotoUploader = (target: ServiceAskTarget, chatId: string, serviceId: string): ManualPhotoUpload<ImagePicker.ImagePickerAsset> => async (asset) =>
  manualPhotoOf(await uploadToDrive(depsOf({ target, chatId, serviceId }, () => undefined), await prepared(asset), Crypto.randomUUID()));

/** A field photo for «Registrar avance» (o-06), from the camera's door; null when the person cancels. */
export async function takeFieldPhoto(): Promise<{ asset: ImagePicker.ImagePickerAsset } | { message: string } | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { message: CAMERA_DENIED };
  const picked = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = picked.canceled ? null : picked.assets[0];
  return asset ? { asset } : null;
}
