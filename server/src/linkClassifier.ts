import { MAX_CATEGORY_NAME, platformLabel, type LinkCard, type LinkCategory } from '@lilachat/shared';
import type { ModelAsker } from './agentesModel.js';

/**
 * Lila picks the category of a link saved in a notes chat (José, 18/11): one model task with the card and the
 * chat's categories. She only proposes a NEW category when nothing fits; the person can move it after.
 * The model is agentes' choice (José, 18/11: no product holds a model key): this module asks for the task through
 * `agentesModel.ts` and never names a provider.
 */
const MAX_PROPOSED = 9;
const MAX_TEXT_IN_PROMPT = 1200;
const NULLABLE_NAME = { anyOf: [{ type: 'string' }, { type: 'null' }] };
const CLASSIFY_SCHEMA = { type: 'object', properties: { category: NULLABLE_NAME, new: NULLABLE_NAME }, required: ['category', 'new'], additionalProperties: false };
const PROPOSE_SCHEMA = { type: 'object', properties: { categories: { type: 'array', items: { type: 'string' } } }, required: ['categories'], additionalProperties: false };

export type ClassifyOutcome = { ok: true; categoryId: string | null; newCategory?: string } | { ok: false; reason: 'not_configured' | 'failed' };
export type ProposeOutcome = { ok: true; names: string[] } | { ok: false; reason: 'not_configured' | 'failed' };

/** `memberIds`: the chat's members; their space signs the ask to agentes. */
export interface LinkClassifier {
  classify(card: LinkCard, categories: readonly LinkCategory[], memberIds: readonly string[]): Promise<ClassifyOutcome>;
  propose(cards: readonly LinkCard[], memberIds: readonly string[]): Promise<ProposeOutcome>;
}

/** Fixed text first, so repeated calls share the same prefix. */
const CLASSIFY_SYSTEM = `Ordenas los enlaces que una persona guarda en un chat de notas (reels, videos y publicaciones de redes).
Elige la categoría de la lista que mejor describe DE QUÉ TRATA el enlace, por su texto, su autor y su plataforma.
Si ninguna encaja, propone UNA categoría nueva, corta (de 1 a 4 palabras, en español), que podría servir para otros enlaces parecidos.
Si el enlace no dice nada de su contenido, no inventes: responde category null y new null.
Responde SOLO un JSON en una línea: {"category": "<nombre exacto de la lista>" o null, "new": "<categoría nueva>" o null}.`;

const PROPOSE_SYSTEM = `Una persona guarda enlaces de redes en un chat de notas y quiere verlos ordenados por tema.
Propón entre 5 y 9 categorías cortas (de 1 a 4 palabras, en español) que cubran estos enlaces sin superponerse. Incluye «Fuera de tema» solo si hay enlaces que no tienen que ver con el resto.
Responde SOLO un JSON en una línea: {"categories": ["...", "..."]}.`;

function describeCard(card: LinkCard): string {
  const text = (card.text ?? '').slice(0, MAX_TEXT_IN_PROMPT);
  return [`Plataforma: ${platformLabel(card)}`, `Autor: ${card.author ?? 'desconocido'}`, `Texto: ${text || '(sin texto)'}`].join('\n');
}

export function classifierPrompt(card: LinkCard, categories: readonly LinkCategory[]): { system: string; user: string } {
  const list = categories.length ? categories.map((category) => `- ${category.name}`).join('\n') : '(todavía no hay categorías)';
  return { system: CLASSIFY_SYSTEM, user: `Categorías:\n${list}\n\nEnlace:\n${describeCard(card)}` };
}

const fold = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** The first `{…}` of the answer: the model may wrap it in a code fence. */
function firstJson(text: string): Record<string, unknown> | null {
  const raw = /\{[\s\S]*\}/.exec(text)?.[0];
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const cleanName = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const name = value.replace(/\s+/g, ' ').trim();
  return name && name.length <= MAX_CATEGORY_NAME ? name : null;
};

/** Read like an answer from a hostile client: only a name of the list, or a short new one. */
export function parseClassifierAnswer(text: string, categories: readonly LinkCategory[]): { categoryId: string | null; newCategory?: string } {
  const answer = firstJson(text);
  const byName = (value: unknown) => {
    const name = cleanName(value);
    return name ? categories.find((category) => fold(category.name) === fold(name)) : undefined;
  };
  const chosen = byName(answer?.category) ?? byName(answer?.new);
  if (chosen) return { categoryId: chosen.id };
  // A model that names a category the chat does not have yet is proposing it (E2E 18/11: it got lost).
  const fresh = cleanName(answer?.new) ?? cleanName(answer?.category);
  return fresh ? { categoryId: null, newCategory: fresh } : { categoryId: null };
}

export function parseProposedCategories(text: string): string[] {
  const raw = firstJson(text)?.categories;
  const names: string[] = [];
  for (const value of Array.isArray(raw) ? raw : []) {
    const name = cleanName(value);
    if (name && !names.some((taken) => fold(taken) === fold(name))) names.push(name);
  }
  return names.slice(0, MAX_PROPOSED);
}

/** Loaded on the first ask: `agentesModel` reaches the bots, which reach the link sorting that builds this. */
const askAgentes: ModelAsker = async (memberIds, request) => (await import('./agentesModel.js')).askAgentesModel(memberIds, request);

export function buildLinkClassifier(ask: ModelAsker = askAgentes): LinkClassifier {
  return {
    async classify(card, categories, memberIds) {
      const prompt = classifierPrompt(card, categories);
      const answer = await ask(memberIds, { task: 'link.classify', system: prompt.system, input: prompt.user, schema: CLASSIFY_SCHEMA });
      return answer.ok ? { ok: true, ...parseClassifierAnswer(JSON.stringify(answer.json ?? null), categories) } : answer;
    },
    async propose(cards, memberIds) {
      const list = cards.map((card, index) => `${index + 1}.\n${describeCard(card)}`).join('\n\n');
      const answer = await ask(memberIds, { task: 'link.propose', system: PROPOSE_SYSTEM, input: `Enlaces:\n${list}`, schema: PROPOSE_SCHEMA });
      return answer.ok ? { ok: true, names: parseProposedCategories(JSON.stringify(answer.json ?? null)) } : answer;
    },
  };
}
