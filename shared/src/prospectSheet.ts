import { shownProspectPhone } from './prospects.js';
import { STAGE_LABEL, shownStageOf, type ProspectView } from './prospectBoard.js';
import type { ProspectQuote, ProspectStage } from './prospectInsight.js';
import { LOSS_REASON_LABEL, NEXT_ACTION_LABEL, type LossReason, type NextActionKind, type ProspectOutcome } from './prospectSeller.js';
import { nextActionWhenOf, suggestNextAction, whenOptions, type Suggestion } from './prospectPlan.js';
import type { SellerPatch } from './prospectChange.js';
import { moneyOf } from './serviceBilling.js';

/**
 * A Dali prospect's conversation and ficha (dl-02, dl-03) and the forms a seller fills (dl-06, dl-07, dl-09): what the
 * strip under the header says, the stages walked, the quote's amount, the dates in Lima, who it can be passed to, and
 * what each form asks before it saves. The screens only draw what these return. PURE.
 */

const HOUR_MS = 3_600_000;
const LIMA_OFFSET_MS = -5 * HOUR_MS;
/** A time picked in the minute that is passing is not «already gone». */
const PAST_TOLERANCE_MS = 60_000;
/** The server's limits for the notes: a longer one is refused, so the forms take them from its own validator. */
export { NEXT_ACTION_NOTE_MAX as NEXT_ACTION_NOTE_LIMIT, RESULT_NOTE_MAX as RESULT_NOTE_LIMIT } from './prospectSeller.js';
export const PAST_TIME_MESSAGE = 'Esa hora ya pasó: elige otra.';
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** The stages a sale walks; lost is said apart, with its reason. */
export const STAGE_WALK: readonly ProspectStage[] = ['missing_info', 'to_quote', 'visit', 'quoted', 'negotiation', 'won'];

export type ProspectStrip = {
  /** Closed: «Ganado» or «Perdido · Precio», and nothing to take or hand back. */
  result: { won: boolean; label: string } | null;
  /** «Atiende Rosa Quispe», or «Sin asignar». */
  who: { label: string; taken: boolean };
  /** «Dali en pausa» while a person answers; else «Dali conversa». */
  state: string;
  canTake: boolean;
  canHandBack: boolean;
};
export type StageStep = { stage: ProspectStage; label: string; state: 'done' | 'current' | 'next' };
export type ResultDraft = { outcome: ProspectOutcome | null; reason: LossReason | null; note: string };
export type NextActionDraft = { kind: NextActionKind; at: string; remind: boolean; note: string };
/** What a form sends, or why it cannot yet. */
export type PlannedChange = { ok: true; patch: SellerPatch } | { ok: false; message: string };

/** «Ganado», «Perdido» or «Perdido · Precio». */
export function prospectResultLabelOf(result: { outcome: ProspectOutcome; reason?: LossReason }): string {
  if (result.outcome === 'won') return 'Ganado';
  return result.reason ? `Perdido · ${LOSS_REASON_LABEL[result.reason]}` : 'Perdido';
}

/** The strip under a prospect's header (dl-02): who attends it, whether Dali is paused, «Tomar» and «Devolver a Dali». */
export function prospectStripOf(prospect: Pick<ProspectView, 'result' | 'assignee' | 'attendedBy'>): ProspectStrip {
  const open = !prospect.result;
  const paused = prospect.attendedBy === 'human';
  return {
    result: prospect.result ? { won: prospect.result.outcome === 'won', label: prospectResultLabelOf(prospect.result) } : null,
    who: prospect.assignee ? { label: `Atiende ${prospect.assignee.name}`, taken: true } : { label: 'Sin asignar', taken: false },
    state: paused ? 'Dali en pausa' : 'Dali conversa',
    canTake: open && !prospect.assignee,
    canHandBack: open && paused,
  };
}

const stepState = (index: number, current: number): StageStep['state'] => {
  if (index < current) return 'done';
  return index === current ? 'current' : 'next';
};

/** The funnel's stages with the current one marked (dl-03); a lost prospect says so instead, with its reason. */
export function stageWalkOf(prospect: Pick<ProspectView, 'stage' | 'result'>): { lost: string | null; steps: StageStep[] } {
  const stage = shownStageOf(prospect);
  if (stage === 'lost') return { lost: prospect.result ? prospectResultLabelOf(prospect.result) : STAGE_LABEL.lost, steps: [] };
  const current = STAGE_WALK.indexOf(stage);
  return { lost: null, steps: STAGE_WALK.map((one, index) => ({ stage: one, label: STAGE_LABEL[one], state: stepState(index, current) })) };
}

/** The quote's amount as money; `null` when the server stripped it (only a space admin receives it). */
export function quoteAmountOf(quote: Pick<ProspectQuote, 'amount' | 'currency'>): string | null {
  if (quote.amount === undefined) return null;
  return quote.currency && quote.currency !== 'PEN' ? `${quote.currency} ${quote.amount.toFixed(2)}` : moneyOf(quote.amount);
}

