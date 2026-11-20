import { EXAMPLE_LABEL, exampleValues, formFields, initialValues, validateFormValues, type FormValues } from './appForms.js';
import type { FieldDocument, FormSection, SectionPath } from './fieldDocument.js';
import { reportFormAnswer, type ReportFormContext } from './reportSaves.js';

/**
 * «Completar datos de ejemplo» for the whole report (José 20/11, design imp-05: the button inside each
 * form was too hidden): a banner over a draft's sections fills every section that has Portal's example, one
 * save per section through the same queue as «Guardar». Only the empty fields take the example. PURE.
 */
export const EXAMPLE_BANNER_ASK = '¿Probando?';
export const EXAMPLE_BANNER_ACTION = EXAMPLE_LABEL;
export const EXAMPLE_BANNER_CLOSE = 'Ocultar';
export const EXAMPLE_FILL_FAILED = 'No se pudo completar el ejemplo. Intenta otra vez.';
/** How many dismissed reports a device remembers: the oldest go first. */
export const EXAMPLE_DISMISSED_MAX = 50;

/** A section the example can fill: Portal sent one, and it is a form (a photo section goes one photo at a time). */
const fillable = (section: FormSection): boolean => Boolean(section.example && Object.keys(section.example).length) && !section.tool;

/** Every section with an example, in the hub's order; a tramo's sections after its card's place. */
export function exampleSectionsOf(document: FieldDocument): SectionPath[] {
  const paths: SectionPath[] = [];
  for (const section of document.sections) {
    if (!section.enabled && document.id !== null) continue;
    if (section.kind === 'form') {
      if (fillable(section)) paths.push({ sectionId: section.id, itemId: null, key: section.id });
      continue;
    }
    for (const item of section.items) for (const one of item.sections) if (fillable(one)) paths.push({ sectionId: section.id, itemId: item.id, key: one.id });
  }
  return paths;
}

/** The banner shows on a draft with something to fill. */
export const showsExampleBanner = (document: FieldDocument): boolean => document.status === 'draft' && exampleSectionsOf(document).length > 0;

export type ExampleFill = { kind: 'fill'; title: string; values: FormValues } | { kind: 'nothing'; title: string } | { kind: 'missing'; title: string };

/**
 * What «Guardar» would send for this section after «Completar datos de ejemplo»: the form as it opens,
 * the example over its empty fields. Nothing new is no save; a required field the example leaves empty
 * (a photo) cannot be saved from here.
 */
export function exampleFillOf(document: FieldDocument, path: SectionPath, context: ReportFormContext = {}): ExampleFill | null {
  const form = reportFormAnswer(document, path, context)?.response?.form;
  if (!form) return null;
  const fields = formFields(form);
  const opened = initialValues(fields);
  const filled = exampleValues(fields, opened, form.example ?? {});
  const added = Object.keys(filled).some((name) => !(name in opened) || opened[name] !== filled[name]);
  if (!added) return { kind: 'nothing', title: form.title };
  const checked = validateFormValues(fields, filled);
  return checked.ok ? { kind: 'fill', title: form.title, values: checked.values } : { kind: 'missing', title: form.title };
}

export type ExampleProgress = { done: number; total: number };
/** How a fill of the whole report ended: what was saved, and what was left to do by hand. */
export type ExampleOutcome = { saved: number; skipped: string[]; failed?: string };

export const exampleProgressLine = ({ done, total }: ExampleProgress): string => `Completando ${Math.min(done + 1, total)} de ${total}…`;

/** «2 secciones completadas · Falta a mano: Fotos»; nothing to fill says so too. */
export function exampleOutcomeLine(outcome: ExampleOutcome): string {
  if (outcome.failed) return outcome.failed;
  const saved = outcome.saved === 0 ? 'Ya estaba todo lleno' : `${outcome.saved} ${outcome.saved === 1 ? 'sección completada' : 'secciones completadas'}`;
  return outcome.skipped.length ? `${saved} · Falta a mano: ${outcome.skipped.join(', ')}` : saved;
}

export type ExampleFiller = (onProgress: (progress: ExampleProgress) => void) => Promise<ExampleOutcome>;

/** The banner's fill: one that breaks ends as an outcome too, so the banner never stays busy. */
export async function runExampleFill(fill: ExampleFiller, onProgress: (progress: ExampleProgress) => void): Promise<ExampleOutcome> {
  try {
    return await fill(onProgress);
  } catch (error) {
    return { saved: 0, skipped: [], failed: `${EXAMPLE_FILL_FAILED}${error instanceof Error && error.message ? ` (${error.message})` : ''}` };
  }
}

/** The line under the banner: the progress while it fills, then how it ended; nothing before it starts. */
export function exampleBannerLine(progress: ExampleProgress | null, outcome: ExampleOutcome | null): string | null {
  if (progress) return progress.total ? exampleProgressLine(progress) : null;
  return outcome ? exampleOutcomeLine(outcome) : null;
}

/** A draft not made yet has no id: its service and type stand for it, and stay once Portal gives one. */
export const exampleDismissKeys = (serviceId: string, type: string, documentId: string | null): string[] => [`${serviceId}:${type}`, ...(documentId ? [documentId] : [])];

export function isExampleDismissed(dismissed: readonly string[], keys: readonly string[]): boolean {
  return keys.some((key) => dismissed.includes(key));
}

/** The device's list with this report's keys last; the oldest fall out past the limit. */
export function withExampleDismissed(dismissed: readonly string[], keys: readonly string[]): string[] {
  const kept = dismissed.filter((key) => !keys.includes(key));
  return [...kept, ...keys].slice(-EXAMPLE_DISMISSED_MAX);
}

/** What the device stored, or nothing when it is not a list of texts. */
export function parseExampleDismissed(stored: string | null): string[] {
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string').slice(-EXAMPLE_DISMISSED_MAX) : [];
  } catch {
    return [];
  }
}
