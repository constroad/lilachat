import express, { Router, type NextFunction, type Request, type Response } from 'express';
import { toInternationalPhone, validateAppManifest, validateBotCard, validateBotCommands, validateBotPost } from '@lilachat/shared';
import { ChatModel, type Chat } from '../chatModels.js';
import { crearLimiteDeIntentos } from '../limiteDeIntentos.js';
import { UserModel } from '../models.js';
import { asyncRoute, requireSession } from '../requireSession.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../workspaceModels.js';
import { deleteOwnedApp, developerFrom, listOwnedApps, rotateAppSecret, upsertApp, type AppsError } from './botApps.js';
import { availabilityOf, setAvailability, spacesRunBy, type AppRef } from './botAvailability.js';
import { commandsOfApp, commandsToWire, registerCommands, respondToCommand } from './botCommands.js';
import { installationByToken, revokeInstallation } from './botInstall.js';
import { postBotMessage, updateBotMessage } from './botMessages.js';
import { setTopicChannels, topicRoutesOf } from './botTopics.js';
import type { BotApp, BotInstallation } from './botModels.js';
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
    developer?: BotApp;
  }
}

const ONE_MINUTE_MS = 60_000;
const MESSAGES_PER_MINUTE = 60;
const TOKEN_TRIES_PER_MINUTE = 20;
const FAILED_DEVELOPER_TRIES_PER_MINUTE = 10;

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
    const outcome = await exchangeCode(req.body ?? {});
    // Only failed exchanges count: a guesser gets nowhere, and installing in many spaces is not punished.
    const failedExchange = 'error' in outcome;
    if (failedExchange && !tokenTries.permitir(req.ip ?? 'sin-ip')) return void res.status(429).json({ error: 'rate_limited', error_description: 'Demasiados intentos. Espera un minuto.' });
    send(res, outcome);
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
  router.get('/commands', asyncRoute(async (req, res) => res.json({ commands: commandsToWire(await commandsOfApp(req.bot!)) })));
  router.put('/commands', asyncRoute(async (req, res) => {
    const valid = validateBotCommands(req.body);
    if (!valid.ok) return void res.status(400).json({ error: 'invalid_request', message: valid.message });
    res.json({ commands: commandsToWire(await registerCommands(req.bot!, valid.commands)) });
  }));
  // Notice topics (§c-quater): read where each lands; a partial map moves some (agentes' one-time migration and its «here» command).
  const topicsToWire = (routes: Awaited<ReturnType<typeof topicRoutesOf>>) => routes.topics.map((topic) => ({ key: topic.key, name: topic.name, channel: topic.channel }));
  router.get('/topics', asyncRoute(async (req, res) => res.json({ topics: topicsToWire(await topicRoutesOf(req.bot!)) })));
  router.put('/topics', asyncRoute(async (req, res) => {
    const outcome = await setTopicChannels(req.bot!, req.body, { kind: 'app' });
    if ('error' in outcome) return void res.status(outcome.status).json({ error: outcome.error, message: outcome.message });
    res.json({ topics: topicsToWire(outcome) });
  }));
  router.post('/commands/:id/respond', asyncRoute(async (req, res) => {
    const outcome = await respondToCommand(req.bot!, String(req.params.id), req.body);
    if ('error' in outcome) return void res.status(outcome.status).json({ error: outcome.error, message: outcome.message });
    res.json(outcome);
  }));
  return router;
}

/**
 * `/api/bots/apps` (§0-bis): a developer app (agentes) creates, updates,
 * lists, rotates and deletes ITS apps with Basic client credentials. Mounted
 * before `/api/bots`, whose doors want a bot token instead.
 */
/** A developer app's credential (§0-bis); only failed credentials count: agentes re-sends every manifest at boot, a guesser does not get far. */
const failedDeveloperTries = crearLimiteDeIntentos({ maximo: FAILED_DEVELOPER_TRIES_PER_MINUTE, ventanaMs: ONE_MINUTE_MS });
const requireDeveloper = asyncRoute(async (req, res, next) => {
  const developer = await developerFrom(req.headers.authorization);
  if ('error' in developer) {
    if (!failedDeveloperTries.permitir(req.ip ?? 'sin-ip')) return void res.status(429).set('Retry-After', '60').json({ error: 'rate_limited', message: 'Demasiados intentos. Espera un minuto.' });
    return void res.status(developer.status).json({ error: developer.error, message: developer.message });
  }
  req.developer = developer;
  next();
});
const sendApps = <T extends object>(res: Response, outcome: T | AppsError) =>
  'error' in outcome ? res.status(outcome.status).json({ error: outcome.error, message: outcome.message }) : res.json(outcome);

/** `GET /api/bots/spaces?admin=` (§0-ter): the spaces the person signed in to agentes' console runs. */
export function buildBotSpacesRouter(): Router {
  const router = Router();
  router.use(requireDeveloper);
  router.get('/', asyncRoute(async (req, res) => void sendApps(res, await spacesRunBy(req.developer!, String(req.query.admin ?? '')))));
  return router;
}

export function buildBotAppsRouter(): Router {
  const router = Router();
  router.use(requireDeveloper);
  router.get('/', asyncRoute(async (req, res) => res.json({ apps: await listOwnedApps(req.developer!) })));
  // Which spaces may install it (§0-ter), by product key or by client id.
  const refOf = (req: Request): AppRef => (req.params.key ? { key: String(req.params.key) } : { clientId: String(req.params.clientId) });
  for (const path of ['/by-key/:key/availability', '/:clientId/availability']) {
    router.get(path, asyncRoute(async (req, res) => void sendApps(res, await availabilityOf(req.developer!, refOf(req)))));
    router.put(path, asyncRoute(async (req, res) => void sendApps(res, await setAvailability(req.developer!, refOf(req), req.body))));
  }
  router.post('/', asyncRoute(async (req, res) => {
    const valid = validateAppManifest(req.body);
    if (!valid.ok) return void res.status(400).json({ error: 'invalid_request', message: valid.message });
    const outcome = await upsertApp(req.developer!, valid.manifest);
    if ('error' in outcome) return void res.status(outcome.status).json({ error: outcome.error, message: outcome.message });
    res.status(outcome.status).json(outcome.body);
  }));
  router.post('/:clientId/secret', asyncRoute(async (req, res) => {
    const outcome = await rotateAppSecret(req.developer!, String(req.params.clientId));
    if ('error' in outcome) return void res.status(outcome.status).json({ error: outcome.error, message: outcome.message });
    res.json(outcome);
  }));
  router.delete('/:clientId', asyncRoute(async (req, res) => {
    const outcome = await deleteOwnedApp(req.developer!, String(req.params.clientId));
    if (outcome !== true) return void res.status(outcome.status).json({ error: outcome.error, message: outcome.message });
    res.status(204).end();
  }));
  return router;
}
