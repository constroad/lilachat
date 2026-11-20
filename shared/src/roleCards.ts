import type { FormField, FormValues } from './appForms.js';
import { isBlankAnswer, sectionHasError } from './appFormSections.js';

/**
 * «Responsables y firmas» of a CTL-IMP drawn as role cards (design imp-04, José 20/11): one card per
 * role, one open at a time, the others a row with the name. Only the look: each field keeps its name
 * and saves the same value. PURE: app and web.
 */
export type RoleCard<F extends FormField = FormField> = {
  label: string;
  /** The role's fields, each named without the role: «Responsable · nombre» → «Nombre». */
  fields: F[];
  /** What the folded row says: «Ana Torres · Supervisora», or `ROLE_EMPTY_LINE`. */
  line: string;
  /** «AT»; the role's initial while it has no name. */
  initials: string;
  filled: boolean;
};

export const ROLE_EMPTY_LINE = 'Sin datos';
export const ROLE_CARDS_HINT = 'Toca una tarjeta para editar';
export const ROLE_CARDS_OPTIONAL = 'Todo es opcional';
/** Name and position: what the folded row shows of a role. */
const LINE_FIELDS = 2;
const INITIALS_MAX = 2;
const LABEL_SEPARATOR = ' · ';

const capitalized = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** «Responsable · nombre» → «Nombre»; a label without the role stays as it is. */
function ownLabel(label: string, role: string): string {
  const prefix = `${role}${LABEL_SEPARATOR}`;
  return label.toLowerCase().startsWith(prefix.toLowerCase()) ? capitalized(label.slice(prefix.length).trim()) : label;
}

const textOf = (value: unknown): string => (typeof value === 'string' || typeof value === 'number' ? String(value).replace(/\s+/g, ' ').trim() : '');

function initialsOf(name: string, role: string): string {
  const words = name.split(' ').filter((word) => /\p{L}/u.test(word.charAt(0)));
  const letters = words.slice(0, INITIALS_MAX).map((word) => word.charAt(0)).join('');
  return (letters || role.charAt(0)).toUpperCase();
}

/** The cards of a form whose fields sit under a role (`x-section`), in order; plain fields are not theirs. */
export function roleCardsOf<F extends FormField>(fields: readonly F[], values: FormValues): RoleCard<F>[] {
  const cards: RoleCard<F>[] = [];
  for (const field of fields) {
    const label = field.section?.label;
    if (!label) continue;
    const own = { ...field, label: ownLabel(field.label, label) };
    const last = cards[cards.length - 1];
    if (last?.label === label) last.fields.push(own);
    else cards.push({ label, fields: [own], line: '', initials: '', filled: false });
  }
  return cards.map((card) => {
    const shown = card.fields.slice(0, LINE_FIELDS).map((field) => textOf(values[field.name])).filter(Boolean);
    const filled = card.fields.some((field) => !isBlankAnswer(values[field.name]));
    return { ...card, line: shown.join(LABEL_SEPARATOR) || ROLE_EMPTY_LINE, initials: initialsOf(textOf(values[card.fields[0]!.name]), card.label), filled };
  });
}

/**
 * The card open: the first with an error, so nothing refused hides; else the one the person picked (`null`: they
 * folded it), else the first. `undefined`: nothing picked yet.
 */
export function openRoleOf(cards: readonly RoleCard[], errors: Readonly<Record<string, string>>, picked: string | null | undefined): string | null {
  const failed = cards.find((card) => sectionHasError(card.fields, errors));
  if (failed) return failed.label;
  if (picked === null) return null;
  if (picked !== undefined && cards.some((card) => card.label === picked)) return picked;
  return cards[0]?.label ?? null;
}

/** The line over the cards: one «opcional» for all instead of one per field (José 20/11). */
export function roleCardsNote(cards: readonly RoleCard[]): string {
  const optional = cards.every((card) => card.fields.every((field) => !field.required));
  return optional ? `${ROLE_CARDS_OPTIONAL} · ${ROLE_CARDS_HINT.toLowerCase()}` : ROLE_CARDS_HINT;
}
