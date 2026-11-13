import { arrivalHourOf, clockHourOf } from './reportUnits.js';
import type { FormPhotoStamp, FormSubmitOutcome, TimemarkStampAsked } from './appActions.js';
import type { FormValues } from './appForms.js';
import type { EphemeralAnswer } from './botCommands.js';
import { requiresLocation, type FieldDocument, type SectionPath } from './fieldDocument.js';
import type { DevicePlace, ReportDraftResult } from './reportCreation.js';
import { PHOTO_REMOVAL_FAILED, type OpenedReport, type PhotoRemoval, type ReportQueue } from './reportQueue.js';
import { documentWithQueue, reportFormAnswer, reportSaveOf, samePath, savesOf, type QueuedPhoto, type ReportRef, type ReportSave } from './reportSaves.js';

/**
 * What the report's screen shows and does, the same on the phone and the web
 * (spec INFORMES-DESDE-LILACHAT §4.3): the document with the queue over it and
 * the section's form, drawn from the document so it opens with no signal.
 * What reached Portal stays on screen until its new document arrives, so a
 * saved section never goes back to its old state. `P` is what the platform's
 * photo field hands over.
 */
export type KeptPhoto = Omit<QueuedPhoto, 'field'>;
export type ReportScreenDeps<P> = {
  queue: ReportQueue;
  keepPhoto(source: P): Promise<KeptPhoto>;
  dropPhoto(ref: string): Promise<void>;
  placeNow(): Promise<DevicePlace>;
  /** Who makes the report: its responsible when none was saved. */
  personName(): string | null | undefined;
  newKey(): string;
  now(): string;
};
export type ReportScreenState = {
  draft: ReportDraftResult | null;
  /** What this report still has in the queue, refused ones included. */
  saves: ReportSave[];
  offline: boolean;
  sending: boolean;
  /** Something reached Portal since the screen opened: the detail behind must ask again. */
  changed: boolean;
  form: EphemeralAnswer | null;
};

/** A refresh that fails reads again by itself a few times (E2E 06/11). */
export const REFRESH_RETRIES = 3;
export const REFRESH_RETRY_MS = 4000;
const NOT_KEPT = 'No se pudo guardar en este dispositivo.';
const PHOTO_NOT_KEPT = 'No se pudo guardar la foto en este dispositivo.';
const NO_FORM = 'Este formulario ya no está abierto.';
/** José 06/11: «bloquea la foto sin GPS». */
export const NO_GPS_PHOTO = 'Sin GPS no hay foto. Enciende la ubicación del teléfono y toca Enviar otra vez.';
/** How long «Enviar» waits for a GPS the section does not require: then the photo goes with its hour alone. */
export const PHOTO_PLACE_WAIT_MS = 3000;

const hasFix = (place: DevicePlace): boolean => place.lat !== undefined && place.lng !== undefined;

/** `place` is null after a reading without a fix: the next «Enviar» reads again, once the person turned the GPS on. */
type HeldPhoto = { kept: KeptPhoto; place: Promise<DevicePlace> | null; takenAt: string; stamp?: TimemarkStampAsked };
/** A held photo on its way to the queue, with where it was finally taken. */
type Shot = { field: string; kept: KeptPhoto; place: DevicePlace; stamp?: TimemarkStampAsked };

const photoFieldOf = (answer: EphemeralAnswer): string | undefined => Object.entries(answer.response?.form?.schema.properties ?? {}).find(([, property]) => property['x-input'] === 'photo')?.[0];

