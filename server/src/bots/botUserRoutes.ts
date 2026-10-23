import { Router } from 'express';
import { Types } from 'mongoose';
import { canManageMembers, toInternationalPhone } from '@lilachat/shared';
import { ChatModel, MessageModel, type Message } from '../chatModels.js';
import { UserModel } from '../models.js';
import { crearLimiteDeIntentos } from '../limiteDeIntentos.js';
import { asyncRoute, requireSession } from '../requireSession.js';
import { WorkspaceMemberModel } from '../workspaceModels.js';
import { commandGroupsOf, invokeCommand } from './botCommands.js';
import { revokeInstallation } from './botInstall.js';
import { directWith } from './botMessages.js';
import { availableAppsIn, directoryOf } from './botDirectory.js';
import { sendBotEvent } from './botEvents.js';
import { BotAppModel, BotInstallationModel } from './botModels.js';
import { botHearsAction } from './botTriggers.js';

/**
 * What a PERSON does with an app (`specs/BOTS-API.spec.md`): tap an action of
 * a bot's card (it reaches the bot as `button.click`), and, as owner or admin,
 * see the space's apps and uninstall one (Integraciones; the bot hears
 * `app.uninstalled` and its token dies).
 */
const isId = (value: unknown): value is string => typeof value === 'string' && Types.ObjectId.isValid(value);
const ONE_MINUTE_MS = 60_000;
const COMMANDS_PER_MINUTE = 20;

async function adminOf(workspaceId: string, userId: Types.ObjectId): Promise<boolean> {
  if (!isId(workspaceId)) return false;
  const member = await WorkspaceMemberModel.findOne({ workspaceId, userId, status: 'active' }).select('role').lean();
  return Boolean(member && canManageMembers(member.role));
}

async function appsOf(workspaceId: string) {
  const installations = await BotInstallationModel.find({ workspaceId, revokedAt: { $exists: false } }).select('appId installedBy lastDelivery createdAt').lean();
  const apps = new Map((await BotAppModel.find({ _id: { $in: installations.map((one) => one.appId) } }).select('name avatarUrl').lean()).map((app) => [String(app._id), app]));
  const people = new Map((await UserModel.find({ _id: { $in: installations.map((one) => one.installedBy) } }).select('name').lean()).map((user) => [String(user._id), user.name ?? null]));
  return installations.map((one) => ({
    id: String(one._id),
    name: apps.get(String(one.appId))?.name ?? 'App',
    ...(apps.get(String(one.appId))?.avatarUrl ? { avatarUrl: apps.get(String(one.appId))!.avatarUrl } : {}),
    installedBy: people.get(String(one.installedBy)) ?? null,
    installedAt: one.createdAt,
    ...(one.lastDelivery ? { lastDelivery: one.lastDelivery } : {}),
  }));
}

