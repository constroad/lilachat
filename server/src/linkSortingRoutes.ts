import { Router, type Response } from 'express';
import { Types } from 'mongoose';
import { asyncRoute, requireSession } from './requireSession.js';
import { createCategory, listLinks, mergeCategory, moveLink, renameCategory, canRefreshLink, type OpResult } from './linkCategories.js';
import { setLinkSorting, sortLinkMessage } from './linkSorting.js';
import { emitToMembers } from './reparto.js';
import { avisarCambioDeChat } from './socket.js';

/**
 * A notes chat's links by category (José, 18/11), under `/api/chats`:
 * - `GET  /:chatId/links`: the switch, the categories and every saved link.
 * - `PUT  /:chatId/link-sorting` `{enabled, seed?}`: the chat's switch.
 * - `POST /:chatId/link-categories` `{name}`, `PATCH …/:categoryId` `{name}`,
 *   `POST …/:categoryId/merge` `{into}` (`null` = «Sin categoría»).
 * - `PUT  /:chatId/messages/:seq/link-category` `{categoryId}`; `POST …/link-refresh`.
 * Every change tells the members (`chat.links.changed` or `msg.link`).
 */
const userOf = (req: { session?: { userId: Types.ObjectId | string } }) => new Types.ObjectId(String(req.session!.userId));
const idOrNull = (value: unknown) => (value === null || value === undefined || value === '' ? null : String(value));

function answer(res: Response, chatId: string, result: OpResult, extra: object = {}): Response {
  if (!result.ok) return res.status(result.status).json({ message: result.message });
  emitToMembers(result.members, 'chat.links.changed', { chatId });
  return res.json({ ok: true, ...extra });
}

export function buildLinkSortingRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.get(
    '/:chatId/links',
    asyncRoute(async (req, res) => {
      const result = await listLinks(req.params.chatId!, userOf(req));
      if (!result.ok) return res.status(result.status).json({ message: result.message });
      return res.json({ enabled: result.enabled, categories: result.categories, items: result.items });
    })
  );

  router.put(
    '/:chatId/link-sorting',
    asyncRoute(async (req, res) => {
      const seed = Array.isArray(req.body?.seed) ? req.body.seed.map(String) : undefined;
      const result = await setLinkSorting({ chatId: req.params.chatId!, userId: userOf(req), enabled: req.body?.enabled === true, seed });
      if (!result.ok) return res.status(result.status).json({ message: result.message });
      for (const member of result.members) avisarCambioDeChat(member, req.params.chatId!);
      return answer(res, req.params.chatId!, result);
    })
  );

  router.post(
    '/:chatId/link-categories',
    asyncRoute(async (req, res) => {
      const result = await createCategory(req.params.chatId!, userOf(req), req.body?.name);
      return answer(res, req.params.chatId!, result, result.ok ? { category: result.category } : {});
    })
  );

  router.patch(
    '/:chatId/link-categories/:categoryId',
    asyncRoute(async (req, res) => answer(res, req.params.chatId!, await renameCategory(req.params.chatId!, userOf(req), req.params.categoryId!, req.body?.name)))
  );

  router.post(
    '/:chatId/link-categories/:categoryId/merge',
    asyncRoute(async (req, res) => answer(res, req.params.chatId!, await mergeCategory(req.params.chatId!, userOf(req), req.params.categoryId!, idOrNull(req.body?.into))))
  );

  router.put(
    '/:chatId/messages/:seq/link-category',
    asyncRoute(async (req, res) => {
      const seq = Number(req.params.seq);
      const result = await moveLink(req.params.chatId!, userOf(req), seq, idOrNull(req.body?.categoryId));
      if (!result.ok) return res.status(result.status).json({ message: result.message });
      emitToMembers(result.members, 'msg.link', { chatId: req.params.chatId, seq, link: result.link });
      return res.json({ ok: true, link: result.link });
    })
  );

  router.post(
    '/:chatId/messages/:seq/link-refresh',
    asyncRoute(async (req, res) => {
      const seq = Number(req.params.seq);
      if (!(await canRefreshLink(req.params.chatId!, userOf(req), seq))) return res.status(404).json({ message: 'Ese mensaje no tiene un enlace guardado.' });
      void sortLinkMessage(req.params.chatId!, seq, { force: true }).catch((error) => console.error('[links] refresh failed:', (error as Error)?.message ?? error));
      return res.status(202).json({ ok: true });
    })
  );

  return router;
}
