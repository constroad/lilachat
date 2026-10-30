import { Router, type NextFunction, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { asyncRoute, requireSession } from './requireSession.js';
import { crearLimiteDeIntentos } from './limiteDeIntentos.js';
import {
  addByPhone,
  createWorkspace,
  joinByCode,
  leaveWorkspace,
  listMembers,
  myWorkspaces,
  logoEditor,
  previewByCode,
  rejectRequest,
  setWorkspaceLogo,
  updateMember,
  updateWorkspace,
  WorkspaceError,
} from './workspaces.js';
import { createChannel, joinChannel, listChannels } from './workspaceChannels.js';
import { emailInvitesOf, inviteByEmail, revokeEmailInvite } from './workspaceEmailInvites.js';
import { type MediaUploader } from './mediaClient.js';
import { defaultMediaUploader } from './localMediaUploader.js';
import { multerDeAvatar, subirFotoRedonda } from './subirAvatar.js';
import multer from 'multer';
import { CUSTOM_EMOJI_MAX_BYTES } from '@lilachat/shared';
import { addCustomEmoji, listCustomEmojis, removeCustomEmoji } from './customEmojiCatalog.js';
import { clientRecords, listClients } from './bots/botClients.js';
import { clientAccount, clientServiceDetail, clientServiceFiles } from './bots/clientFiles.js';
import { listBillingViewers, setBillingViewer } from './bots/clientBillingViewers.js';

/** Tries of a code per person and minute: enough to fix a typo, not to guess codes. */
const CODE_TRIES_PER_MINUTE = 10;
const ONE_MINUTE_MS = 60_000;

const me = (req: Request) => new Types.ObjectId(req.session!.userId);

/** A `WorkspaceError` becomes its status and message; anything else goes to Express. */
function handled(handler: (req: Request, res: Response) => Promise<unknown>) {
  return asyncRoute(async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof WorkspaceError) return void res.status(error.status).json({ message: error.message });
      next(error);
    }
  });
}

