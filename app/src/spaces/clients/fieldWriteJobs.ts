import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { fieldWriteJobOf, fieldWriteKindOf, isDirectFieldWrite, isUnreachable, sendMapTool, watchFieldRun, type ReportFormRequest, writeWithFiles, type EvidenceFile, type FieldJob, type FieldJobVerdict, type FieldWriteName, type FieldWritePayload, type FormFilesWriteDeps } from '@lilachat/shared';
import { enqueueFieldWork, keepFieldFile, registerFieldHandler } from './fieldQueueStore';
import { watchedDoor } from './watchedDoor';
import { sendToDrive, type CapturedEvidence, type DriveFile } from './useDriveUpload';
import type { ServiceAskTarget } from './useServiceAsk';
import { spaceDiskKey } from '../spaceCache';

/** Where an observation or an area is written: the client's channel and its service. */
type WriteTarget = { target: ServiceAskTarget; chatId: string; serviceId: string };
export const FIELD_WRITE_QUEUED = 'Guardado en el teléfono. Sale solo apenas haya señal.';
const DIRECT_WRITE_FAILED = 'El Portal no aceptó el cambio del área.';

/** The queue's sender: the same write the screen did, every step told to the watch. */
async function sendFieldWrite(job: FieldJob, jwt: string): Promise<FieldJobVerdict> {
  const payload = job.payload as unknown as FieldWritePayload;
  const { chatId } = job.scope;
  const watch = watchFieldRun();
  const door = watchedDoor(job, jwt, watch, payload.request as ReportFormRequest);
  if (isDirectFieldWrite(payload.request)) {
    // An area's edit or removal: Portal's «Hecho» is all there is to read.
    const sent = await sendMapTool(door, payload.values, { sent: '', failed: DIRECT_WRITE_FAILED });
    return sent.ok ? { outcome: 'done' } : watch.verdictOf(sent);
  }
  const deps: FormFilesWriteDeps<DriveFile> = {
    ...door,
    send: async (upload, file, clientUploadId) => {
      const sent = await sendToDrive(upload, file, clientUploadId, () => undefined, { jwt, chatId });
      watch.send(sent.status);
      return sent;
    },
  };
  const files: EvidenceFile<DriveFile>[] = job.files.map((file) => ({
    key: file.key,
    source: { uri: file.ref, name: file.name, mime: file.mime, ...(file.stamp ? { stamp: file.stamp } : {}) },
    facts: { mime: file.mime, ...(file.sizeBytes ? { sizeBytes: file.sizeBytes } : {}), ...(file.seconds ? { seconds: file.seconds } : {}) },
    ...(payload.fileFields[file.key] ? { fields: payload.fileFields[file.key] } : {}),
  }));
  const result = await writeWithFiles(deps, payload.values, files, fieldWriteKindOf(payload.write));
  if (!result.ok) return watch.verdictOf(result);
  // The record landed; a file that did not goes again with its own key (Portal keeps the ones it has).
  return result.failed.length ? watch.verdictOf({ ok: false, message: result.failed[0]!.message }) : { outcome: 'done' };
}
registerFieldHandler('observation', sendFieldWrite);

/** Saves the write and its files on the phone; it leaves by the field queue, with signal or without it. */
export async function enqueueFieldWrite(to: WriteTarget, write: FieldWriteName, request: { kind: string; entry_id?: string }, values: Record<string, string>, evidence: readonly CapturedEvidence[]): Promise<void> {
  const kept = await Promise.all(evidence.map(async ({ file }) => ({ fields: file.fields, kept: await keepFieldFile({ uri: file.source.uri, name: file.source.name, mime: file.source.mime, ...(file.facts.sizeBytes ? { sizeBytes: file.facts.sizeBytes } : {}), ...(file.facts.seconds ? { seconds: file.facts.seconds } : {}), ...(file.source.stamp ? { stamp: file.source.stamp } : {}) }) })));
  const fileFields = Object.fromEntries(kept.flatMap((one) => (one.fields ? [[one.kept.key, one.fields]] : [])));
  const scope = { spaceId: to.target.spaceId, clientId: to.target.clientId, serviceId: to.serviceId, chatId: to.chatId };
  await enqueueFieldWork(fieldWriteJobOf({ key: request.entry_id ?? Crypto.randomUUID(), scope, payload: { write, request, values, fileFields }, files: kept.map((one) => one.kept), now: Date.now() }));
}

/** The observation or area report Portal last sent, kept for a site without signal (under the space's prefix). */
const reportCopyKey = (to: WriteTarget, type: string) => spaceDiskKey(`${to.target.spaceId}:field-report:${to.serviceId}:${type}`);

export function keepFieldReport(to: WriteTarget, type: string, body: unknown): void {
  AsyncStorage.setItem(reportCopyKey(to, type), JSON.stringify(body)).catch(() => undefined);
}

/** The kept answer, only when the ask never reached the server: a refusal of Portal still wins. */
export async function keptFieldReport(to: WriteTarget, type: string, reply: { ok: boolean; status?: number }): Promise<unknown> {
  if (reply.ok || !isUnreachable(reply)) return null;
  const raw = await AsyncStorage.getItem(reportCopyKey(to, type)).catch(() => null);
  try {
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}
