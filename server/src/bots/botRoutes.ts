import express, { Router, type NextFunction, type Request, type Response } from 'express';
import { toInternationalPhone, validateBotCard, validateBotPost } from '@lilachat/shared';
import { ChatModel, type Chat } from '../chatModels.js';
import { crearLimiteDeIntentos } from '../limiteDeIntentos.js';
import { UserModel } from '../models.js';
import { asyncRoute, requireSession } from '../requireSession.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../workspaceModels.js';
import { installationByToken, revokeInstallation } from './botInstall.js';
import { postBotMessage, updateBotMessage } from './botMessages.js';
import type { BotInstallation } from './botModels.js';
import { appForConsent, authorize, exchangeCode } from './oauthService.js';

/**
 * The bots API's doors (`specs/BOTS-API.spec.md`): `/api/oauth` (consent,
 * authorize, token, revoke) and `/api/bots` (what a bot does with its token).
 * Errors keep the contract's shape: `{ error, message }`, and the OAuth ones
 * `{ error, error_description }`.
 */
declare module 'express-serve-static-core' {
  interface Request {
    bot?: BotInstallation;
  }
}

const ONE_MINUTE_MS = 60_000;
const MESSAGES_PER_MINUTE = 60;
const TOKEN_TRIES_PER_MINUTE = 20;

const bearer = (req: Request) => {
  const header = String(req.headers.authorization ?? '');
  return header.startsWith('Bearer ') ? header.slice(7) : '';
};

async function requireBot(req: Request, res: Response, next: NextFunction): Promise<void> {
  const installation = await installationByToken(bearer(req));
  if (!installation) return void res.status(401).json({ error: 'invalid_token', message: 'El token del bot no vale o fue revocado.' });
  req.bot = installation;
  next();
}

export function buildOAuthRouter(): Router {
  const router = Router();
  const tokenTries = crearLimiteDeIntentos({ maximo: TOKEN_TRIES_PER_MINUTE, ventanaMs: ONE_MINUTE_MS });
  const send = (res: Response, outcome: { status?: number } & Record<string, unknown>) => {
    const { status, ...body } = outcome;
    res.status(typeof status === 'number' ? status : 200).json(body);
  };
  router.get('/app', requireSession, asyncRoute(async (req, res) => send(res, await appForConsent(req.session!.userId, req.query))));
  router.post('/authorize', requireSession, asyncRoute(async (req, res) => send(res, await authorize(req.session!.userId, req.body ?? {}))));
  router.post('/token', express.urlencoded({ extended: false }), asyncRoute(async (req, res) => {
    if (!tokenTries.permitir(req.ip ?? 'sin-ip')) return void res.status(429).json({ error: 'rate_limited', error_description: 'Demasiados intentos. Espera un minuto.' });
    send(res, await exchangeCode(req.body ?? {}));
  }));
  router.post('/revoke', asyncRoute(requireBot), asyncRoute(async (req, res) => {
    await revokeInstallation(req.bot!);
    res.json({ ok: true });
  }));
  return router;
}

async function membersOf(installation: BotInstallation) {
  const found = await WorkspaceMemberModel.find({ workspaceId: installation.workspaceId, status: 'active', userId: { $exists: true } }).select('userId phone role title area').lean();
  const members = found.filter((member): member is typeof member & { userId: NonNullable<typeof member.userId> } => Boolean(member.userId));
  const names = new Map((await UserModel.find({ _id: { $in: members.map((member) => member.userId) } }).select('name').lean()).map((user) => [String(user._id), user.name ?? null]));
  return members.map((member) => ({ id: String(member.userId), name: names.get(String(member.userId)) ?? null, phone: toInternationalPhone(member.phone) || null, role: member.role, ...(member.title ? { title: member.title } : {}), ...(member.area ? { area: member.area } : {}) }));
}

async function channelsOf(installation: BotInstallation) {
  const chats = await ChatModel.find({ workspaceId: installation.workspaceId, 'channel.visibility': { $exists: true }, $or: [{ 'channel.visibility': 'public' }, { 'members.userId': installation.botUserId }] })
    .select('name channel members.userId')
    .sort({ name: 1 })
    .lean<Chat[]>();
  return chats.map((chat) => ({ id: String(chat._id), name: chat.name, visibility: chat.channel!.visibility, is_member: chat.members.some((member) => String(member.userId) === String(installation.botUserId)) }));
}

export function buildBotRouter(notifyEdited: (members: string[], edited: Record<string, unknown>) => void): Router {
  const router = Router();
  const messageTries = crearLimiteDeIntentos({ maximo: MESSAGES_PER_MINUTE, ventanaMs: ONE_MINUTE_MS });
  router.use(asyncRoute(requireBot));
  router.get('/me', asyncRoute(async (req, res) => {
    const space = await WorkspaceModel.findById(req.bot!.workspaceId).select('name').lean();
    res.json({ installation_id: String(req.bot!._id), space: { id: String(req.bot!.workspaceId), name: space?.name ?? '' }, bot_user_id: String(req.bot!.botUserId) });
  }));
  router.get('/channels', asyncRoute(async (req, res) => res.json({ channels: await channelsOf(req.bot!) })));
  router.get('/members', asyncRoute(async (req, res) => res.json({ members: await membersOf(req.bot!) })));
  router.post('/messages', asyncRoute(async (req, res) => {
    if (!messageTries.permitir(String(req.bot!._id))) return void res.status(429).set('Retry-After', '60').json({ error: 'rate_limited', message: 'Más de 60 mensajes por minuto.' });
    const valid = validateBotPost(req.body);
    if (!valid.ok) return void res.status(400).json({ error: valid.error, message: valid.message });
    const outcome = await postBotMessage(req.bot!, valid.post);
    if ('error' in outcome) return void res.status(outcome.status).json({ error: outcome.error, message: outcome.message, ...(outcome.phone ? { phone: outcome.phone } : {}) });
    res.status(outcome.status).json({ message: outcome.message });
  }));
  router.patch('/messages/:id', asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const card = body.card === undefined ? undefined : validateBotCard(body.card);
    if (card && !card.ok) return void res.status(400).json({ error: 'invalid_request', message: card.message });
    const text = typeof body.text === 'string' && body.text.trim() ? body.text.trim() : undefined;
    if (!text && !card) return void res.status(400).json({ error: 'invalid_request', message: 'Manda text o card.' });
    const outcome = await updateBotMessage(req.bot!, String(req.params.id), { ...(text ? { text } : {}), ...(card?.ok ? { card: card.card } : {}) }, notifyEdited);
    if ('error' in outcome) return void res.status(outcome.status).json({ error: outcome.error, message: outcome.message });
    res.json(outcome);
  }));
  return router;
}
