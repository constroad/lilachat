/**
 * «Lo que Dali sabe» (dl-12) and «Enseñarle a Dali» (dl-13), BOTS-API «Fase 2: contrato». agentes is the source of
 * what Dali knows; Lilachat only shows it, and money (prices, the price policy) only to a space admin. The one write
 * from Lilachat ADDS a FAQ. agentes' answer is read leniently: a malformed item is dropped, not the whole page. PURE.
 */

export type DaliPricePolicy = { visible: boolean; basis?: string };
/** What Dali asks for a service (agentes 8a3a856/272c0c4): `common` ones are asked in every service and come repeated in each. */
export type DaliQuestion = { key?: string; label: string; required: boolean; common: boolean };
export type DaliService = { key: string; name: string; questions: DaliQuestion[]; pricePolicy?: DaliPricePolicy };
export type DaliCatalogItem = { serviceKey: string; name: string; unit?: string; price?: number };
export type DaliFaq = { id: string; question: string; answer: string };
export type DaliKnowledge = { services: DaliService[]; catalog: DaliCatalogItem[]; faqs: DaliFaq[]; zone?: string; hours?: string; editUrl?: string };
export type DaliFaqAdd = { question: string; answer: string; idempotencyKey: string };

const SERVICES_MAX = 60;
const CATALOG_MAX = 500;
const FAQS_MAX = 300;
const QUESTIONS_MAX = 20;
const NAME_MAX = 120;
const TEXT_MAX = 2000;
const FAQ_QUESTION_MAX = 200;
const FAQ_ANSWER_MAX = 1000;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,64}$/;
const HTTPS_URL = /^https:\/\/\S{1,492}$/;
export const OTHER_SERVICES = 'Otros';

type Refusal = { ok: false; message: string };
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const listOf = (value: unknown, max: number): unknown[] => (Array.isArray(value) ? value.slice(0, max) : []);
/** A trimmed text of 1 to `max` characters, or nothing. */
const textOf = (value: unknown, max: number): string | undefined => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && text.length <= max ? text : undefined;
};

function policyOf(value: unknown): DaliPricePolicy | undefined {
  const body = record(value);
  if (typeof body.visible !== 'boolean') return undefined;
  const basis = textOf(body.basis, TEXT_MAX);
  return { visible: body.visible, ...(basis ? { basis } : {}) };
}

/** A question as agentes sends it (`{ key, label, required }`), or a plain text from an older answer. */
function questionOf(value: unknown): DaliQuestion | null {
  const plain = textOf(value, TEXT_MAX);
  if (plain) return { label: plain, required: false, common: false };
  const body = record(value);
  const label = textOf(body.label, TEXT_MAX);
  const key = textOf(body.key, NAME_MAX);
  return label ? { ...(key ? { key } : {}), label, required: body.required === true, common: body.common === true } : null;
}

function serviceOf(value: unknown, admin: boolean): DaliService | null {
  const body = record(value);
  const key = textOf(body.key, NAME_MAX);
  const name = textOf(body.name, NAME_MAX);
  if (!key || !name) return null;
  const questions = listOf(body.questions, QUESTIONS_MAX).flatMap((question) => questionOf(question) ?? []);
  const policy = admin ? policyOf(body.price_policy) : undefined;
  return { key, name, questions, ...(policy ? { pricePolicy: policy } : {}) };
}

function catalogItemOf(value: unknown, admin: boolean): DaliCatalogItem | null {
  const body = record(value);
  const serviceKey = textOf(body.service_key, NAME_MAX);
  const name = textOf(body.name, NAME_MAX);
  if (!serviceKey || !name) return null;
  const unit = textOf(body.unit, NAME_MAX);
  const price = admin && typeof body.price === 'number' && Number.isFinite(body.price) ? body.price : undefined;
  return { serviceKey, name, ...(unit ? { unit } : {}), ...(price !== undefined ? { price } : {}) };
}

function faqOf(value: unknown): DaliFaq | null {
  const body = record(value);
  const id = textOf(body.id, NAME_MAX);
  const question = textOf(body.question, TEXT_MAX);
  const answer = textOf(body.answer, TEXT_MAX);
  return id && question && answer ? { id, question, answer } : null;
}

/** agentes' answer to `dali.knowledge.requested`, for this person: null when it is not the contract. */
export function knowledgeViewOf(raw: unknown, admin: boolean): DaliKnowledge | null {
  const body = record(raw);
  if (!Array.isArray(body.services) && !Array.isArray(body.catalog) && !Array.isArray(body.faqs)) return null;
  const zone = textOf(body.zone, TEXT_MAX);
  const hours = textOf(body.hours, TEXT_MAX);
  const editUrl = typeof body.edit_url === 'string' && HTTPS_URL.test(body.edit_url) ? body.edit_url : undefined;
  return {
    services: listOf(body.services, SERVICES_MAX).flatMap((one) => serviceOf(one, admin) ?? []),
    catalog: listOf(body.catalog, CATALOG_MAX).flatMap((one) => catalogItemOf(one, admin) ?? []),
    faqs: listOf(body.faqs, FAQS_MAX).flatMap((one) => faqOf(one) ?? []),
    ...(zone ? { zone } : {}),
    ...(hours ? { hours } : {}),
    ...(editUrl ? { editUrl } : {}),
  };
}

/** The catalog under each service, in the services' order; items of a service Dali does not list go under «Otros». */
export function catalogByService(knowledge: DaliKnowledge): { key: string; name: string; items: DaliCatalogItem[] }[] {
  const known = new Set(knowledge.services.map((service) => service.key));
  const groups = knowledge.services.map((service) => ({ key: service.key, name: service.name, items: knowledge.catalog.filter((item) => item.serviceKey === service.key) }));
  const others = knowledge.catalog.filter((item) => !known.has(item.serviceKey));
  return [...groups, ...(others.length ? [{ key: '', name: OTHER_SERVICES, items: others }] : [])].filter((group) => group.items.length > 0);
}

/** The questions of every service once («para todos los servicios», by key), and each service with only its own. */
export function questionsOf(knowledge: DaliKnowledge): { common: DaliQuestion[]; services: { key: string; name: string; questions: DaliQuestion[] }[] } {
  const common = new Map<string, DaliQuestion>();
  for (const question of knowledge.services.flatMap((service) => service.questions)) {
    if (question.common && !common.has(question.key ?? question.label)) common.set(question.key ?? question.label, question);
  }
  const services = knowledge.services.map((service) => ({ key: service.key, name: service.name, questions: service.questions.filter((question) => !question.common) }));
  return { common: [...common.values()], services };
}

/** «Enseñarle a Dali»: one question and its answer, with the form's key so a resend never adds it twice. */
export function validateFaqAdd(raw: unknown): { ok: true; faq: DaliFaqAdd } | Refusal {
  const body = record(raw);
  const question = textOf(body.question, FAQ_QUESTION_MAX);
  if (!question) return { ok: false, message: `question va como texto, hasta ${FAQ_QUESTION_MAX}.` };
  const answer = textOf(body.answer, FAQ_ANSWER_MAX);
  if (!answer) return { ok: false, message: `answer va como texto, hasta ${FAQ_ANSWER_MAX}.` };
  if (typeof body.idempotency_key !== 'string' || !IDEMPOTENCY_KEY.test(body.idempotency_key)) return { ok: false, message: 'idempotency_key va con letras, números, _ o -, de 8 a 64.' };
  return { ok: true, faq: { question, answer, idempotencyKey: body.idempotency_key } };
}
