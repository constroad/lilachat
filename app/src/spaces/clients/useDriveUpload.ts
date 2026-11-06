import { useState } from 'react';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { DRIVE_UPLOAD_DONE, DRIVE_VIDEO_SECONDS, driveUploadRequest, noticeOf, uploadToDrive, type DriveFileFacts, type DriveUpload, type DriveUploadDeps } from '@lilachat/shared';
import { submitAppForm } from '../../chat/commands/commandsApi';
import { shrinkPhotoFile } from '../../chat/shrinkPhoto';
import { getSocket } from '../../chat/socketClient';
import { openReportForm } from './reports/reportsApi';
import type { ServiceAskTarget } from './useServiceAsk';

type DriveFile = { uri: string; name: string; mime: string };
type UploadState = { sending: boolean; message: string; failed: boolean };
type UploadTarget = { target: ServiceAskTarget; chatId: string; serviceId: string; onDone: () => void };

const IDLE: UploadState = { sending: false, message: '', failed: false };
const CAMERA_DENIED = 'Lilachat necesita permiso para usar la cámara.';
const MS_PER_SECOND = 1000;

/** Straight to Portal: the file never goes through Lilachat, and no session travels with it. */
async function sendToDrive(upload: DriveUpload, file: DriveFile, clientUploadId: string): Promise<{ status?: number }> {
  const body = new FormData();
  Object.entries(upload.fields).forEach(([name, value]) => body.append(name, value));
  body.append('clientUploadId', clientUploadId);
  body.append(upload.fileField, { uri: file.uri, name: file.name, type: file.mime } as unknown as Blob);
  try {
    return { status: (await fetch(upload.url, { method: 'POST', body })).status };
  } catch {
    return {};
  }
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

const depsOf = ({ target, chatId, serviceId }: UploadTarget): DriveUploadDeps<DriveFile> => ({
  open: () => openReportForm(target, serviceId, driveUploadRequest()),
  submit: (commandId) => submitAppForm(target.jwt, { chatId }, commandId, {}),
  notice: (commandId) => noticeOf(getSocket(), commandId),
  send: sendToDrive,
});

/** A photo or a video to the service's Drive (José, 06/11). The list is asked again when it landed. */
export function useDriveUpload(upload: UploadTarget) {
  const [state, setState] = useState<UploadState>(IDLE);
  const send = async (picked: ImagePicker.ImagePickerResult) => {
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return;
    setState({ ...IDLE, sending: true });
    const result = await uploadToDrive(depsOf(upload), await prepared(asset), Crypto.randomUUID());
    setState(result.ok ? { ...IDLE, message: DRIVE_UPLOAD_DONE } : { sending: false, message: result.message, failed: true });
    if (result.ok) upload.onDone();
  };
  const fromCamera = async (mediaTypes: ImagePicker.MediaType[]) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return setState({ sending: false, message: CAMERA_DENIED, failed: true });
    await send(await ImagePicker.launchCameraAsync({ mediaTypes, quality: 1, videoMaxDuration: DRIVE_VIDEO_SECONDS }));
  };
  return {
    ...state,
    takePhoto: () => void fromCamera(['images']),
    recordVideo: () => void fromCamera(['videos']),
    pickFromGallery: () => void ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 1 }).then(send),
  };
}