const limaClock = (iso: string): Date => new Date(Date.parse(iso) + LIMA_OFFSET_MS);
const pad = (value: number): string => String(value).padStart(2, '0');
const dayOf = (clock: Date): string => `${clock.getUTCDate()} de ${MONTHS[clock.getUTCMonth()] ?? ''}`;

/** «Llegó el lunes 16 de noviembre, 10:42» (Lima): its first message, or when its channel was born. */
export function arrivalLabelOf(prospect: Pick<ProspectView, 'firstContactAt' | 'createdAt'>): string {
  const clock = limaClock(prospect.firstContactAt ?? prospect.createdAt);
  return `Llegó el ${WEEKDAYS[clock.getUTCDay()] ?? ''} ${dayOf(clock)}, ${pad(clock.getUTCHours())}:${pad(clock.getUTCMinutes())}`;
}

/** «Enviada el 16 de noviembre» (Lima). */
export const quoteSentLabelOf = (sentAt: string): string => `Enviada el ${dayOf(limaClock(sentAt))}`;

/** The origin block's line: the ad that brought it, or a message written straight to the company. */
export const originLineOf = (prospect: Pick<ProspectView, 'source'>): string => (prospect.source?.adTitle ? `Anuncio · ${prospect.source.adTitle}` : 'Escribió directo por WhatsApp');

/** Under the name in the result form: the service (there is no company field) and the phone. */
export const resultHeaderLineOf = (prospect: Pick<ProspectView, 'service' | 'phone'>): string => [prospect.service?.name, shownProspectPhone(prospect.phone)].filter(Boolean).join(' · ');

/** Calling a prospect is the phone's dialer, never a Lilachat call (the client is on WhatsApp, not in the app). */
export const prospectDialUrl = (phone: string): string => `tel:+${phone}`;

/** «Visita técnica · jue 19, 10:00». */
export const nextActionLineOf = (action: { kind: NextActionKind; at: string }, now: Date): string => `${NEXT_ACTION_LABEL[action.kind]} · ${nextActionWhenOf(action.at, now)}`;

/** «Llamar mañana 09:00.»: what Dali suggests, before its reason. */
export const suggestionLineOf = (suggestion: Pick<Suggestion, 'kind' | 'at'>, now: Date): string => `${NEXT_ACTION_LABEL[suggestion.kind]} ${nextActionWhenOf(suggestion.at, now).toLowerCase()}.`;

/** «Reasignar»: anyone takes one; whoever has it passes it to another member with an account, or lets it go. */
export function reassignChoicesOf<Member extends { userId?: string }>(members: readonly Member[], prospect: Pick<ProspectView, 'assignee'>, me: string): { takeIt: boolean; members: (Member & { userId: string })[] } {
  const holder = prospect.assignee?.id;
  const others = members.filter((member): member is Member & { userId: string } => Boolean(member.userId) && member.userId !== holder && member.userId !== me);
  return { takeIt: holder !== me, members: others };
}

/** The result form starts from the result already marked (to change it), or empty. */
export const resultDraftOf = (prospect: Pick<ProspectView, 'result'>): ResultDraft => ({ outcome: prospect.result?.outcome ?? null, reason: prospect.result?.reason ?? null, note: prospect.result?.note ?? '' });

/** What the result form asks before it can be saved: lost needs a reason, and «Otro» a line. */
export function resultMissingOf(draft: ResultDraft): string {
  if (!draft.outcome) return 'Elige si se ganó o se perdió.';
  if (draft.outcome === 'lost' && !draft.reason) return 'Elige por qué se perdió.';
  return draft.outcome === 'lost' && draft.reason === 'other' && !draft.note.trim() ? 'Cuenta en una línea qué pasó.' : '';
}

/** The result as the PATCH takes it: a win carries no reason (one picked before switching is dropped). */
export function resultPatchOf(draft: ResultDraft): PlannedChange {
  const missing = resultMissingOf(draft);
  if (!draft.outcome || missing) return { ok: false, message: missing };
  const note = draft.note.trim();
  const reason = draft.outcome === 'lost' && draft.reason ? { reason: draft.reason } : {};
  return { ok: true, patch: { result: { outcome: draft.outcome, ...reason, ...(note ? { note } : {}) } } };
}

/** The next-action form starts from the planned action, else Dali's suggestion, else a call at the first time offered. */
export function nextActionDraftOf(prospect: ProspectView, now: Date): NextActionDraft {
  const planned = prospect.nextAction;
  const suggestion = suggestNextAction(prospect, now);
  const soon = whenOptions(now)[0]?.at ?? now.toISOString();
  return { kind: planned?.kind ?? suggestion?.kind ?? 'call', at: planned?.at ?? suggestion?.at ?? soon, remind: true, note: planned?.note ?? '' };
}

/** The next action as the PATCH takes it; a time already gone is refused before it leaves. */
export function nextActionPatchOf(draft: NextActionDraft, now: Date): PlannedChange {
  if (Date.parse(draft.at) < now.getTime() - PAST_TOLERANCE_MS) return { ok: false, message: PAST_TIME_MESSAGE };
  const note = draft.note.trim();
  return { ok: true, patch: { next_action: { kind: draft.kind, at: draft.at, remind: draft.remind, ...(note ? { note } : {}) } } };
}
