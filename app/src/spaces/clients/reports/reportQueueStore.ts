import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { createReportQueue, noticeOf, type FieldDocument, type KeptPhoto, type ReportRef, type ReportSave, type ReportVault, type ReportWire } from '@lilachat/shared';
import { loadCredential } from '../../../auth/credentialStore';
import { submitAppForm, uploadFormPhoto } from '../../../chat/commands/commandsApi';
import { alConectar, getSocket } from '../../../chat/socketClient';
import { reportarError } from '../../../ui/reportarError';
import { askReportDraft, openReportForm } from './reportsApi';

/**
 * The phone's side of the report queue (`shared/reportQueue`): the saves and
 * the last document on AsyncStorage, each photo copied out of the camera's
 * cache (the system cleans it, `colaDeArchivos`). The JWT is read from the
 * keychain at each call and never stored.
 */
const QUEUE_KEY = 'lilachat:report-queue';
const DOCUMENT_PREFIX = 'lilachat:report-document:';
const PHOTOS_FOLDER = `${FileSystem.documentDirectory ?? ''}report-photos/`;
const NO_SESSION = { ok: false as const, message: 'Sin sesión.' };

async function readJson<T>(key: string): Promise<T | null> {
  const stored = await AsyncStorage.getItem(key).catch(() => null);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as T;
  } catch (error) {
    reportarError('reportQueueStore.readJson', error);
    return null;
  }
}

const vault: ReportVault = {
  load: async () => (await readJson<ReportSave[]>(QUEUE_KEY)) ?? [],
  store: (saves) => AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(saves)),
  loadDocument: (key) => readJson<FieldDocument>(`${DOCUMENT_PREFIX}${key}`),
  storeDocument: (key, document) => AsyncStorage.setItem(`${DOCUMENT_PREFIX}${key}`, JSON.stringify(document)).catch(() => undefined),
  dropPhoto: (ref) => FileSystem.deleteAsync(ref, { idempotent: true }).catch(() => undefined),
};

async function withJwt<T>(call: (jwt: string) => Promise<T>): Promise<T | typeof NO_SESSION> {
  const credential = await loadCredential();
  return credential ? call(credential.jwt) : NO_SESSION;
}

const targetOf = (ref: ReportRef, jwt: string) => ({ jwt, spaceId: ref.spaceId, clientId: ref.clientId });

const wire: ReportWire = {
  read: (ref, reportId) => withJwt((jwt) => askReportDraft(targetOf(ref, jwt), ref.serviceId, ref.type, reportId)),
  open: (ref, request) => withJwt((jwt) => openReportForm(targetOf(ref, jwt), ref.serviceId, request)),
  upload: (ref, commandId, photo) => withJwt((jwt) => uploadFormPhoto(jwt, { chatId: ref.chatId }, commandId, { uri: photo.ref, mime: photo.mime }, photo.stamp)),
  submit: (ref, commandId, values) => withJwt((jwt) => submitAppForm(jwt, { chatId: ref.chatId }, commandId, values)),
  notice: (commandId) => noticeOf(getSocket(), commandId),
};

export const reportQueue = createReportQueue({ vault, wire });

/** Each time the socket connects: at start, and when the signal comes back. */
alConectar(() => void reportQueue.kick());

export async function keepReportPhoto(photo: { uri: string; mime: string }): Promise<KeptPhoto> {
  await FileSystem.makeDirectoryAsync(PHOTOS_FOLDER, { intermediates: true }).catch(() => undefined);
  const ref = `${PHOTOS_FOLDER}${Crypto.randomUUID()}.jpg`;
  await FileSystem.copyAsync({ from: photo.uri, to: ref });
  return { ref, mime: photo.mime, preview: ref };
}

export const dropReportPhoto = (ref: string): Promise<void> => vault.dropPhoto(ref);

/** On logout: what was not sent, and the documents kept, belong to whoever left. */
export async function forgetReportQueue(): Promise<void> {
  await reportQueue.forget();
  const keys = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter((key) => key.startsWith(DOCUMENT_PREFIX));
  if (keys.length) await AsyncStorage.multiRemove(keys).catch(() => undefined);
  await FileSystem.deleteAsync(PHOTOS_FOLDER, { idempotent: true }).catch(() => undefined);
}
