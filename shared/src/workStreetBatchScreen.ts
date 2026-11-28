import type { TapFeatures } from '@constroad/shared/obra';
import type { WorkMapStreet } from './workMap.js';
import type { WorkProgressResult } from './workProgressSend.js';
import type { StreetDraft } from './workStreetDraft.js';
import { addHandStreet, batchCountLabel, batchProblem, batchSaveLabel, EMPTY_BATCH, editBatchStreet, removeBatchStreet, saveStreetBatch, tapStreetBatch, type BatchSaved, type BatchStreet, type StreetBatch } from './workStreetBatch.js';

/**
 * What the ma02 screen holds besides the list: the line under the map, the question on the band and
 * «Guardando 2 de 5…». PURE transitions, so the APK and the web hooks only keep the state.
 */
export type BatchQuestion = { text: string; yes: string; then: { kind: 'remove'; key: string } | { kind: 'leave' } };
export type BatchScreen = { batch: StreetBatch; problem: string | null; question: BatchQuestion | null; progress: string | null };

export const EMPTY_BATCH_SCREEN: BatchScreen = { batch: EMPTY_BATCH, problem: null, question: null, progress: null };
export const BATCH_REMOVE_YES = 'Quitar';
export const BATCH_LEAVE_YES = 'Salir';
export const BATCH_STAY = 'Seguir aquí';

/** A tap while it saves changes nothing: the list being sent stays as it is. */
export function batchScreenTap(screen: BatchScreen, at: TapFeatures, saved: readonly WorkMapStreet[], newKey: string): BatchScreen {
  if (screen.progress) return screen;
  const tapped = tapStreetBatch(screen.batch, at, saved, newKey);
  if (tapped.kind === 'problem') return { ...screen, problem: tapped.message };
  if (tapped.kind === 'confirm') return { ...screen, problem: null, question: { text: tapped.question, yes: BATCH_REMOVE_YES, then: { kind: 'remove', key: tapped.key } } };
  return { ...screen, problem: null, batch: tapped.batch };
}

export const batchScreenEdit = (screen: BatchScreen, key: string, change: Partial<Pick<BatchStreet, 'name' | 'widthM'>>): BatchScreen => ({ ...screen, problem: null, batch: editBatchStreet(screen.batch, key, change) });
export const batchScreenRemove = (screen: BatchScreen, key: string): BatchScreen => ({ ...screen, problem: null, batch: removeBatchStreet(screen.batch, key) });
export const batchScreenAddHand = (screen: BatchScreen, draft: StreetDraft, key: string): BatchScreen => ({ ...screen, problem: null, batch: addHandStreet(screen.batch, draft, key) });

/** «Cancelar»: an empty list leaves at once; streets in it ask first. */
export function batchScreenCancel(screen: BatchScreen): { screen: BatchScreen; leave: boolean } {
  if (!screen.batch.streets.length) return { screen, leave: true };
  return { screen: { ...screen, question: { text: `¿Salir sin guardar ${batchCountLabel(screen.batch.streets.length)}?`, yes: BATCH_LEAVE_YES, then: { kind: 'leave' } } }, leave: false };
}

/** The answer to the band's question: «Quitar» removes, «Salir» leaves, «Seguir aquí» only closes it. */
export function batchScreenAnswer(screen: BatchScreen, yes: boolean): { screen: BatchScreen; leave: boolean } {
  const closed = { ...screen, question: null };
  if (!yes || !screen.question) return { screen: closed, leave: false };
  const { then } = screen.question;
  return then.kind === 'leave' ? { screen: closed, leave: true } : { screen: batchScreenRemove(closed, then.key), leave: false };
}

/**
 * «Listo»: checks, then saves one by one telling each step through `show`. Null when it did not start
 * (a problem, or already saving); else what the save answered, with the screen already updated.
 */
export async function finishStreetBatch(screen: BatchScreen, save: (draft: StreetDraft, entryId: string) => Promise<WorkProgressResult>, show: (next: BatchScreen) => void): Promise<BatchSaved | null> {
  if (screen.progress) return null;
  const problem = batchProblem(screen.batch);
  if (problem) {
    show({ ...screen, problem });
    return null;
  }
  const saving = { ...screen, problem: null, question: null };
  const saved = await saveStreetBatch(screen.batch, save, (index, total) => show({ ...saving, progress: batchSaveLabel(index, total) }));
  show({ ...saving, batch: saved.batch, progress: null, problem: saved.ok ? null : saved.message });
  return saved;
}

type ScreenUpdate = (update: BatchScreen | ((before: BatchScreen) => BatchScreen)) => void;
export type BatchScreenDeps = {
  saved: readonly WorkMapStreet[];
  newKey: () => string;
  send: (draft: StreetDraft, entryId: string) => Promise<WorkProgressResult>;
  onClose: () => void;
  onSaved: (message: string) => void;
  /** Some were saved before a failure: the map reads them again, the list stays. */
  onPartial: () => void;
};

const ADDED_TO_LIST: WorkProgressResult = { ok: true, message: '' };

/** The screen's handlers over a React-style state setter: the APK and the web hooks only hold the state. */
export function batchScreenActions(screen: BatchScreen, set: ScreenUpdate, deps: BatchScreenDeps) {
  const leaveOr = (next: { screen: BatchScreen; leave: boolean }) => (next.leave ? deps.onClose() : set(next.screen));
  return {
    tap: (at: TapFeatures) => { const key = deps.newKey(); set((before) => batchScreenTap(before, at, deps.saved, key)); },
    edit: (key: string, change: Partial<Pick<BatchStreet, 'name' | 'widthM'>>) => set((before) => batchScreenEdit(before, key, change)),
    remove: (key: string) => set((before) => batchScreenRemove(before, key)),
    /** The single-street editor's «Agregar a la lista»: it answers like a save so the editor closes. */
    addHand: async (draft: StreetDraft): Promise<WorkProgressResult> => { const key = deps.newKey(); set((before) => batchScreenAddHand(before, draft, key)); return ADDED_TO_LIST; },
    cancel: () => leaveOr(batchScreenCancel(screen)),
    answer: (yes: boolean) => leaveOr(batchScreenAnswer(screen, yes)),
    finish: async () => {
      const saved = await finishStreetBatch(screen, deps.send, set);
      if (saved?.ok) deps.onSaved(saved.message);
      else if (saved?.savedCount) deps.onPartial();
    },
  };
}