export function buildBotUserRouter(): Router {
  const router = Router();
  const commandTries = crearLimiteDeIntentos({ maximo: COMMANDS_PER_MINUTE, ventanaMs: ONE_MINUTE_MS });
  // The composer's «/» (§c-bis): asked once per space when the line starts with a slash, never polled.
  router.get('/workspaces/:id/commands', requireSession, asyncRoute(async (req, res) => {
    const groups = await commandGroupsOf(req.params.id!, req.session!.userId);
    if (!groups) return void res.status(404).json({ message: 'Ese espacio no existe.' });
    res.json({ groups });
  }));
  router.post('/chats/:chatId/commands', requireSession, asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    if (!commandTries.permitir(String(userId))) return void res.status(429).set('Retry-After', '60').json({ message: 'Más de 20 comandos por minuto. Espera un momento.' });
    const outcome = await invokeCommand(userId, req.params.chatId!, { appId: req.body?.app_id, command: req.body?.command, text: req.body?.text });
    if ('error' in outcome) return void res.status(outcome.status).json({ message: outcome.message });
    res.json(outcome);
  }));
  router.post('/chats/:chatId/card-actions', requireSession, asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    const chatId = req.params.chatId;
    const seq = Number(req.body?.seq);
    const actionId = typeof req.body?.action_id === 'string' ? req.body.action_id : '';
    if (!isId(chatId) || !Number.isInteger(seq) || !(await ChatModel.exists({ _id: chatId, 'members.userId': userId }))) return void res.status(404).json({ message: 'Ese chat no existe.' });
    const message = await MessageModel.findOne({ chatId, seq, deletedAt: { $exists: false } }).select('_id chatId seq senderId card').lean<Message | null>();
    const action = message?.card?.actions?.find((one) => one.id === actionId);
    if (!message || !action) return void res.status(404).json({ message: 'Esa acción ya no está en la tarjeta.' });
    const heard = await botHearsAction({ message, action: { id: action.id, value: action.value }, userId });
    if (!heard) return void res.status(404).json({ message: 'La app de esa tarjeta ya no está instalada.' });
    res.status(202).json({ ok: true });
  }));
  router.get('/workspaces/:id/apps', requireSession, asyncRoute(async (req, res) => {
    if (!(await adminOf(req.params.id!, req.session!.userId))) return void res.status(403).json({ message: 'Solo el dueño o un admin ve las integraciones.' });
    res.json({ apps: await appsOf(req.params.id!) });
  }));
  // The directory (agentes, 23/10): the apps an admin can install from here, already pointing at this space.
  router.get('/workspaces/:id/available-apps', requireSession, asyncRoute(async (req, res) => {
    const spaceId = req.params.id!;
    if (!(await adminOf(spaceId, req.session!.userId))) return void res.status(403).json({ message: 'Solo el dueño o un admin instala apps.' });
    res.json({ apps: await availableAppsIn(spaceId) });
  }));
  // The «Apps» section of the space (José, 23/10: «¿dónde está la sección apps?»): installed for everyone, to add for admins.
  router.get('/workspaces/:id/app-directory', requireSession, asyncRoute(async (req, res) => {
    const spaceId = req.params.id!;
    const member = isId(spaceId) ? await WorkspaceMemberModel.findOne({ workspaceId: spaceId, userId: req.session!.userId, status: 'active' }).select('role').lean() : null;
    if (!member) return void res.status(404).json({ message: 'Ese espacio no existe.' });
    const canInstall = canManageMembers(member.role);
    res.json({ apps: await directoryOf(spaceId, canInstall), canInstall });
  }));
  router.post('/workspaces/:id/apps/:appId/chat', requireSession, asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    const spaceId = req.params.id!;
    const isMember = isId(spaceId) && (await WorkspaceMemberModel.exists({ workspaceId: spaceId, userId, status: 'active' }));
    const installation = isMember && isId(req.params.appId) ? await BotInstallationModel.findOne({ workspaceId: spaceId, appId: req.params.appId, revokedAt: { $exists: false } }).select('workspaceId botUserId').lean() : null;
    if (!installation) return void res.status(404).json({ message: 'Esa app no está instalada en el espacio.' });
    res.json({ chatId: String(await directWith(installation, userId)), botUserId: String(installation.botUserId) });
  }));
  router.delete('/workspaces/:id/apps/:installationId', requireSession, asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    if (!(await adminOf(req.params.id!, userId))) return void res.status(403).json({ message: 'Solo el dueño o un admin desinstala apps.' });
    const installation = isId(req.params.installationId) ? await BotInstallationModel.findOne({ _id: req.params.installationId, workspaceId: req.params.id, revokedAt: { $exists: false } }).lean() : null;
    if (!installation) return void res.status(404).json({ message: 'Esa app no está instalada en el espacio.' });
    const by = await UserModel.findById(userId).select('name phone').lean();
    await sendBotEvent(installation, 'app.uninstalled', { by: { id: String(userId), name: by?.name ?? null, phone: by ? toInternationalPhone(by.phone) || null : null } });
    await revokeInstallation(installation);
    res.status(204).end();
  }));
  return router;
}
