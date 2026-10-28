import { Router } from 'express';
import multer from 'multer';
import { Types } from 'mongoose';
import { canManageMembers, normalizePeruPhone, toInternationalPhone, type CommandScope, type GeoPoint } from '@lilachat/shared';
import { ChatModel, MessageModel, type Message } from '../chatModels.js';
import { UserModel } from '../models.js';
import { crearLimiteDeIntentos } from '../limiteDeIntentos.js';
import { asyncRoute, requireSession } from '../requireSession.js';
import { WorkspaceMemberModel } from '../workspaceModels.js';
import { commandGroupsOf, invokeCommand, invokeShortcut, shareCommandAnswer } from './botCommands.js';
import { FORM_PHOTO_MAX_BYTES, readSignedFile, storeFormPhoto, submitForm } from './botForms.js';
import { revokeInstallation } from './botInstall.js';
import { directWith, postBotMessage } from './botMessages.js';
import { setTopicChannels, topicRoutesOf } from './botTopics.js';
import { itemRowsOf, setItemSettings } from './botItems.js';
import { linkOf, revokeLink } from './botLink.js';
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

/** Who installs, as agentes' sign-in expects it: the local 9-digit phone (it fills the field and accepts no other account). */
async function loginHintOf(userId: Types.ObjectId): Promise<string | undefined> {
  const user = await UserModel.findById(userId).select('phone').lean();
  return normalizePeruPhone(user?.phone) || undefined;
}

