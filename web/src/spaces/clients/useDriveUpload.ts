import { useState } from 'react';
import { DRIVE_UPLOAD_DONE, driveUploadRequest, noticeOf, uploadToDrive, type DriveFileFacts, type DriveUpload, type DriveUploadDeps } from '@lilachat/shared';
import { submitAppForm } from '../../chat/commands/commandsApi';
import { shrinkPhotoBlob } from '../../chat/shrinkPhoto';
import { currentSocket } from '../../useSocket';
import { openReportForm } from './reports/reportsApi';
import type { ServiceAskTarget } from './useServiceAsk';

type DriveFile = { blob: Blob; name: string };
type UploadState = { sending: boolean; message: string; failed: boolean };
type UploadTarget = { target: ServiceAskTarget; chatId: string; serviceId: string; onDone: () => void };

const IDLE: UploadState = { sending: false, message: '', failed: false };

/** Straight to Portal: the file never goes through Lilachat, and no session travels with it. */
async function sendToDrive(upload: DriveUpload, file: DriveFile, clientUploadId: string): Promise<{ status?: number }> {
  const body = new FormData();
  Object.entries(upload.fields).forEach(([name, value]) => body.append(name, value));
  body.append('clientUploadId', clientUploadId);
  body.append(upload.fileField, file.blob, file.name);
  try {
    return { status: (await fetch(upload.url, { method: 'POST', body })).status };
  } catch {
    return {};
  }
}

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

async function prepared(file: File): Promise<{ source: DriveFile; facts: DriveFileFacts }> {
  if (file.type.startsWith('image/')) {
    const photo = await shrinkPhotoBlob(file, file.name);
    return { source: { blob: photo.blob, name: photo.name }, facts: { mime: photo.mime, sizeBytes: photo.blob.size } };
  }
  const seconds = file.type.startsWith('video/') ? await videoSecondsOf(file) : undefined;
  return { source: { blob: file, name: file.name }, facts: { mime: file.type, sizeBytes: file.size, ...(seconds === undefined ? {} : { seconds }) } };
}

const depsOf = ({ target, chatId, serviceId }: UploadTarget): DriveUploadDeps<DriveFile> => ({
  open: () => openReportForm(target, serviceId, driveUploadRequest()),
  submit: (commandId) => submitAppForm(target.jwt, { chatId }, commandId, {}),
  notice: (commandId) => noticeOf(currentSocket(), commandId),
  send: sendToDrive,
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
