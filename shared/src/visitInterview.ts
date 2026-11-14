import type { FormSchemaProperty } from './appForms.js';
import type { VisitDocument } from './siteVisit.js';

/**
 * The visit's interview as lv03 draws it (Stitch `32a018203f8d4829bed09e35af2f7ca2`): one card per
 * Portal question (slots r01…r20), its options as big chips, «Respondida» on what is saved and
 * «Siguiente: n sin responder». PURE: the screen only draws it.
 */
export type InterviewOption = { value: string; label: string };
export type InterviewQuestion = { key: string; n: number; title: string; options: InterviewOption[]; value?: string };
export type Interview = { questions: InterviewQuestion[]; answered: number; total: number; next: string | null };

const INTERVIEW_SECTION = 'entrevista';
/** Slots r01…r20 are plain ASCII: no Intl collator per call (Hermes, gate rn-perf). */
const byKey = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function optionsOf(property: FormSchemaProperty): InterviewOption[] {
  if (property.oneOf?.length) return property.oneOf.filter((one) => one.const !== undefined).map((one) => ({ value: String(one.const), label: one.title ?? String(one.const) }));
  return (property.enum ?? []).map((value) => ({ value: String(value), label: property['x-labels']?.[String(value)] ?? String(value) }));
}

/** The interview with what Portal saved; null when the company has no questions. */
export function interviewOf(document: VisitDocument): Interview | null {
  const section = document.sections.find((one) => one.id === INTERVIEW_SECTION);
  const schema = section?.form ? document.forms[section.form] : undefined;
  const entries = Object.entries(schema?.properties ?? {}).sort(([a], [b]) => byKey(a, b));
  if (!section || !entries.length) return null;
  const questions = entries.map(([key, property], index) => {
    const saved = section.values[key];
    return { key, n: index + 1, title: property.title ?? key, options: optionsOf(property), ...(saved !== undefined && saved !== '' ? { value: saved } : {}) };
  });
  const answered = questions.filter((question) => question.value !== undefined).length;
  return { questions, answered, total: questions.length, next: questions.find((question) => question.value === undefined)?.key ?? null };
}
