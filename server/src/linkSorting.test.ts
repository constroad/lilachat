import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import type { LinkCard, LinkCategory } from '@lilachat/shared';
import { startTestMongo } from './testMongo.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { sendMessage } from './chatService.js';
import { configureLinkSorting, drainLinkSorting, queueLinkSorting, setLinkSorting } from './linkSorting.js';
import type { ClassifyOutcome, LinkClassifier } from './linkClassifier.js';

/** José 18/11: a notes chat of saved links, sorted by category by Lila. */
let mongo: MongoMemoryServer;
let me: Types.ObjectId;
let notesId: string;

const readCard = vi.fn(async (url: string): Promise<LinkCard> => ({ url: url.split('?')[0]!, platform: 'instagram', format: 'reel', status: 'ready', author: 'Capi (@capi.al.grano)', text: 'Kokoro: voz de estudio en local' }));
let classifyAnswer: ClassifyOutcome = { ok: true, categoryId: null };
const classify = vi.fn(async (_card: LinkCard, categories: readonly LinkCategory[]): Promise<ClassifyOutcome> => {
  if (classifyAnswer.ok && classifyAnswer.categoryId === 'FIRST') return { ok: true, categoryId: categories[0]?.id ?? null };
  return classifyAnswer;
});
const propose = vi.fn(async () => ({ ok: true as const, names: ['Video, voz e imagen', 'Publicidad y ventas'] }));
const classifier: LinkClassifier = { classify, propose };
const emitted: { event: string; frame: unknown }[] = [];

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_link_sorting_test'));
  configureLinkSorting({ readCard, classifier, emit: (_members, event, frame) => void emitted.push({ event, frame }) });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  vi.clearAllMocks();
  emitted.length = 0;
  classifyAnswer = { ok: true, categoryId: 'FIRST' };
  me = (await UserModel.create({ phone: '900000001', name: 'José' }))._id;
  notesId = String((await ChatModel.create({ kind: 'notas', name: 'IA links', members: [{ userId: me, role: 'admin' }], lastSeq: 0 }))._id);
});

let keys = 0;
async function save(body: string, chatId = notesId) {
  const { message } = await sendMessage({ chatId, senderId: me, clientKey: `k${(keys += 1)}`, body });
  queueLinkSorting(message);
  await drainLinkSorting();
  return MessageModel.findOne({ chatId, seq: message.seq }).lean();
}

describe('saving a link in a notes chat', () => {
  it('does nothing while the switch is off', async () => {
    expect((await save('https://www.instagram.com/reel/abc/'))?.link).toBeUndefined();
    expect(readCard).not.toHaveBeenCalled();
  });

  it('stores the card and the category Lila chose, and tells the members', async () => {
    await setLinkSorting({ chatId: notesId, userId: me, enabled: true, seed: ['Video, voz e imagen'] });
    await drainLinkSorting();
    const saved = await save('https://www.instagram.com/reel/abc/?igsh=xyz');
    const chat = await ChatModel.findById(notesId).lean();
    expect(saved?.link).toMatchObject({ url: 'https://www.instagram.com/reel/abc/', status: 'ready', author: 'Capi (@capi.al.grano)', categoryId: String(chat!.linkSorting!.categories[0]!._id), categoryBy: 'lila' });
    expect(emitted.some((one) => one.event === 'msg.link')).toBe(true);
  });

  it('ignores a message without a link and a chat that is not of notes', async () => {
    await setLinkSorting({ chatId: notesId, userId: me, enabled: true, seed: ['Video'] });
    expect((await save('solo una nota'))?.link).toBeUndefined();
    const other = await UserModel.create({ phone: '900000002', name: 'Ana' });
    const direct = await ChatModel.create({ kind: 'direct', members: [{ userId: me }, { userId: other._id }], lastSeq: 0, linkSorting: { enabled: true, categories: [] } });
    expect((await save('https://www.instagram.com/reel/abc/', String(direct._id)))?.link).toBeUndefined();
  });

  it('creates the category Lila proposes when none fits', async () => {
    await setLinkSorting({ chatId: notesId, userId: me, enabled: true, seed: ['Video'] });
    classifyAnswer = { ok: true, categoryId: null, newCategory: 'Finanzas personales' };
    const saved = await save('https://www.instagram.com/reel/abc/');
    const chat = await ChatModel.findById(notesId).lean();
    const created = chat!.linkSorting!.categories.find((category) => category.name === 'Finanzas personales');
    expect(created).toMatchObject({ by: 'lila' });
    expect(saved?.link?.categoryId).toBe(String(created!._id));
  });

  it('keeps the card «Sin categoría» when the classifier has no key', async () => {
    await setLinkSorting({ chatId: notesId, userId: me, enabled: true, seed: ['Video'] });
    classifyAnswer = { ok: false, reason: 'not_configured' };
    const saved = await save('https://www.instagram.com/reel/abc/');
    expect(saved?.link).toMatchObject({ status: 'ready', categoryId: null });
  });

  it('does not classify an unreadable link, and marks it', async () => {
    await setLinkSorting({ chatId: notesId, userId: me, enabled: true, seed: ['Video'] });
    readCard.mockResolvedValueOnce({ url: 'https://www.instagram.com/p/x/', platform: 'instagram', format: 'post', status: 'unreadable' });
    const saved = await save('https://www.instagram.com/p/x/');
    expect(saved?.link).toMatchObject({ status: 'unreadable', categoryId: null });
    expect(classify).not.toHaveBeenCalled();
  });
});

describe('switching it on', () => {
  it('sorts the links already in the chat with the seed categories', async () => {
    const { message } = await sendMessage({ chatId: notesId, senderId: me, clientKey: 'old', body: 'mira https://www.instagram.com/reel/old/' });
    await setLinkSorting({ chatId: notesId, userId: me, enabled: true, seed: ['Video, voz e imagen', 'Publicidad y ventas'] });
    await drainLinkSorting();
    const chat = await ChatModel.findById(notesId).lean();
    expect(chat!.linkSorting!.categories.map((category) => category.name)).toEqual(['Video, voz e imagen', 'Publicidad y ventas']);
    expect((await MessageModel.findOne({ chatId: notesId, seq: message.seq }).lean())?.link?.categoryBy).toBe('lila');
    expect(propose).not.toHaveBeenCalled();
  });

  it('asks Lila for categories when the chat has none', async () => {
    await sendMessage({ chatId: notesId, senderId: me, clientKey: 'old', body: 'https://www.instagram.com/reel/old/' });
    await setLinkSorting({ chatId: notesId, userId: me, enabled: true });
    await drainLinkSorting();
    expect(propose).toHaveBeenCalledTimes(1);
    expect((await ChatModel.findById(notesId).lean())!.linkSorting!.categories.map((category) => category.name)).toEqual(['Video, voz e imagen', 'Publicidad y ventas']);
  });

  it('refuses a chat that is not of notes, or of someone else', async () => {
    const other = await UserModel.create({ phone: '900000002', name: 'Ana' });
    const direct = await ChatModel.create({ kind: 'direct', members: [{ userId: me }, { userId: other._id }], lastSeq: 0 });
    expect(await setLinkSorting({ chatId: String(direct._id), userId: me, enabled: true })).toMatchObject({ ok: false, status: 409 });
    expect(await setLinkSorting({ chatId: notesId, userId: other._id, enabled: true })).toMatchObject({ ok: false, status: 404 });
  });
});
