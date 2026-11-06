import { useEffect } from 'react';
import { createReportQueue, noticeOf, type FieldDocument, type KeptPhoto, type ReportRef, type ReportSave, type ReportVault, type ReportWire } from '@lilachat/shared';
import { submitAppForm, uploadFormPhoto } from '../../../chat/commands/commandsApi';
import { baseDe, ignoreClosedBase, type ValorMeta } from '../../../local/baseLocal';
import { currentSocket } from '../../../useSocket';
import { askReportDraft, openReportForm } from './reportsApi';

/**
 * The browser's side of the report queue (`shared/reportQueue`): the saves, the
 * last document and each photo in the person's own local base, which logout
 * deletes whole. Two tabs share it, so only the one holding the lock sends.
 */
const QUEUE_KEY = 'report-queue';
const DOCUMENT_PREFIX = 'report-document:';
const PHOTO_PREFIX = 'report-photo:';
const SEND_LOCK = 'lilachat-report-queue';

let session: { jwt: string; userId: string | null } | null = null;
const previews = new Map<string, string>();
const metaOf = () => (session?.userId ? baseDe(session.userId).meta : null);

/** Logging out closes the base under whatever is reading it: that is nothing to keep, not an error. */
const readMeta = (key: string): Promise<ValorMeta | undefined> =>
  Promise.resolve(metaOf()?.get(key)).catch((error: unknown) => {
    ignoreClosedBase(error);
    return undefined;
  });
const writeMeta = (key: string, value: unknown): Promise<void> => Promise.resolve(metaOf()?.put({ clave: key, valor: value })).then(() => undefined, ignoreClosedBase);
const removeMeta = (key: string): Promise<void> => Promise.resolve(metaOf()?.delete(key)).catch(ignoreClosedBase);

async function photoBlobOf(ref: string): Promise<Blob | null> {
  const kept = await readMeta(`${PHOTO_PREFIX}${ref}`);
  return kept?.valor instanceof Blob ? kept.valor : null;
}

async function previewOf(ref: string): Promise<string> {
  const known = previews.get(ref);
  if (known) return known;
  const blob = await photoBlobOf(ref);
  if (!blob) return '';
  const url = URL.createObjectURL(blob);
  previews.set(ref, url);
  return url;
}

const vault: ReportVault = {
  async load() {
    const kept = await readMeta(QUEUE_KEY);
    const saves = Array.isArray(kept?.valor) ? (kept.valor as ReportSave[]) : [];
    return Promise.all(saves.map(async (one) => (one.photo ? { ...one, photo: { ...one.photo, preview: await previewOf(one.photo.ref) } } : one)));
  },
  store: (saves) => writeMeta(QUEUE_KEY, saves),
  async loadDocument(key) {
    const kept = await readMeta(`${DOCUMENT_PREFIX}${key}`);
    return (kept?.valor as FieldDocument | undefined) ?? null;
  },
  storeDocument: (key, document) => writeMeta(`${DOCUMENT_PREFIX}${key}`, document),
  async dropPhoto(ref) {
    const url = previews.get(ref);
    if (url) URL.revokeObjectURL(url);
    previews.delete(ref);
    await removeMeta(`${PHOTO_PREFIX}${ref}`);
  },
};

const NO_SESSION = { ok: false as const, message: 'Sin sesión.' };
const targetOf = (ref: ReportRef, jwt: string) => ({ jwt, spaceId: ref.spaceId, clientId: ref.clientId });

const wire: ReportWire = {
  read: async (ref, reportId) => (session ? askReportDraft(targetOf(ref, session.jwt), ref.serviceId, ref.type, reportId) : NO_SESSION),
  open: async (ref, request) => (session ? openReportForm(targetOf(ref, session.jwt), ref.serviceId, request) : NO_SESSION),
  async upload(ref, commandId, photo) {
    const blob = await photoBlobOf(photo.ref);
    if (!session || !blob) return NO_SESSION;
    return uploadFormPhoto(session.jwt, { chatId: ref.chatId }, commandId, blob);
  },
  submit: async (ref, commandId, values) => (session ? submitAppForm(session.jwt, { chatId: ref.chatId }, commandId, values) : NO_SESSION),
  notice: (commandId) => noticeOf(currentSocket(), commandId),
};

/** Sends only with the lock; a browser without Web Locks has a single sender per tab, as the chat's queue does. */
function exclusive(task: () => Promise<void>): Promise<unknown> {
  if (typeof navigator === 'undefined' || !navigator.locks) return task();
  return navigator.locks.request(SEND_LOCK, { ifAvailable: true }, async (lock) => (lock ? task() : null));
}

export const reportQueue = createReportQueue({ vault, wire, exclusive });

/** The session the queue sends with, and what was left on the disk on its way; it tries again when the network is back. */
export function useReportQueueStart(jwt: string, userId: string | null): void {
  useEffect(() => {
    session = jwt ? { jwt, userId } : null;
    if (!session) return undefined;
    void reportQueue.kick();
    const kick = () => void reportQueue.kick();
    window.addEventListener('online', kick);
    return () => window.removeEventListener('online', kick);
  }, [jwt, userId]);
}

export async function keepReportPhoto(file: File): Promise<KeptPhoto> {
  const ref = crypto.randomUUID();
  await writeMeta(`${PHOTO_PREFIX}${ref}`, file);
  const preview = URL.createObjectURL(file);
  previews.set(ref, preview);
  return { ref, mime: file.type || 'image/jpeg', preview };
}

export const dropReportPhoto = (ref: string): Promise<void> => vault.dropPhoto(ref);
