/**
 * Dali phase 2 (BOTS-API «Fase 2: contrato», 16/11): what agentes knows about a prospect, sent in the same
 * `PUT /api/bots/prospects/:id` as phase 1. Every field is optional: one that does not come stays as it was,
 * and `null` clears it. Read the same way by the server and its fake. PURE.
 */

export const PROSPECT_STAGES = ['missing_info', 'to_quote', 'visit', 'quoted', 'negotiation', 'won', 'lost'] as const;
export type ProspectStage = (typeof PROSPECT_STAGES)[number];
export const PROSPECT_INTENTS = ['purchase', 'quote', 'information', 'other'] as const;
export type ProspectIntent = (typeof PROSPECT_INTENTS)[number];
export const PROSPECT_KINDS = ['company', 'person'] as const;
export type ProspectKind = (typeof PROSPECT_KINDS)[number];

export type ProspectService = { key: string; name: string };
export type ProspectField = { key: string; label: string; value: string };
export type ProspectFollowUpDraft = { text: string; forAt?: string };
/** Portal's quote linked by agentes. `amount` is money: only a space admin ever receives it. */
export type ProspectQuote = { code: string; amount?: number; currency?: string; sentAt?: string; url?: string };
export type ProspectQuestion = { question: string; at: string };

export type ProspectInsight = {
  stage?: ProspectStage;
  service?: ProspectService;
  intent?: ProspectIntent;
  score?: number;
  scoreReasons?: string[];
  fields?: ProspectField[];
  missing?: string[];
  readyAt?: string;
  kind?: ProspectKind;
  summary?: string;
  followUpDraft?: ProspectFollowUpDraft;
  quote?: ProspectQuote;
  unanswered?: ProspectQuestion[];
};
export type ProspectInsightKey = keyof ProspectInsight;
/** What one PUT changes: the fields that came, and the ones that came as `null`. */
export type ProspectInsightPatch = { set: ProspectInsight; unset: ProspectInsightKey[] };
/** A phase 2 field that came wrong: left as it was, and told back to agentes. */
export type IgnoredField = { field: string; message: string };

export const SERVICE_KEY = /^[a-z][a-z0-9_-]{0,39}$/;
export const FIELD_KEY = /^[a-z][a-z0-9_]{0,39}$/;
const SERVICE_NAME_MAX = 60;
const SCORE_MAX = 100;
const REASONS_MAX = 6;
const REASON_MAX = 80;
const FIELDS_MAX = 20;
const FIELD_LABEL_MAX = 40;
const FIELD_VALUE_MAX = 200;
const MISSING_MAX = 20;
const SUMMARY_MAX = 280;
/** Not in agentes' first draft of the contract: a WhatsApp follow-up, not a letter. */
const FOLLOW_UP_MAX = 1000;
const QUOTE_CODE_MAX = 40;
const CURRENCY = /^[A-Z]{3}$/;
const HTTPS_URL = /^https:\/\/\S{1,492}$/;
const UNANSWERED_MAX = 10;
const QUESTION_MAX = 200;
/** A phone or an id (7+ digits, spaced or not): never travels to the weekly review. */
const LONG_NUMBER = /\+?\d(?:[\s.-]?\d){6,}/g;
const MASK = '•••';

type Refusal = { ok: false; message: string };
type Read<T> = { ok: true; value: T } | Refusal;
const refuse = (message: string): Refusal => ({ ok: false, message });
const accept = <T>(value: T): Read<T> => ({ ok: true, value });
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const isIsoDate = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const trimmed = (value: unknown): string | null => (typeof value === 'string' ? value.trim() : null);

export const maskLongNumbers = (text: string): string => text.replace(LONG_NUMBER, MASK);

const oneOf =
  <T extends string>(options: readonly T[], name: string) =>
  (value: unknown): Read<T> =>
    options.includes(value as T) ? accept(value as T) : refuse(`${name} va como ${options.join(', ')}.`);

