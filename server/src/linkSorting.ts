import type { Types } from 'mongoose';
import { MAX_LINK_CATEGORIES, primerEnlace, type LinkCard, type LinkCategory } from '@lilachat/shared';
import { ChatModel, MessageModel, type Chat, type Message } from './chatModels.js';
import { buildLinkClassifier, type LinkClassifier } from './linkClassifier.js';
import { readLinkCard } from './linkReader.js';
import { emitToMembers } from './reparto.js';

/**
 * Links saved in a notes chat, sorted by category (José, 18/11). When the
 * chat's switch is on, every message with a link gets a card (`linkReader`)
 * and Lila's category (`linkClassifier`), whatever door it came through: the
 * phone's «Compartir», a paste or a forward — José shares from the network,
 * picks the chat and sends, and it sorts itself. Runs after the message is
 * delivered, in a small queue: the chat never waits for the network or the model.
 */
type Deps = {
  readCard: (url: string) => Promise<LinkCard>;
  classifier: LinkClassifier;
  emit: (members: readonly string[], event: string, frame: object) => void;
};

let deps: Deps = { readCard: (url) => readLinkCard(url), classifier: buildLinkClassifier(), emit: emitToMembers };

export function configureLinkSorting(overrides: Partial<Deps>): void {
  deps = { ...deps, ...overrides };
}

const MAX_PARALLEL = 2;
/** A chat that receives a flood of links (a mass forward) stops costing calls for the day. */
const MAX_CLASSIFICATIONS_PER_DAY = 300;
const BACKFILL_LIMIT = 1000;

const waiting: (() => Promise<void>)[] = [];
let running = 0;
let idle: (() => void)[] = [];

function pump(): void {
  while (running < MAX_PARALLEL && waiting.length > 0) {
    const job = waiting.shift()!;
    running += 1;
    void job()
      .catch((error) => console.error('[links] job failed:', (error as Error)?.message ?? error))
      .finally(() => {
        running -= 1;
        pump();
      });
  }
  if (running === 0 && waiting.length === 0) {
    for (const resolve of idle) resolve();
    idle = [];
  }
}

function enqueue(job: () => Promise<void>): void {
  waiting.push(job);
  pump();
}

/** For tests and the backfill CLI: resolves once the queue is empty. */
export function drainLinkSorting(): Promise<void> {
  if (running === 0 && waiting.length === 0) return Promise.resolve();
  return new Promise((resolve) => idle.push(resolve));
}

/** Called for every new message (`avisarMensajeNuevo`): cheap when it has no link. */
export function queueLinkSorting(message: Pick<Message, 'chatId' | 'seq' | 'body' | 'envelope'>): void {
  if (message.envelope || !primerEnlace(message.body)) return;
  enqueue(() => sortLinkMessage(String(message.chatId), message.seq));
}

type SortingChat = Pick<Chat, '_id' | 'members' | 'linkSorting'>;

const categoriesOf = (chat: SortingChat): LinkCategory[] => (chat.linkSorting?.categories ?? []).map((category) => ({ id: String(category._id), name: category.name }));
const membersOf = (chat: SortingChat) => chat.members.map((member) => String(member.userId));

async function sortingChat(chatId: string): Promise<SortingChat | null> {
  return ChatModel.findOne({ _id: chatId, kind: 'notas', 'linkSorting.enabled': true }).select('linkSorting members.userId').lean<SortingChat | null>();
}

const classifiedToday = new Map<string, { day: string; count: number }>();

function underDailyCap(chatId: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const today = classifiedToday.get(chatId);
  const count = today?.day === day ? today.count : 0;
  classifiedToday.set(chatId, { day, count: count + 1 });
  return count < MAX_CLASSIFICATIONS_PER_DAY;
}

/** A category Lila proposed, unless the chat already has the maximum. Returns its id. */
async function addLilaCategory(chatId: string, name: string): Promise<string | null> {
  const updated = await ChatModel.findOneAndUpdate(
    { _id: chatId, [`linkSorting.categories.${MAX_LINK_CATEGORIES - 1}`]: { $exists: false } },
    { $push: { 'linkSorting.categories': { name, by: 'lila' } } },
    { returnDocument: 'after', projection: { 'linkSorting.categories': 1 } }
  ).lean<SortingChat | null>();
  const created = updated?.linkSorting?.categories.at(-1);
  return created ? String(created._id) : null;
}

type Placement = Pick<LinkCard, 'categoryId' | 'categoryBy'>;

