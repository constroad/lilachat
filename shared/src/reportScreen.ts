import { arrivalHourOf } from './reportUnits.js';
import type { FormSubmitOutcome } from './appActions.js';
import type { FormValues } from './appForms.js';
import type { EphemeralAnswer } from './botCommands.js';
import { requiresLocation, type FieldDocument, type SectionPath } from './fieldDocument.js';
import type { DevicePlace, ReportDraftResult } from './reportCreation.js';
import type { OpenedReport, ReportQueue } from './reportQueue.js';
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

const NOT_KEPT = 'No se pudo guardar en este dispositivo.';
const PHOTO_NOT_KEPT = 'No se pudo guardar la foto en este dispositivo.';
const NO_FORM = 'Este formulario ya no está abierto.';
/** José 06/11: «bloquea la foto sin GPS». */
export const NO_GPS_PHOTO = 'Sin GPS no hay foto. Enciende la ubicación del teléfono y vuelve a tomarla.';

const hasFix = (place: DevicePlace): boolean => place.lat !== undefined && place.lng !== undefined;

type HeldPhoto = { kept: KeptPhoto; place: DevicePlace };

const photoFieldOf = (answer: EphemeralAnswer): string | undefined => Object.entries(answer.response?.form?.schema.properties ?? {}).find(([, property]) => property['x-input'] === 'photo')?.[0];

/** The document as it should look: what Portal last said, with the queue over it. */
function createDocumentFeed(queue: ReportQueue, ref: ReportRef, tell: () => void) {
  let opened: OpenedReport | null = null;
  let reportId: string | null = null;
  let mine = savesOf(queue.snapshot().saves, ref);
  /** What reached Portal, until the document that has it arrives. */
  let held: ReportSave[] = [];
  let revision = queue.snapshot().revision;
  let changed = false;
  let asking = 0;

  async function ask(): Promise<void> {
    asking += 1;
    const ticket = asking;
    const read = await queue.documentOf(ref, reportId);
    if (ticket !== asking) return;
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

  function saveOf(document: FieldDocument, path: SectionPath, answer: EphemeralAnswer, values: FormValues): ReportSave {
    const save = reportSaveOf({ ref, document, path, values, clientKey: deps.newKey(), now: deps.now() });
    const field = photoFieldOf(answer);
    const photo = field ? photos.get(String(values[field])) : undefined;
    return field && photo ? { ...save, photo: { field, ...photo.kept }, place: photo.place } : save;
  }

  return {
    current: (): EphemeralAnswer | null => openForm?.answer ?? null,
    /** A refused section opens with what Portal said under each field. */
    openSection(path: SectionPath): void {
      const { document, saves } = reportNow();
      const refused = saves.find((one) => one.refusal && !one.photo && samePath(one.path, path));
      const answer = document ? reportFormAnswer(document, path, refused?.refusal?.errors, deps.personName(), arrivalHourOf(document, path, deps.now())) : null;
      openForm = answer ? { path, answer } : null;
      tell();
    },
    closeForm(): void {
      photos.forEach((_held, photo) => void deps.dropPhoto(photo));
      photos.clear();
      openForm = null;
      tell();
    },
    /** The photo field's upload: here it only stays on the device, with where and when it was taken. A section that needs the place refuses it without a fix. */
    async upload(source: P): Promise<{ ok: true; fileId: string } | { ok: false; message: string }> {
      let kept: KeptPhoto;
      try {
        kept = await deps.keepPhoto(source);
      } catch {
        return { ok: false, message: PHOTO_NOT_KEPT };
      }
      const place = await deps.placeNow().catch((): DevicePlace => ({ at: deps.now() }));
      const { document } = reportNow();
      if (!hasFix(place) && openForm && document && requiresLocation(document, openForm.path)) {
        await deps.dropPhoto(kept.ref);
        return { ok: false, message: NO_GPS_PHOTO };
      }
      photos.set(kept.ref, { kept, place });
      return { ok: true, fileId: kept.ref };
    },
    /** The save is queued and the form closes, with signal or without. */
    async submit(values: FormValues): Promise<FormSubmitOutcome> {
      const { document } = reportNow();
      if (!openForm || !document) return { done: false, errors: {}, message: NO_FORM };
      try {
        await deps.queue.add(saveOf(document, openForm.path, openForm.answer, values));
      } catch {
        return { done: false, errors: {}, message: NOT_KEPT };
      }
      photos.clear();
      openForm = null;
      tell();
      return { done: true, answer: null };
    },
  };
}

export function createReportScreen<P>(deps: ReportScreenDeps<P>, ref: ReportRef) {
  const listeners = new Set<() => void>();
  let stopListening: (() => void) | null = null;
  const tell = () => {
    state = { ...feed.view(), form: forms.current() };
    listeners.forEach((listener) => listener());
  };
  const feed = createDocumentFeed(deps.queue, ref, tell);
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
  };
}
