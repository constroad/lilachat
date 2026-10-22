import { Router, type Request } from 'express';
import { Types } from 'mongoose';
import { CHAT_LISTS_MAX, changeListChats, chatListNameError, type ChatList } from '@lilachat/shared';
import { asyncRoute, requireSession } from './requireSession.js';
import { ChatModel } from './chatModels.js';
import { UserModel } from './models.js';
import { emitChatListsChanged } from './reparto.js';

/** At most this many chats change in one request: a list is curated by hand. */
const MAX_CHANGE = 200;

type StoredList = { _id: Types.ObjectId; name: string; chatIds: string[] };

const toClient = (list: StoredList): ChatList => ({ id: String(list._id), name: list.name, chatIds: list.chatIds });

async function listsOf(userId: string): Promise<StoredList[]> {
  const user = await UserModel.findById(userId).select('chatLists').lean<{ chatLists?: StoredList[] } | null>();
  return user?.chatLists ?? [];
}

/** The ids asked for that are chats I am in: never a stranger's chat in my list. */
async function myChatIds(userId: string, asked: unknown): Promise<string[]> {
  const ids = (Array.isArray(asked) ? asked : []).filter((id): id is string => typeof id === 'string' && Types.ObjectId.isValid(id)).slice(0, MAX_CHANGE);
  if (ids.length === 0) return [];
  const chats = await ChatModel.find({ _id: { $in: ids }, 'members.userId': new Types.ObjectId(userId) }).select('_id').lean();
  const found = new Set(chats.map((chat) => String(chat._id)));
  return ids.filter((id) => found.has(id));
}

const stringIds = (asked: unknown): string[] => (Array.isArray(asked) ? asked.filter((id): id is string => typeof id === 'string').slice(0, MAX_CHANGE) : []);

const userOf = (req: Request): string => String(req.session!.userId);

/**
 * Lists of chats of one's own (pending 45, José 22/10), like Telegram's
 * folders: they live in the person's profile, so the phone and the web read
 * the same ones, and every change tells the other devices to read them again.
 */
export function buildChatListsRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/', asyncRoute(async (req, res) => {
    res.json({ lists: (await listsOf(userOf(req))).map(toClient) });
  }));

  router.post('/', asyncRoute(async (req, res) => {
    const userId = userOf(req);
    const lists = await listsOf(userId);
    if (lists.length >= CHAT_LISTS_MAX) return res.status(400).json({ message: `Puedes tener hasta ${CHAT_LISTS_MAX} listas.` });
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const error = chatListNameError(name, lists.map(toClient));
    if (error) return res.status(400).json({ message: error });
    const list: StoredList = { _id: new Types.ObjectId(), name, chatIds: changeListChats([], { add: await myChatIds(userId, req.body?.chatIds) }) };
    await UserModel.updateOne({ _id: userId }, { $push: { chatLists: list } });
    emitChatListsChanged(userId);
    res.status(201).json({ list: toClient(list) });
  }));

  // Before `/:id`, or «order» would be read as a list's id.
  router.put('/order', asyncRoute(async (req, res) => {
    const userId = userOf(req);
    const lists = await listsOf(userId);
    const order = stringIds(req.body?.ids);
    const rank = (list: StoredList) => {
      const index = order.indexOf(String(list._id));
      return index === -1 ? order.length : index;
    };
    const sorted = [...lists].sort((a, b) => rank(a) - rank(b));
    await UserModel.updateOne({ _id: userId }, { $set: { chatLists: sorted } });
    emitChatListsChanged(userId);
    res.json({ lists: sorted.map(toClient) });
  }));

  router.patch('/:id', asyncRoute(async (req, res) => {
    const userId = userOf(req);
    const lists = await listsOf(userId);
    const current = lists.find((list) => String(list._id) === req.params.id);
    if (!current) return res.status(404).json({ message: 'Esa lista ya no existe.' });
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : current.name;
    const error = chatListNameError(name, lists.map(toClient), String(current._id));
    if (error) return res.status(400).json({ message: error });
    const chatIds = changeListChats(current.chatIds, { add: await myChatIds(userId, req.body?.add), remove: stringIds(req.body?.remove) });
    await UserModel.updateOne({ _id: userId, 'chatLists._id': current._id }, { $set: { 'chatLists.$.name': name, 'chatLists.$.chatIds': chatIds } });
    emitChatListsChanged(userId);
    res.json({ list: toClient({ ...current, name, chatIds }) });
  }));

  router.delete('/:id', asyncRoute(async (req, res) => {
    const userId = userOf(req);
    const listId = req.params.id ?? '';
    if (!Types.ObjectId.isValid(listId)) return res.status(404).json({ message: 'Esa lista ya no existe.' });
    const result = await UserModel.updateOne({ _id: userId }, { $pull: { chatLists: { _id: new Types.ObjectId(listId) } } });
    if (result.modifiedCount === 0) return res.status(404).json({ message: 'Esa lista ya no existe.' });
    emitChatListsChanged(userId);
    res.json({ ok: true });
  }));

  return router;
}
