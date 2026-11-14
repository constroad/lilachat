import { cutAtWord } from './textCut.js';

/**
 * The buttons of a form (agentes 13/11: «Registrar gasto» and «Guardar borrador» in «Revisar gasto»). The first is the big
 * one; the id of the one pressed travels as `values._accion`, and only an id the form declared is passed on. A draft
 * saves what is filled: nothing is required and a split need not add up. PURE: the server, the APK and the web.
 */
export type FormSubmit = { id: string; label: string; /** A draft; `borrador` is one by its name. */ draft?: true };

/** The key under which the app receives the button that was pressed. */
export const ACTION_KEY = '_accion';

const SUBMIT_ID = /^[a-z][a-z0-9_-]{0,31}$/;
const SUBMITS_MAX = 3;
const SUBMIT_LABEL_MAX = 40;
const DRAFT_ID = 'borrador';

/** The buttons the app declared (`x-submits`): clean ids and labels, no repeats, at most three; anything else is dropped. */
export function submitsOf(raw: unknown): FormSubmit[] {
  if (!Array.isArray(raw)) return [];
  const submits: FormSubmit[] = [];
  for (const entry of raw) {
    const one = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    const id = typeof one.id === 'string' ? one.id : '';
    const label = typeof one.label === 'string' ? cutAtWord(one.label.replace(/\s+/g, ' ').trim(), SUBMIT_LABEL_MAX) : '';
    if (!SUBMIT_ID.test(id) || !label || submits.some((submit) => submit.id === id)) continue;
    submits.push({ id, label, ...(one.draft === true ? { draft: true as const } : {}) });
  }
  return submits.slice(0, SUBMITS_MAX);
}

/** The declared button for this id. An id nobody declared is none, so the first one answers: the strict one. */
export const submitChosen = (submits: readonly FormSubmit[] | undefined, id: unknown): FormSubmit | undefined => submits?.find((submit) => submit.id === id) ?? submits?.[0];

/** A button that saves what is filled instead of asking for everything. */
export const isDraftSubmit = (submit: FormSubmit | undefined): boolean => submit?.draft === true || submit?.id === DRAFT_ID;