/** The document as it should look: what Portal last said, with the queue over it. */
function createDocumentFeed(queue: ReportQueue, ref: ReportRef, tell: () => void, startId?: string) {
  let opened: OpenedReport | null = null;
  let reportId: string | null = startId ?? null;
  let mine = savesOf(queue.snapshot().saves, ref);
  /** What reached Portal, until the document that has it arrives. */
  let held: ReportSave[] = [];
  let revision = queue.snapshot().revision;
  let changed = false;
  let asking = 0;
  let retries = 0;

  async function ask(): Promise<void> {
    asking += 1;
    const ticket = asking;
    const read = await queue.documentOf(ref, reportId);
    if (ticket !== asking) return;
    // A failed refresh keeps what is on screen: the saves are safe in the queue, and an error there was a dead end.
    if (!read.ok && opened?.ok) {
      if (retries < REFRESH_RETRIES) {
        retries += 1;
        setTimeout(() => void ask(), REFRESH_RETRY_MS);
      }
      return;
    }
    retries = 0;
    if (read.ok && read.document.id) reportId = read.document.id;
    opened = read;
    held = [];
    tell();
  }

  return {
    ask,
    saves: (): ReportSave[] => mine,
    onQueue(): void {
      const next = queue.snapshot();
      if (next.revision !== revision) {
        held = [...held, ...mine];
        revision = next.revision;
        changed = true;
        void ask();
      }
      mine = savesOf(next.saves, ref);
      tell();
    },
    reload(): void {
      changed = true;
      void ask();
    },
    view(): Omit<ReportScreenState, 'form'> {
      const shown = [...held.filter((one) => !mine.some((save) => save.clientKey === one.clientKey)), ...mine];
      const draft: ReportDraftResult | null = opened?.ok ? { ok: true, document: documentWithQueue(opened.document, shown) } : opened;
      const { sending, stalled } = queue.snapshot();
      return { draft, saves: mine, offline: Boolean(opened?.ok && opened.offline) || (stalled && mine.length > 0), sending, changed };
    },
  };
}

/** The section's form: what it holds until «Guardar», which is the person's confirmation. */
function createFormSession<P>(deps: ReportScreenDeps<P>, ref: ReportRef, reportNow: () => { document: FieldDocument | null; saves: ReportSave[] }, tell: () => void) {
  const photos = new Map<string, HeldPhoto>();
  let openForm: { path: SectionPath; answer: EphemeralAnswer } | null = null;
  /**
   * The reading started with the form, so the GPS works while the person aims.
   * José 06/11: waiting for it after the shutter was what held the photo for seconds.
   */
  let aiming: Promise<DevicePlace> | null = null;
  const readPlace = (): Promise<DevicePlace> => deps.placeNow().catch((): DevicePlace => ({ at: deps.now() }));

  /** A section that requires the place waits for the phone, which has its own limit; any other, a moment. */
  async function placeOf(held: HeldPhoto, required: boolean): Promise<DevicePlace> {
    const reading = held.place ?? readPlace();
    held.place = reading;
    const gaveUp = new Promise<DevicePlace>((resolve) => setTimeout(() => resolve({ at: held.takenAt }), PHOTO_PLACE_WAIT_MS));
    const place = await (required ? reading : Promise.race([reading, gaveUp]));
    return { ...place, at: held.takenAt };
  }

  function saveOf(document: FieldDocument, path: SectionPath, values: FormValues, shot: Shot | null): ReportSave {
    const save = reportSaveOf({ ref, document, path, values, clientKey: deps.newKey(), now: deps.now() });
    return shot ? { ...save, photo: { field: shot.field, ...shot.kept, ...(shot.stamp ? { stamp: shot.stamp } : {}) }, place: shot.place } : save;
  }

  return {
    current: (): EphemeralAnswer | null => openForm?.answer ?? null,
    /** A refused section opens with what Portal said under each field. */
    openSection(path: SectionPath): void {
      const { document, saves } = reportNow();
      const refused = saves.find((one) => one.refusal && !one.photo && samePath(one.path, path));
      const context = { errors: refused?.refusal?.errors, personName: deps.personName(), arrivalHour: document ? arrivalHourOf(document, path, deps.now()) : undefined, startHour: clockHourOf(deps.now()) };
      const answer = document ? reportFormAnswer(document, path, context) : null;
      openForm = answer ? { path, answer } : null;
      aiming = answer && photoFieldOf(answer) ? readPlace() : null;
      tell();
    },
    closeForm(): void {
      photos.forEach((_held, photo) => void deps.dropPhoto(photo));
      photos.clear();
      openForm = null;
      aiming = null;
      tell();
    },
    /** The photo field's upload: it only stays on the device, at once. Where it was taken is settled at «Enviar». */
    /** Only Lilachat's camera stamp rides with the photo; any other is left for Portal to stamp, as before. */
    async upload(source: P, stamp?: FormPhotoStamp): Promise<{ ok: true; fileId: string } | { ok: false; message: string }> {
      let kept: KeptPhoto;
      try {
        kept = await deps.keepPhoto(source);
      } catch {
        return { ok: false, message: PHOTO_NOT_KEPT };
      }
      const takenAt = deps.now();
      photos.set(kept.ref, { kept, place: aiming ?? readPlace(), takenAt, ...(typeof stamp === 'object' && 'timemark' in stamp ? { stamp: { ...stamp, takenAt } } : {}) });
      aiming = null;
      return { ok: true, fileId: kept.ref };
    },
    /** The save is queued and the form closes, with signal or without. */
    async submit(values: FormValues): Promise<FormSubmitOutcome> {
      const opened = openForm;
      const before = reportNow().document;
      if (!opened || !before) return { done: false, errors: {}, message: NO_FORM };
      const field = photoFieldOf(opened.answer);
      const held = field ? photos.get(String(values[field])) : undefined;
      const required = requiresLocation(before, opened.path);
      const place = held ? await placeOf(held, required) : null;
      const document = reportNow().document;
      if (openForm !== opened || !document) return { done: false, errors: {}, message: NO_FORM };
      if (held && place && required && !hasFix(place)) {
        held.place = null;
        return { done: false, errors: {}, message: NO_GPS_PHOTO };
      }
      try {
        await deps.queue.add(saveOf(document, opened.path, values, field && held && place ? { field, kept: held.kept, place, stamp: held.stamp } : null));
      } catch {
        return { done: false, errors: {}, message: NOT_KEPT };
      }
      photos.clear();
      openForm = null;
      aiming = null;
      tell();
      return { done: true, answer: null };
    },
  };
}