/** Company spaces (E1, spec §66), mounted on `/api/workspaces`. */
export function buildWorkspaceRouter(uploader: MediaUploader = defaultMediaUploader()): Router {
  const router = Router();
  const codeTries = crearLimiteDeIntentos({ maximo: CODE_TRIES_PER_MINUTE, ventanaMs: ONE_MINUTE_MS });
  const limited = (req: Request, res: Response, next: NextFunction) =>
    codeTries.permitir(String(req.session!.userId)) ? next() : void res.status(429).json({ message: 'Demasiados intentos. Espera un minuto.' });
  router.use(requireSession);

  router.get('/', handled(async (req, res) => res.json({ workspaces: await myWorkspaces(me(req)) })));
  router.post('/', handled(async (req, res) => res.status(201).json({ workspace: await createWorkspace(me(req), req.body ?? {}) })));
  router.get('/preview/:code', limited, handled(async (req, res) => res.json(await previewByCode(req.params.code))));
  router.post('/join', limited, handled(async (req, res) => res.json(await joinByCode(me(req), req.body?.code))));
  // The logo (design e1-12): an image, kept relative like every media and served absolute.
  router.post('/:id/logo', multerDeAvatar.single('file'), handled(async (req, res) => {
    await logoEditor(req.params.id!, me(req));
    const upload = await subirFotoRedonda({ uploader, file: req.file, carpeta: `espacio-${req.params.id}`, nombrePorDefecto: 'logo.png', siNoEsImagen: 'El logo tiene que ser una imagen.' });
    if (!upload.ok) return res.status(upload.status).json({ message: upload.message });
    res.json({ workspace: await setWorkspaceLogo(req.params.id!, me(req), upload.url) });
  }));
  router.delete('/:id/logo', handled(async (req, res) => res.json({ workspace: await setWorkspaceLogo(req.params.id!, me(req), null) })));
  router.patch('/:id', handled(async (req, res) => res.json({ workspace: await updateWorkspace(req.params.id!, me(req), req.body ?? {}) })));
  router.post('/:id/leave', handled(async (req, res) => {
    await leaveWorkspace(req.params.id!, me(req));
    res.status(204).end();
  }));
  router.get('/:id/members', handled(async (req, res) => {
    const members = await listMembers(req.params.id!, me(req), req.query.status);
    // The emails waiting (22/10) sit next to the phones in «Invitados»; `listMembers` already checked the admin.
    const emails = req.query.status === 'invited' || req.query.status === 'all' ? await emailInvitesOf(new Types.ObjectId(req.params.id!)) : [];
    res.json({ members: [...members, ...emails] });
  }));
  router.post('/:id/invites', handled(async (req, res) => res.status(201).json(await inviteByEmail(req.params.id!, me(req), req.body ?? {}))));
  router.delete('/:id/invites/:inviteId', handled(async (req, res) => {
    await revokeEmailInvite(req.params.id!, me(req), req.params.inviteId!);
    res.status(204).end();
  }));
  router.post('/:id/members', handled(async (req, res) => res.status(201).json({ member: await addByPhone(req.params.id!, me(req), req.body ?? {}) })));
  router.delete('/:id/members/:memberId', handled(async (req, res) => {
    await rejectRequest(req.params.id!, me(req), req.params.memberId!);
    res.status(204).end();
  }));
  router.patch('/:id/members/:memberId', handled(async (req, res) => res.json({ member: await updateMember(req.params.id!, me(req), req.params.memberId!, req.body ?? {}) })));
  router.get('/:id/clients', handled(async (req, res) => res.json({ clients: await listClients(req.params.id!, me(req)) })));
  router.get('/:id/clients/:clientId/records', handled(async (req, res) => {
    const found = await clientRecords(req.params.id!, req.params.clientId!, me(req));
    if ('error' in found) return res.status(found.status).json({ error: found.error, message: found.message });
    res.json(found);
  }));
  // Pending 121: the service's Drive on demand; a failure is still a 200 with «No se pudo traer el Drive» and the link.
  router.get('/:id/clients/:clientId/services/:serviceId/files', handled(async (req, res) => {
    const found = await clientServiceFiles(req.params.id!, req.params.clientId!, req.params.serviceId!, me(req));
    if ('error' in found) return res.status(found.status).json({ error: found.error, message: found.message });
    res.json(found.ok ? { files: found.files.files, drive_url: found.files.driveUrl } : { error: 'drive_failed', message: found.message, drive_url: found.fallbackUrl });
  }));
  // José 30/10: the service's pedidos, despachos and informes on demand; a failure is a 200 with the message and Portal's link.
  router.get('/:id/clients/:clientId/services/:serviceId/detail', handled(async (req, res) => {
    const found = await clientServiceDetail(req.params.id!, req.params.clientId!, req.params.serviceId!, me(req));
    if ('error' in found) return res.status(found.status).json({ error: found.error, message: found.message });
    res.json(found.ok ? { detail: found.value } : { error: 'detail_failed', message: found.message, portal_url: found.fallbackUrl });
  }));
  // José 30/10 (design f-08): all the client's quotes and its orders on credit; a failure is a 200 with the message.
  router.get('/:id/clients/:clientId/account', handled(async (req, res) => {
    const found = await clientAccount(req.params.id!, req.params.clientId!, me(req));
    if ('error' in found) return res.status(found.status).json({ error: found.error, message: found.message });
    res.json(found.ok ? { account: found.value } : { error: 'account_failed', message: found.message, portal_url: found.fallbackUrl });
  }));
  // José 30/10: who else sees a client's collection, chosen by an admin per client channel.
  router.get('/:id/clients/:clientId/billing-viewers', handled(async (req, res) => res.json(await listBillingViewers(req.params.id!, req.params.clientId!, me(req)))));
  router.put('/:id/clients/:clientId/billing-viewers/:userId', handled(async (req, res) => res.json(await setBillingViewer(req.params.id!, req.params.clientId!, me(req), req.params.userId!, req.body ?? {}))));
  router.get('/:id/channels', handled(async (req, res) => res.json({ channels: await listChannels(req.params.id!, me(req)) })));
  router.post('/:id/channels', handled(async (req, res) => res.status(201).json({ channel: await createChannel(req.params.id!, me(req), req.body ?? {}) })));
  // Pending 19: the space's own emojis (designs c-06/c-07). Too big a file is a 400, not a 500.
  const emojiFile = multer({ storage: multer.memoryStorage(), limits: { fileSize: CUSTOM_EMOJI_MAX_BYTES } }).single('file');
  const emojiUpload = (req: Request, res: Response, next: NextFunction) =>
    emojiFile(req, res, (error: unknown) => {
      if (!error) return next();
      // Answered while the phone was still sending, the socket broke and it saw a network error instead of this.
      const refuse = () => void res.status(400).json({ message: 'La imagen tiene que ser PNG, WebP o GIF de hasta 256 KB.' });
      if (req.complete) return refuse();
      req.once('end', refuse);
      req.resume();
    });
  router.get('/:id/emojis', handled(async (req, res) => res.json({ emojis: await listCustomEmojis(req.params.id!, me(req)) })));
  router.post('/:id/emojis', emojiUpload, handled(async (req, res) => {
    res.status(201).json({ emoji: await addCustomEmoji({ workspaceId: req.params.id!, userId: me(req), name: req.body?.name, bytes: req.file?.buffer, uploader }) });
  }));
  router.delete('/:id/emojis/:emojiId', handled(async (req, res) => {
    await removeCustomEmoji(req.params.id!, me(req), req.params.emojiId!);
    res.status(204).end();
  }));
  router.post('/:id/channels/:chatId/join', handled(async (req, res) => res.json({ channel: await joinChannel(req.params.id!, me(req), req.params.chatId!) })));
  return router;
}
