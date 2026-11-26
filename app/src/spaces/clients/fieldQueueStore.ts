import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { discardFieldJob, enqueueFieldJob, fieldJobsWakeAt, nextFieldJob, retryFieldJob, settleFieldJob, keysGoingWith, visitJobBlocked, type FieldJob, type FieldJobFile, type FieldJobKind, type FieldJobVerdict, type ResolvedVisits } from '@lilachat/shared';
import { loadCredential } from '../../auth/credentialStore';
import { alConectar, getSocket } from '../../chat/socketClient';
import { reportarError } from '../../ui/reportarError';

/**
 * The phone's side of the field queue (`shared/fieldQueue`, José 26/11):
 * the jobs on AsyncStorage (an index, never a file), each file copied out of
 * the camera's cache into `documentDirectory/field-queue/` (the system cleans
 * the cache). It drains only with the socket connected: offline nothing is
 * tried, so no battery goes to it; `alConectar` and each new job start it.
 * The JWT is read from the keychain at each run and never stored.
 */
const QUEUE_KEY = 'lilachat:field-queue';
/** A visit created without signal → Portal's id, once its «Datos» landed (`shared/visitOffline`). */
const VISIT_IDS_KEY = 'lilachat:field-visit-ids';
const FILES_FOLDER = `${FileSystem.documentDirectory ?? ''}field-queue/`;
/** Between two jobs: a backlog of 40 photos must not hit Portal in one burst. */
const GAP_MS = 1_500;

export type FieldJobHandler = (job: FieldJob, jwt: string) => Promise<FieldJobVerdict>;
const handlers = new Map<FieldJobKind, FieldJobHandler>();
/** Each kind's sender registers itself: the store knows no form, no ticket and no tool. */
export const registerFieldHandler = (kind: FieldJobKind, handler: FieldJobHandler): void => void handlers.set(kind, handler);

let queue: FieldJob[] | null = null;
let writing: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();
/** Who wants to know a job landed (the Drive asks its list again). */
const doneListeners = new Set<(job: FieldJob) => void>();

let resolved: Record<string, string> = {};
let resolvedRead: Promise<void> | null = null;
const readResolved = () => (resolvedRead ??= AsyncStorage.getItem(VISIT_IDS_KEY).then((raw) => {
  try {
    resolved = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    resolved = {};
  }
}).catch(() => undefined));

/** What is known of the visits created without signal; read before any drain. */
export const resolvedVisitsNow = (): ResolvedVisits => resolved;

/** A local visit got Portal's id: its waiting work can go, and its screen switches to it. */
export async function resolveLocalVisit(localId: string, realId: string): Promise<void> {
  await readResolved();
  resolved = { ...resolved, [localId]: realId };
  listeners.forEach((listener) => listener());
  await AsyncStorage.setItem(VISIT_IDS_KEY, JSON.stringify(resolved)).catch((error: unknown) => reportarError('fieldQueueStore.resolveLocalVisit', error));
}

async function loaded(): Promise<FieldJob[]> {
  await readResolved();
  if (queue) return queue;
  const raw = await AsyncStorage.getItem(QUEUE_KEY).catch(() => null);
  try {
    queue = raw ? (JSON.parse(raw) as FieldJob[]) : [];
  } catch (error) {
    reportarError('fieldQueueStore.loaded', error);
    queue = [];
  }
  return queue;
}

/** Every change goes through here, one after the other, memory first and then disk. */
function change(next: (current: FieldJob[]) => FieldJob[]): Promise<void> {
  writing = writing.then(async () => {
    queue = next(await loaded());
    listeners.forEach((listener) => listener());
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue)).catch((error: unknown) => reportarError('fieldQueueStore.change', error));
  });
  return writing;
}

const dropFiles = (files: readonly FieldJobFile[]) => Promise.all(files.map((file) => FileSystem.deleteAsync(file.ref, { idempotent: true }).catch(() => undefined)));

