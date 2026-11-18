import { Types } from 'mongoose';
import { MAX_CATEGORY_NAME, MAX_LINK_CATEGORIES, type LinkCard, type LinkCategory, type LinkNoteItem } from '@lilachat/shared';
import { ChatModel, MessageModel, type Chat, type Message } from './chatModels.js';

/**
 * What a person does with the categories of a notes chat (José, 18/11: Lila
 * picks, the person corrects): see the links, move one, create, rename, and merge one
 * category into another (or into «Sin categoría»). Any member of the chat may.
 */
export type OpResult<T = object> = ({ ok: true; members: string[] } & T) | { ok: false; status: 400 | 404 | 409; message: string };

const NOT_FOUND = { ok: false as const, status: 404 as const, message: 'No encontramos ese chat.' };
const LIST_LIMIT = 1000;

type NotesChat = Pick<Chat, '_id' | 'members' | 'linkSorting'>;

async function notesChatOf(chatId: string, userId: Types.ObjectId): Promise<NotesChat | null> {
  if (!Types.ObjectId.isValid(chatId)) return null;
  return ChatModel.findOne({ _id: chatId, kind: 'notas', 'members.userId': userId }).select('linkSorting members.userId').lean<NotesChat | null>();
}

const membersOf = (chat: NotesChat) => chat.members.map((member) => String(member.userId));
const categoriesOf = (chat: NotesChat): LinkCategory[] => (chat.linkSorting?.categories ?? []).map((category) => ({ id: String(category._id), name: category.name }));

function cleanName(raw: unknown): string | null {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  return name && name.length <= MAX_CATEGORY_NAME ? name : null;
}

const fold = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const taken = (chat: NotesChat, name: string, except?: string) => categoriesOf(chat).some((category) => category.id !== except && fold(category.name) === fold(name));

export async function listLinks(chatId: string, userId: Types.ObjectId): Promise<OpResult<{ enabled: boolean; categories: LinkCategory[]; items: LinkNoteItem[] }>> {
  const chat = await notesChatOf(chatId, userId);
  if (!chat) return NOT_FOUND;
  const messages = await MessageModel.find({ chatId: chat._id, 'link.url': { $exists: true }, deletedAt: { $exists: false } })
    .sort({ seq: -1 })
    .limit(LIST_LIMIT)
    .select('seq at link')
    .lean<Pick<Message, 'seq' | 'at' | 'link'>[]>();
  const items = messages.map((message) => ({ seq: message.seq, at: new Date(message.at).toISOString(), link: message.link as LinkCard }));
  return { ok: true, members: membersOf(chat), enabled: Boolean(chat.linkSorting?.enabled), categories: categoriesOf(chat), items };
}

export async function createCategory(chatId: string, userId: Types.ObjectId, rawName: unknown): Promise<OpResult<{ category: LinkCategory }>> {
  const chat = await notesChatOf(chatId, userId);
  if (!chat) return NOT_FOUND;
  const name = cleanName(rawName);
  if (!name) return { ok: false, status: 400, message: `El nombre va de 1 a ${MAX_CATEGORY_NAME} letras.` };
  if (taken(chat, name)) return { ok: false, status: 409, message: 'Ya tienes una categoría con ese nombre.' };
  if (categoriesOf(chat).length >= MAX_LINK_CATEGORIES) return { ok: false, status: 409, message: `Llegaste a ${MAX_LINK_CATEGORIES} categorías: une dos antes de crear otra.` };
  const _id = new Types.ObjectId();
  await ChatModel.updateOne({ _id: chat._id }, { $push: { 'linkSorting.categories': { _id, name, by: 'user' } } });
  return { ok: true, members: membersOf(chat), category: { id: String(_id), name } };
}

export async function renameCategory(chatId: string, userId: Types.ObjectId, categoryId: string, rawName: unknown): Promise<OpResult> {
  const chat = await notesChatOf(chatId, userId);
  if (!chat || !categoriesOf(chat).some((category) => category.id === categoryId)) return NOT_FOUND;
  const name = cleanName(rawName);
  if (!name) return { ok: false, status: 400, message: `El nombre va de 1 a ${MAX_CATEGORY_NAME} letras.` };
  if (taken(chat, name, categoryId)) return { ok: false, status: 409, message: 'Ya tienes una categoría con ese nombre.' };
  await ChatModel.updateOne({ _id: chat._id, 'linkSorting.categories._id': new Types.ObjectId(categoryId) }, { $set: { 'linkSorting.categories.$.name': name, 'linkSorting.categories.$.by': 'user' } });
  return { ok: true, members: membersOf(chat) };
}

/** «Unir con…»: its links go to `into` (or to «Sin categoría» with `null`) and the category goes away. */
export async function mergeCategory(chatId: string, userId: Types.ObjectId, categoryId: string, into: string | null): Promise<OpResult> {
  const chat = await notesChatOf(chatId, userId);
  const ids = chat ? categoriesOf(chat).map((category) => category.id) : [];
  if (!chat || !ids.includes(categoryId) || (into !== null && (!ids.includes(into) || into === categoryId))) return NOT_FOUND;
  await MessageModel.updateMany({ chatId: chat._id, 'link.categoryId': categoryId }, { $set: { 'link.categoryId': into, 'link.categoryBy': 'user' } });
  await ChatModel.updateOne({ _id: chat._id }, { $pull: { 'linkSorting.categories': { _id: new Types.ObjectId(categoryId) } } });
  return { ok: true, members: membersOf(chat) };
}

/** «Mover»: the person's choice, which Lila never changes again. */
export async function moveLink(chatId: string, userId: Types.ObjectId, seq: number, categoryId: string | null): Promise<OpResult<{ link: LinkCard }>> {
  const chat = await notesChatOf(chatId, userId);
  if (!chat || (categoryId !== null && !categoriesOf(chat).some((category) => category.id === categoryId))) return NOT_FOUND;
  const message = await MessageModel.findOneAndUpdate(
    { chatId: chat._id, seq, 'link.url': { $exists: true }, deletedAt: { $exists: false } },
    { $set: { 'link.categoryId': categoryId, 'link.categoryBy': 'user' } },
    { returnDocument: 'after', projection: { link: 1 } }
  ).lean<Pick<Message, 'link'> | null>();
  if (!message?.link) return { ok: false, status: 404, message: 'Ese mensaje no tiene un enlace guardado.' };
  return { ok: true, members: membersOf(chat), link: message.link };
}

/** Whether a member may ask to read a link again («Reintentar»). */
export async function canRefreshLink(chatId: string, userId: Types.ObjectId, seq: number): Promise<boolean> {
  const chat = await notesChatOf(chatId, userId);
  return Boolean(chat?.linkSorting?.enabled && (await MessageModel.exists({ chatId: chat._id, seq, 'link.url': { $exists: true } })));
}
