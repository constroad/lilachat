/**
 * What a seller decides about a Dali prospect in Lilachat (BOTS-API «Fase 2: contrato», 16/11): who attends it,
 * the next action and the result. Lilachat owns these and tells agentes with `prospect.updated`. Every change
 * carries the `version` the seller saw, so two people taking the same prospect at once never both win. PURE.
 */

export const NEXT_ACTION_KINDS = ['call', 'whatsapp', 'visit', 'quote'] as const;
export type NextActionKind = (typeof NEXT_ACTION_KINDS)[number];
export const NEXT_ACTION_LABEL: Record<NextActionKind, string> = { call: 'Llamar', whatsapp: 'Escribir por WhatsApp', visit: 'Visita técnica', quote: 'Enviar cotización' };

export const PROSPECT_OUTCOMES = ['won', 'lost'] as const;
export type ProspectOutcome = (typeof PROSPECT_OUTCOMES)[number];
export const LOSS_REASONS = ['price', 'timing', 'zone', 'competitor', 'no_answer', 'not_a_buyer', 'other'] as const;
export type LossReason = (typeof LOSS_REASONS)[number];
export const LOSS_REASON_LABEL: Record<LossReason, string> = {
  price: 'Precio',
  timing: 'No era el momento',
  zone: 'Fuera de zona',
  competitor: 'Compró a otro',
  no_answer: 'No respondió',
  not_a_buyer: 'Solo consultaba',
  other: 'Otro',
};

/** `me` takes it; `{ id }` gives it to another active member; `null` leaves it free. */
export type SellerAssignee = 'me' | { id: string } | null;
/** Without `assigneeId`, the next action is for the person who sets it. `remind` rings the Agenda (on unless turned off). */
export type SellerNextAction = { kind: NextActionKind; at: string; assigneeId?: string; note?: string; remind: boolean };
export type SellerResult = { outcome: ProspectOutcome; reason?: LossReason; note?: string };
export type SellerChange = { version: number; assignee?: SellerAssignee; nextAction?: SellerNextAction | null; result?: SellerResult | null };

const OBJECT_ID = /^[a-f0-9]{24}$/i;
export const NEXT_ACTION_NOTE_MAX = 200;
export const RESULT_NOTE_MAX = 280;

type Refusal = { ok: false; message: string };
type Read<T> = { ok: true; value: T } | Refusal;
const refuse = (message: string): Refusal => ({ ok: false, message });
const accept = <T>(value: T): Read<T> => ({ ok: true, value });
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const isIsoDate = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));

/** An optional note: absent or blank is none; a text longer than `max` is refused. */
function noteOf(value: unknown, max: number, name: string): Read<string | undefined> {
  if (value === undefined || value === null) return accept(undefined);
  if (typeof value !== 'string' || value.trim().length > max) return refuse(`${name} va como texto, hasta ${max}.`);
  return accept(value.trim() || undefined);
}

function assigneeOf(value: unknown): Read<SellerAssignee> {
  if (value === null || value === 'me') return accept(value);
  const id = record(value).id;
  return typeof id === 'string' && OBJECT_ID.test(id) ? accept({ id }) : refuse('assignee va como me, null o { id } de un miembro.');
}

function nextActionOf(value: unknown): Read<SellerNextAction | null> {
  if (value === null) return accept(null);
  const body = record(value);
  if (!NEXT_ACTION_KINDS.includes(body.kind as NextActionKind)) return refuse(`next_action.kind va como ${NEXT_ACTION_KINDS.join(', ')}.`);
  if (!isIsoDate(body.at)) return refuse('next_action.at va como fecha ISO.');
  if (body.assignee_id !== undefined && (typeof body.assignee_id !== 'string' || !OBJECT_ID.test(body.assignee_id))) return refuse('next_action.assignee_id va como el id de un miembro.');
  const note = noteOf(body.note, NEXT_ACTION_NOTE_MAX, 'next_action.note');
  if (!note.ok) return note;
  const action: SellerNextAction = { kind: body.kind as NextActionKind, at: body.at, remind: body.remind !== false };
  if (typeof body.assignee_id === 'string') action.assigneeId = body.assignee_id;
  if (note.value) action.note = note.value;
  return accept(action);
}

/** A loss needs its reason, and «other» its note; a win takes no reason. */
function reasonOf(outcome: ProspectOutcome, reason: unknown, note: string | undefined): Read<LossReason | undefined> {
  if (outcome === 'won') return reason === undefined || reason === null ? accept(undefined) : refuse('result.reason solo va con lost.');
  if (!LOSS_REASONS.includes(reason as LossReason)) return refuse(`result.reason va como ${LOSS_REASONS.join(', ')}.`);
  return reason === 'other' && !note ? refuse('result.note hace falta cuando el motivo es other.') : accept(reason as LossReason);
}

function resultOf(value: unknown): Read<SellerResult | null> {
  if (value === null) return accept(null);
  const body = record(value);
  if (!PROSPECT_OUTCOMES.includes(body.outcome as ProspectOutcome)) return refuse('result.outcome va como won o lost.');
  const outcome = body.outcome as ProspectOutcome;
  const note = noteOf(body.note, RESULT_NOTE_MAX, 'result.note');
  if (!note.ok) return note;
  const reason = reasonOf(outcome, body.reason, note.value);
  if (!reason.ok) return reason;
  return accept({ outcome, ...(reason.value ? { reason: reason.value } : {}), ...(note.value ? { note: note.value } : {}) });
}

/** The body of a seller's change. `version` is the one the seller saw; at least one decision comes with it. */
export function validateSellerChange(raw: unknown): { ok: true; change: SellerChange } | Refusal {
  const body = record(raw);
  if (typeof body.version !== 'number' || !Number.isInteger(body.version) || body.version < 0) return refuse('version va como el número que viste, desde 0.');
  if (body.assignee === undefined && body.next_action === undefined && body.result === undefined) return refuse('Nada que cambiar: falta assignee, next_action o result.');
  const change: SellerChange = { version: body.version };
  const parts = [
    ['assignee', body.assignee, assigneeOf],
    ['nextAction', body.next_action, nextActionOf],
    ['result', body.result, resultOf],
  ] as const;
  for (const [key, value, read] of parts) {
    if (value === undefined) continue;
    const valid = (read as (value: unknown) => Read<unknown>)(value);
    if (!valid.ok) return valid;
    (change as Record<string, unknown>)[key] = valid.value;
  }
  return { ok: true, change };
}