/** A person's choice stays; otherwise Lila picks, or proposes a new one when none fits. */
async function placeLink(chat: SortingChat, card: LinkCard, previous: LinkCard | undefined): Promise<Placement> {
  if (previous?.categoryBy === 'user') return { categoryId: previous.categoryId ?? null, categoryBy: 'user' };
  if (card.status !== 'ready' || !underDailyCap(String(chat._id))) return { categoryId: null };
  const answer = await deps.classifier.classify(card, categoriesOf(chat));
  if (!answer.ok) return { categoryId: null };
  if (answer.categoryId) return { categoryId: answer.categoryId, categoryBy: 'lila' };
  const created = answer.newCategory ? await addLilaCategory(String(chat._id), answer.newCategory) : null;
  return created ? { categoryId: created, categoryBy: 'lila' } : { categoryId: null };
}

async function storeLink(chat: SortingChat, seq: number, link: LinkCard): Promise<void> {
  await MessageModel.updateOne({ chatId: chat._id, seq }, { $set: { link } });
  deps.emit(membersOf(chat), 'msg.link', { chatId: String(chat._id), seq, link });
}

/** Read the card and place it: a new message, or `force` for «Reintentar» on an unreadable one. */
export async function sortLinkMessage(chatId: string, seq: number, options: { force?: boolean } = {}): Promise<void> {
  const chat = await sortingChat(chatId);
  if (!chat) return;
  const message = await MessageModel.findOne({ chatId, seq, deletedAt: { $exists: false } }).select('body link').lean<Pick<Message, 'body' | 'link'> | null>();
  const url = primerEnlace(message?.body);
  // A retried send is announced twice: the first pass already stored its card.
  if (!message || !url || (message.link && !options.force)) return;
  const card = await deps.readCard(url);
  const fresh = (await sortingChat(chatId)) ?? chat;
  await storeLink(fresh, seq, { ...card, ...(await placeLink(fresh, card, message.link)) });
}

/**
 * Switching it on sorts what the chat already has: read every card first, ask
 * Lila for categories when the chat has none (or take the ones given), then
 * place each link. One job, so the backfill does not flood the model.
 */
async function backfill(chatId: string): Promise<void> {
  const messages = await MessageModel.find({ chatId, deletedAt: { $exists: false }, body: /https?:\/\/|www\./ })
    .sort({ seq: 1 })
    .limit(BACKFILL_LIMIT)
    .select('seq body link')
    .lean<Pick<Message, 'seq' | 'body' | 'link'>[]>();
  const read: { seq: number; card: LinkCard; previous?: LinkCard }[] = [];
  for (const message of messages) {
    const url = primerEnlace(message.body);
    if (url) read.push({ seq: message.seq, card: await deps.readCard(url), previous: message.link });
  }
  let chat = await sortingChat(chatId);
  if (chat && categoriesOf(chat).length === 0) chat = await proposeCategories(chat, read.map((one) => one.card));
  for (const one of read) {
    chat = (await sortingChat(chatId)) ?? null;
    if (!chat) return;
    await storeLink(chat, one.seq, { ...one.card, ...(await placeLink(chat, one.card, one.previous)) });
  }
}

async function proposeCategories(chat: SortingChat, cards: LinkCard[]): Promise<SortingChat | null> {
  const ready = cards.filter((card) => card.status === 'ready');
  if (ready.length === 0) return chat;
  const answer = await deps.classifier.propose(ready);
  if (!answer.ok || answer.names.length === 0) return chat;
  const categories = answer.names.slice(0, MAX_LINK_CATEGORIES).map((name) => ({ name, by: 'lila' as const }));
  await ChatModel.updateOne({ _id: chat._id }, { $set: { 'linkSorting.categories': categories } });
  return sortingChat(String(chat._id));
}

const cleanSeed = (seed: readonly string[] | undefined) =>
  [...new Set((seed ?? []).map((name) => String(name).replace(/\s+/g, ' ').trim()).filter((name) => name && name.length <= 40))].slice(0, MAX_LINK_CATEGORIES);

export type SwitchResult = { ok: true; members: string[] } | { ok: false; status: 404 | 409; message: string };

/** The chat's switch (José's decision, 18/11: off by default, per chat). `seed`: the first categories. */
export async function setLinkSorting(params: { chatId: string; userId: Types.ObjectId; enabled: boolean; seed?: readonly string[] }): Promise<SwitchResult> {
  const chat = await ChatModel.findOne({ _id: params.chatId, 'members.userId': params.userId }).select('kind linkSorting members.userId').lean<Chat | null>();
  if (!chat) return { ok: false, status: 404, message: 'No encontramos ese chat.' };
  if (chat.kind !== 'notas') return { ok: false, status: 409, message: 'Solo los chats de notas se ordenan por categoría.' };
  const seed = cleanSeed(params.seed);
  const categories = chat.linkSorting?.categories?.length ? chat.linkSorting.categories : seed.map((name) => ({ name, by: 'user' as const }));
  await ChatModel.updateOne({ _id: chat._id }, { $set: { linkSorting: { enabled: params.enabled, categories } } });
  if (params.enabled) enqueue(() => backfill(params.chatId));
  return { ok: true, members: membersOf(chat) };
}