export function buildBotUserRouter(): Router {
  const router = Router();
  const commandTries = crearLimiteDeIntentos({ maximo: COMMANDS_PER_MINUTE, ventanaMs: ONE_MINUTE_MS });
  // The composer's «/» (§c-bis): asked once per space when the line starts with a slash, never polled.
  // `?chat=<id>` for a chat's «/» and «+», `?place=space` for the ⚡: only what the admin enabled there (R160).
  router.get('/workspaces/:id/commands', requireSession, asyncRoute(async (req, res) => {
    const place = req.query.place === 'space' ? 'space' : typeof req.query.chat === 'string' ? { chatId: req.query.chat } : undefined;
    const groups = await commandGroupsOf(req.params.id!, req.session!.userId, place);
    if (!groups) return void res.status(404).json({ message: 'Ese espacio no existe.' });
    res.json({ groups });
  }));
  // A chat's «/» and «+», or the space's ⚡ (José, 23/10): the same handlers, told apart by the path.
  const scopeOf = (req: { params: Record<string, string | undefined> }): CommandScope => (req.params.chatId ? { chatId: req.params.chatId } : { workspaceId: req.params.id! });
  router.post(['/chats/:chatId/commands', '/workspaces/:id/commands'], requireSession, asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    if (!commandTries.permitir(String(userId))) return void res.status(429).set('Retry-After', '60').json({ message: 'Más de 20 comandos por minuto. Espera un momento.' });
    const outcome = await invokeCommand(userId, scopeOf(req), { appId: req.body?.app_id, command: req.body?.command, text: req.body?.text, forms: req.body?.forms });
    if ('error' in outcome) return void res.status(outcome.status).json({ message: outcome.message });
    res.json(outcome);
  }));
  router.post(['/chats/:chatId/shortcuts', '/workspaces/:id/shortcuts'], requireSession, asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    if (!commandTries.permitir(String(userId))) return void res.status(429).set('Retry-After', '60').json({ message: 'Más de 20 acciones por minuto. Espera un momento.' });
    const outcome = await invokeShortcut(userId, scopeOf(req), { appId: req.body?.app_id, shortcut: req.body?.shortcut, forms: req.body?.forms });
    if ('error' in outcome) return void res.status(outcome.status).json({ message: outcome.message });
    res.json(outcome);
  }));
  /** The live selfie asks for the stamp, with the place the form already has (pending 94). */
  const stampOf = (body: unknown): { location?: GeoPoint } | undefined => {
    const fields = (body ?? {}) as Record<string, unknown>;
    if (fields.stamp !== '1') return undefined;
    const [lat, lng, precision] = [fields.lat, fields.lng, fields.precision].map(Number);
    const valid = [lat, lng, precision].every(Number.isFinite) && Math.abs(lat!) <= 90 && Math.abs(lng!) <= 180 && precision! >= 0;
    return valid ? { location: { lat: lat!, lng: lng!, precision: Math.round(precision!) } } : {};
  };
  // App forms (R160): the photo first, then the form; sending it is the person's confirmation.
  const photo = multer({ storage: multer.memoryStorage(), limits: { fileSize: FORM_PHOTO_MAX_BYTES } });
  router.post(['/chats/:chatId/commands/:commandId/files', '/workspaces/:id/commands/:commandId/files'], requireSession, photo.single('file'), asyncRoute(async (req, res) => {
    if (!req.file) return void res.status(400).json({ message: 'Falta la foto.' });
    const outcome = await storeFormPhoto(req.session!.userId, scopeOf(req), req.params.commandId!, req.file, stampOf(req.body));
    if ('error' in outcome) return void res.status(outcome.status).json({ message: outcome.message });
    res.status(201).json(outcome);
  }));
  router.post(['/chats/:chatId/commands/:commandId/form', '/workspaces/:id/commands/:commandId/form'], requireSession, asyncRoute(async (req, res) => {
    const outcome = await submitForm(req.session!.userId, scopeOf(req), req.params.commandId!, req.body?.values);
    if ('errors' in outcome) return void res.status(422).json({ errors: outcome.errors });
    if ('error' in outcome) return void res.status(outcome.status).json({ message: outcome.message });
    res.json(outcome);
  }));
  router.post('/chats/:chatId/commands/:commandId/share', requireSession, asyncRoute(async (req, res) => {
    const outcome = await shareCommandAnswer(req.session!.userId, req.params.chatId!, req.params.commandId!);
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
    res.json({ apps: await availableAppsIn(spaceId, await loginHintOf(req.session!.userId)) });
  }));
  // The «Apps» section of the space (José, 23/10: «¿dónde está la sección apps?»): installed for everyone, to add for admins.
  router.get('/workspaces/:id/app-directory', requireSession, asyncRoute(async (req, res) => {
    const spaceId = req.params.id!;
    const member = isId(spaceId) ? await WorkspaceMemberModel.findOne({ workspaceId: spaceId, userId: req.session!.userId, status: 'active' }).select('role').lean() : null;
    if (!member) return void res.status(404).json({ message: 'Ese espacio no existe.' });
    const canInstall = canManageMembers(member.role);
    res.json({ apps: await directoryOf(spaceId, canInstall, canInstall ? await loginHintOf(req.session!.userId) : undefined), canInstall });
  }));
  router.post('/workspaces/:id/apps/:appId/chat', requireSession, asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    const spaceId = req.params.id!;
    const isMember = isId(spaceId) && (await WorkspaceMemberModel.exists({ workspaceId: spaceId, userId, status: 'active' }));
    const installation = isMember && isId(req.params.appId) ? await BotInstallationModel.findOne({ workspaceId: spaceId, appId: req.params.appId, revokedAt: { $exists: false } }).select('workspaceId botUserId').lean() : null;
    if (!installation) return void res.status(404).json({ message: 'Esa app no está instalada en el espacio.' });
    res.json({ chatId: String(await directWith(installation, userId)), botUserId: String(installation.botUserId) });
  }));
  // «¿Dónde llega cada aviso?» (R160, design e-31): every member sees it, only an admin changes it or tries it.
  const installedApp = (spaceId: string, appId: unknown) => (isId(spaceId) && isId(appId) ? BotInstallationModel.findOne({ workspaceId: spaceId, appId, revokedAt: { $exists: false } }).lean() : null);
  router.get('/workspaces/:id/apps/:appId/topics', requireSession, asyncRoute(async (req, res) => {
    const spaceId = req.params.id!;
    const member = isId(spaceId) ? await WorkspaceMemberModel.findOne({ workspaceId: spaceId, userId: req.session!.userId, status: 'active' }).select('role').lean() : null;
    const installation = member ? await installedApp(spaceId, req.params.appId) : null;
    if (!member || !installation) return void res.status(404).json({ message: 'Esa app no está instalada en el espacio.' });
    res.json({ ...(await topicRoutesOf(installation)), canEdit: canManageMembers(member.role) });
  }));
  router.put('/workspaces/:id/apps/:appId/topics', requireSession, asyncRoute(async (req, res) => {
    if (!(await adminOf(req.params.id!, req.session!.userId))) return void res.status(403).json({ message: 'Solo el dueño o un admin elige dónde llegan los avisos.' });
    const installation = await installedApp(req.params.id!, req.params.appId);
    if (!installation) return void res.status(404).json({ message: 'Esa app no está instalada en el espacio.' });
    const outcome = await setTopicChannels(installation, req.body?.channels, { kind: 'user', userId: String(req.session!.userId) });
    if ('error' in outcome) return void res.status(outcome.status).json({ message: outcome.message });
    res.json({ ...outcome, canEdit: true });
  }));
  // «Comandos y acciones» (R160): every member sees where each works; only an admin changes it.
  router.get('/workspaces/:id/apps/:appId/items', requireSession, asyncRoute(async (req, res) => {
    const spaceId = req.params.id!;
    const member = isId(spaceId) ? await WorkspaceMemberModel.findOne({ workspaceId: spaceId, userId: req.session!.userId, status: 'active' }).select('role').lean() : null;
    const installation = member ? await installedApp(spaceId, req.params.appId) : null;
    if (!member || !installation) return void res.status(404).json({ message: 'Esa app no está instalada en el espacio.' });
    res.json({ ...(await itemRowsOf(installation)), canEdit: canManageMembers(member.role) });
  }));
  router.put('/workspaces/:id/apps/:appId/items', requireSession, asyncRoute(async (req, res) => {
    if (!(await adminOf(req.params.id!, req.session!.userId))) return void res.status(403).json({ message: 'Solo el dueño o un admin habilita comandos y acciones.' });
    const installation = await installedApp(req.params.id!, req.params.appId);
    if (!installation) return void res.status(404).json({ message: 'Esa app no está instalada en el espacio.' });
    const outcome = await setItemSettings(installation, req.body?.items);
    if ('message' in outcome) return void res.status(outcome.status).json({ message: outcome.message });
    res.json({ ...outcome, canEdit: true });
  }));
  // «Conectado como … / Desconectar» (pending 59): MY account in this app, asked to the app each time.
  const myInstalledApp = async (spaceId: string, appId: unknown, userId: Types.ObjectId) => {
    const isMember = isId(spaceId) && (await WorkspaceMemberModel.exists({ workspaceId: spaceId, userId, status: 'active' }));
    return isMember ? installedApp(spaceId, appId) : null;
  };
  router.get('/workspaces/:id/apps/:appId/link', requireSession, asyncRoute(async (req, res) => {
    const installation = await myInstalledApp(req.params.id!, req.params.appId, req.session!.userId);
    if (!installation) return void res.status(404).json({ message: 'Esa app no está instalada en el espacio.' });
    res.json(await linkOf(installation, req.session!.userId));
  }));
  router.delete('/workspaces/:id/apps/:appId/link', requireSession, asyncRoute(async (req, res) => {
    const installation = await myInstalledApp(req.params.id!, req.params.appId, req.session!.userId);
    if (!installation) return void res.status(404).json({ message: 'Esa app no está instalada en el espacio.' });
    if (!(await revokeLink(installation, req.session!.userId))) return void res.status(502).json({ message: 'La app no confirmó la desconexión. Prueba otra vez en un momento.' });
    res.status(204).end();
  }));
  // «Probar envío»: one line per channel, from the app, saying which topics land there.
  router.post('/workspaces/:id/apps/:appId/topics/test', requireSession, asyncRoute(async (req, res) => {
    if (!(await adminOf(req.params.id!, req.session!.userId))) return void res.status(403).json({ message: 'Solo el dueño o un admin prueba los avisos.' });
    const installation = await installedApp(req.params.id!, req.params.appId);
    if (!installation) return void res.status(404).json({ message: 'Esa app no está instalada en el espacio.' });
    const { topics } = await topicRoutesOf(installation);
    const byChannel = new Map<string, string[]>();
    for (const topic of topics) if (topic.channel) byChannel.set(topic.channel.id, [...(byChannel.get(topic.channel.id) ?? []), topic.name]);
    const stamp = Date.now();
    const sent = await Promise.all([...byChannel].map(([channelId, names]) => postBotMessage(installation, { target: { channelId }, text: `Prueba de avisos: aquí llegan ${names.join(', ')}.`, idempotencyKey: `topics-test:${stamp}:${channelId}` })));
    res.json({ channels: sent.filter((one) => !('error' in one)).length });
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

/** `GET /api/bots/files/<token>` (R160): a form's photo for the app, by its signed address; no session, the signature is the key. */
export function buildBotFilesRouter(): Router {
  const router = Router();
  router.get('/:token', asyncRoute(async (req, res) => {
    const file = await readSignedFile(String(req.params.token));
    if ('status' in file) return void res.status(file.status).json({ message: file.status === 410 ? 'La dirección venció.' : 'No existe.' });
    res.set('Content-Type', file.mime).set('Cache-Control', 'private, no-store').send(file.bytes);
  }));
  return router;
}
