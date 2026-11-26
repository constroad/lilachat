import { MANUAL_PHOTOS_MAX, manualPhotoOf, newFieldJob, sendWorkManualProgress, watchFieldRun, type FieldJob, type FieldJobFile, type FieldJobVerdict, type WorkManualProgressRequest, type WorkProgressDeps } from '@lilachat/shared';
import * as Crypto from 'expo-crypto';
import type { CapturedShot } from '../../../chat/camara/cameraRequests';
import { enqueueFieldWork, keepFieldFile, registerFieldHandler } from '../fieldQueueStore';
import { watchedDoor } from '../watchedDoor';
import type { ServiceScope } from '../serviceScope';
import { uploadKeptFile } from '../useDriveUpload';

/**
 * «Registrar avance» (o-06) without signal (José 26/11): the progress and its field photos are one job.
 * Each photo goes to the service's Drive first with its own key (its `mediaId` is kept, so a retry
 * never uploads it twice), then the progress with those ids; Portal answers a resend of the same
 * `entry_id` as already marked.
 */
type ProgressPayload = { request: WorkManualProgressRequest; note: string };
export const MANUAL_QUEUED = 'Avance guardado en el teléfono. Sale solo apenas haya señal y espera la aprobación de un administrador.';

async function sendProgress(job: FieldJob, jwt: string): Promise<FieldJobVerdict> {
  const { request, note } = job.payload as unknown as ProgressPayload;
  const watch = watchFieldRun();
  const done = { ...job.done };
  for (const file of job.files) {
    if (done[file.key]) continue;
    const photo = manualPhotoOf(await uploadKeptFile(file, job.scope, jwt, watch));
    if (!photo.ok) return watch.verdictOf(photo, done);
    done[file.key] = photo.mediaId;
  }
  const photoIds = [...request.photo_ids, ...job.files.map((file) => done[file.key]!)].slice(0, MANUAL_PHOTOS_MAX);
  const deps: WorkProgressDeps = watchedDoor(job, jwt, watch, { ...request, photo_ids: photoIds });
  const sent = await sendWorkManualProgress(deps, note);
  return sent.ok ? { outcome: 'done' } : watch.verdictOf(sent, done);
}
registerFieldHandler('map_progress', sendProgress);

/** Saves the progress and its photos on the phone; the job's key is the progress's `entry_id`. */
export async function enqueueManualProgress(scope: ServiceScope, request: WorkManualProgressRequest, note: string, shots: readonly CapturedShot[]): Promise<void> {
  const files: FieldJobFile[] = await Promise.all(shots.map((shot) => keepFieldFile({ uri: shot.uri, name: `avance-${Date.now()}.${shot.mime.split('/')[1] ?? 'jpg'}`, mime: shot.mime, ...(shot.stamp ? { stamp: shot.stamp } : {}) })));
  const jobScope = { spaceId: scope.target.spaceId, clientId: scope.target.clientId, serviceId: scope.serviceId, chatId: scope.chatId };
  await enqueueFieldWork(newFieldJob({ key: request.entry_id || Crypto.randomUUID(), kind: 'map_progress', scope: jobScope, label: 'Avance de obra', payload: { request, note } as unknown as Record<string, unknown>, files, now: Date.now() }));
}