/** A trimmed text between 1 and `max` characters. */
function textOf(value: unknown, max: number): string | null {
  const text = trimmed(value);
  return text && text.length <= max ? text : null;
}

function serviceOf(value: unknown): Read<ProspectService> {
  const body = record(value);
  if (typeof body.key !== 'string' || !SERVICE_KEY.test(body.key)) return refuse('service.key va en minúsculas, números, _ o -, hasta 40.');
  const name = textOf(body.name, SERVICE_NAME_MAX);
  return name ? accept({ key: body.key, name }) : refuse(`service.name va como texto, hasta ${SERVICE_NAME_MAX}.`);
}

function scoreOf(value: unknown): Read<number> {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > SCORE_MAX) return refuse(`score va como número de 0 a ${SCORE_MAX}.`);
  return accept(Math.round(value));
}

function reasonsOf(value: unknown): Read<string[]> {
  if (!Array.isArray(value) || value.length > REASONS_MAX) return refuse(`score_reasons va como lista de hasta ${REASONS_MAX}.`);
  const reasons = value.map((reason) => textOf(reason, REASON_MAX));
  return reasons.every((reason): reason is string => reason !== null) ? accept(reasons) : refuse(`score_reasons lleva textos de hasta ${REASON_MAX}.`);
}

function fieldOf(value: unknown): ProspectField | null {
  const body = record(value);
  const label = textOf(body.label, FIELD_LABEL_MAX);
  const raw = typeof body.value === 'number' && Number.isFinite(body.value) ? String(body.value) : trimmed(body.value);
  if (typeof body.key !== 'string' || !FIELD_KEY.test(body.key) || !label || raw === null || raw.length > FIELD_VALUE_MAX) return null;
  return { key: body.key, label, value: raw };
}

function fieldsOf(value: unknown): Read<ProspectField[]> {
  const shape = `fields va como lista de hasta ${FIELDS_MAX} { key en minúsculas, label hasta ${FIELD_LABEL_MAX}, value hasta ${FIELD_VALUE_MAX} }, sin claves repetidas.`;
  if (!Array.isArray(value) || value.length > FIELDS_MAX) return refuse(shape);
  const fields = value.map(fieldOf);
  const valid = fields.every((field): field is ProspectField => field !== null);
  return valid && new Set(fields.map((field) => field.key)).size === fields.length ? accept(fields) : refuse(shape);
}

function missingOf(value: unknown): Read<string[]> {
  const valid = Array.isArray(value) && value.length <= MISSING_MAX && value.every((key) => typeof key === 'string' && FIELD_KEY.test(key));
  return valid ? accept(value as string[]) : refuse(`missing va como lista de hasta ${MISSING_MAX} claves de fields.`);
}

const dateOf = (name: string) => (value: unknown): Read<string> => (isIsoDate(value) ? accept(value) : refuse(`${name} va como fecha ISO.`));

function summaryOf(value: unknown): Read<string> {
  const summary = textOf(value, SUMMARY_MAX);
  return summary ? accept(summary) : refuse(`summary va como texto, hasta ${SUMMARY_MAX}.`);
}

function draftOf(value: unknown): Read<ProspectFollowUpDraft> {
  const body = record(value);
  const text = textOf(body.text, FOLLOW_UP_MAX);
  if (!text) return refuse(`follow_up_draft.text va como texto, hasta ${FOLLOW_UP_MAX}.`);
  if (body.for_at === undefined || body.for_at === null) return accept({ text });
  return isIsoDate(body.for_at) ? accept({ text, forAt: body.for_at }) : refuse('follow_up_draft.for_at va como fecha ISO.');
}

const amountOf = (value: unknown): Read<number> =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? accept(value) : refuse('quote.amount va como número de 0 en adelante.');
const currencyOf = (value: unknown): Read<string> =>
  typeof value === 'string' && CURRENCY.test(value) ? accept(value) : refuse('quote.currency va como código de 3 letras (PEN).');
const urlOf = (value: unknown): Read<string> => (typeof value === 'string' && HTTPS_URL.test(value) ? accept(value) : refuse('quote.url va con https, hasta 500.'));