/** A file out of the camera's cache into the queue's folder; the copy is what the job sends. */
export async function keepFieldFile(file: { uri: string; name: string; mime: string; sizeBytes?: number; seconds?: number; stamp?: FieldJobFile['stamp'] }): Promise<FieldJobFile> {
  await FileSystem.makeDirectoryAsync(FILES_FOLDER, { intermediates: true }).catch(() => undefined);
  const key = Crypto.randomUUID();
  const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
  const ref = `${FILES_FOLDER}${key}${extension}`;
  await FileSystem.copyAsync({ from: file.uri, to: ref });
  return { key, ref, name: file.name, mime: file.mime, ...(file.sizeBytes ? { sizeBytes: file.sizeBytes } : {}), ...(file.seconds ? { seconds: file.seconds } : {}), ...(file.stamp ? { stamp: file.stamp } : {}) };
}

export async function enqueueFieldWork(job: FieldJob): Promise<void> {
  await change((current) => enqueueFieldJob(current, job));
  kickFieldQueue();
}

let draining = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function scheduleWake(current: readonly FieldJob[]): void {
  if (timer) clearTimeout(timer);
  timer = null;
  // A job waiting for another (a visit's creation) wakes nothing: its creation's own retry does.
  const wakeAt = fieldJobsWakeAt(current.filter((one) => !visitJobBlocked(one, current, resolved)));
  if (wakeAt !== null) timer = setTimeout(kickFieldQueue, Math.max(GAP_MS, wakeAt - Date.now()));
}

async function runOne(job: FieldJob): Promise<void> {
  const handler = handlers.get(job.kind);
  const credential = await loadCredential();
  if (!handler || !credential) return;
  const verdict = await handler(job, credential.jwt).catch((error: unknown): FieldJobVerdict => {
    reportarError('fieldQueueStore.runOne', error);
    return { outcome: 'retry', reached: false };
  });
  await change((current) => settleFieldJob(current, job.key, verdict, Date.now()));
  if (verdict.outcome !== 'done') return;
  await dropFiles(job.files);
  doneListeners.forEach((listener) => listener(job));
}

async function drain(): Promise<void> {
  for (;;) {
    if (!getSocket()?.connected) return;
    const current = await loaded();
    const job = nextFieldJob(current, Date.now(), (one) => visitJobBlocked(one, current, resolved));
    if (!job) return;
    await runOne(job);
    await new Promise((resolve) => setTimeout(resolve, GAP_MS));
  }
}

/** Starts a pass if none is running; the next due retry wakes it again. */
export function kickFieldQueue(): void {
  if (draining) return;
  draining = true;
  void drain()
    .catch((error: unknown) => reportarError('fieldQueueStore.drain', error))
    .finally(async () => {
      draining = false;
      // Offline nothing waits on a timer: the next connect starts it (no battery on a dead link).
      if (getSocket()?.connected) scheduleWake(await loaded());
    });
}

alConectar(kickFieldQueue);
// A queue left from before the app closed starts on the first connect; reading it now paints the counts.
void loaded().then(() => listeners.forEach((listener) => listener()));

export function subscribeFieldQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const fieldQueueNow = (): readonly FieldJob[] => queue ?? [];

export function onFieldJobDone(listener: (job: FieldJob) => void): () => void {
  doneListeners.add(listener);
  return () => doneListeners.delete(listener);
}

/** «Reintentar» on a refused job: back in line now. */
export async function retryFieldWork(key: string): Promise<void> {
  await change((current) => retryFieldJob(current, key, Date.now()));
  kickFieldQueue();
}

/** «Descartar»: out of the queue, its files deleted; a new visit's creation takes its whole visit along. */
export async function discardFieldWork(key: string): Promise<void> {
  const gone: FieldJob[] = [];
  await change((current) => {
    const job = current.find((one) => one.key === key);
    const keys = job ? keysGoingWith(job, current) : [key];
    return keys.reduce((rest, one) => {
      const result = discardFieldJob(rest, one);
      if (result.dropped) gone.push(result.dropped);
      return result.queue;
    }, current);
  });
  await dropFiles(gone.flatMap((job) => job.files));
}

/** On logout: what was not sent belongs to whoever left. */
export async function forgetFieldQueue(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  await change(() => []);
  resolved = {};
  await AsyncStorage.removeItem(VISIT_IDS_KEY).catch(() => undefined);
  await FileSystem.deleteAsync(FILES_FOLDER, { idempotent: true }).catch(() => undefined);
}