/** `startId`: the draft a row asked to continue; without it Portal decides which one opens. */
export function createReportScreen<P>(deps: ReportScreenDeps<P>, ref: ReportRef, startId?: string) {
  const listeners = new Set<() => void>();
  let stopListening: (() => void) | null = null;
  const tell = () => {
    state = { ...feed.view(), form: forms.current() };
    listeners.forEach((listener) => listener());
  };
  const feed = createDocumentFeed(deps.queue, ref, tell, startId);
  const reportNow = () => ({ document: state.draft?.ok ? state.draft.document : null, saves: feed.saves() });
  const forms = createFormSession(deps, ref, reportNow, tell);
  let state: ReportScreenState = { ...feed.view(), form: null };

  return {
    snapshot: (): ReportScreenState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      if (!stopListening) {
        stopListening = deps.queue.subscribe(feed.onQueue);
        feed.onQueue();
        void feed.ask();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        stopListening?.();
        stopListening = null;
      };
    },
    /** The signal came back, or the document is just old. */
    refresh: (): void => void feed.ask(),
    /** A form outside the queue was answered (publishing). */
    reload: feed.reload,
    openSection: forms.openSection,
    closeForm: forms.closeForm,
    upload: forms.upload,
    submit: forms.submit,
    discard: (clientKey: string): Promise<void> => deps.queue.discard(clientKey),
    /** A sent photo out of the draft: it stays on screen until Portal said yes. */
    async removePhoto(photoId: string): Promise<PhotoRemoval> {
      const reportId = reportNow().document?.id;
      if (!reportId) return { ok: false, message: PHOTO_REMOVAL_FAILED };
      const removal = await deps.queue.removePhoto(ref, reportId, photoId);
      if (removal.ok) feed.reload();
      return removal;
    },
  };
}