type QuoteExtras = Omit<ProspectQuote, 'code'>;
const QUOTE_EXTRAS: readonly [wire: string, key: keyof QuoteExtras, read: (value: unknown) => Read<unknown>][] = [
  ['amount', 'amount', amountOf],
  ['currency', 'currency', currencyOf],
  ['sent_at', 'sentAt', dateOf('quote.sent_at')],
  ['url', 'url', urlOf],
];

/** The optional parts of a quote, or the first one that is wrong. */
function quoteExtrasOf(body: Record<string, unknown>): Read<QuoteExtras> {
  const extras: Record<string, unknown> = {};
  for (const [wire, key, read] of QUOTE_EXTRAS) {
    const value = body[wire];
    if (value === undefined || value === null) continue;
    const valid = read(value);
    if (!valid.ok) return valid;
    extras[key] = valid.value;
  }
  return accept(extras as QuoteExtras);
}

function quoteOf(value: unknown): Read<ProspectQuote> {
  const body = record(value);
  const code = textOf(body.code, QUOTE_CODE_MAX);
  if (!code) return refuse(`quote.code va como texto, hasta ${QUOTE_CODE_MAX}.`);
  const extras = quoteExtrasOf(body);
  return extras.ok ? accept({ code, ...extras.value }) : extras;
}

function questionOf(value: unknown): ProspectQuestion | null {
  const body = record(value);
  const question = textOf(body.question, QUESTION_MAX);
  return question && isIsoDate(body.at) ? { question: maskLongNumbers(question), at: body.at } : null;
}

function unansweredOf(value: unknown): Read<ProspectQuestion[]> {
  const shape = `unanswered va como lista de hasta ${UNANSWERED_MAX} { question hasta ${QUESTION_MAX}, at ISO }.`;
  if (!Array.isArray(value) || value.length > UNANSWERED_MAX) return refuse(shape);
  const questions = value.map(questionOf);
  return questions.every((question): question is ProspectQuestion => question !== null) ? accept(questions) : refuse(shape);
}

/** Each field of the wire, the name it is stored with, and how it is read. */
const READERS: readonly [wire: string, key: ProspectInsightKey, read: (value: unknown) => Read<unknown>][] = [
  ['stage', 'stage', oneOf(PROSPECT_STAGES, 'stage')],
  ['service', 'service', serviceOf],
  ['intent', 'intent', oneOf(PROSPECT_INTENTS, 'intent')],
  ['score', 'score', scoreOf],
  ['score_reasons', 'scoreReasons', reasonsOf],
  ['fields', 'fields', fieldsOf],
  ['missing', 'missing', missingOf],
  ['ready_at', 'readyAt', dateOf('ready_at')],
  ['kind', 'kind', oneOf(PROSPECT_KINDS, 'kind')],
  ['summary', 'summary', summaryOf],
  ['follow_up_draft', 'followUpDraft', draftOf],
  ['quote', 'quote', quoteOf],
  ['unanswered', 'unanswered', unansweredOf],
];

/**
 * The phase 2 fields of a prospect's PUT. A body without any of them changes nothing. A field that came wrong never
 * blocks the PUT: the prospect's channel (phase 1) matters more than its details, so it stays as it was and is told
 * back in `ignored`.
 */
export function validateProspectInsight(raw: unknown): { patch: ProspectInsightPatch; ignored: IgnoredField[] } {
  const body = record(raw);
  const patch: ProspectInsightPatch = { set: {}, unset: [] };
  const ignored: IgnoredField[] = [];
  for (const [wire, key, read] of READERS) {
    const value = body[wire];
    if (value === undefined) continue;
    if (value === null) {
      patch.unset.push(key);
      continue;
    }
    const valid = read(value);
    if (valid.ok) (patch.set as Record<string, unknown>)[key] = valid.value;
    else ignored.push({ field: wire, message: valid.message });
  }
  return { patch, ignored };
}
