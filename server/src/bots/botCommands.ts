import { Types } from 'mongoose';
import { COMMAND_LIMITS, enabledAt, isAckBody, itemSettingOf, validateCommandResponse, validateFormReply, type BotCommand, type ItemPlace, type BotPost, type CommandGroup, type CommandNotice, type CommandOutcome, type CommandResponse, type CommandScope } from '@lilachat/shared';
import { ChatModel, type Chat } from '../chatModels.js';
import { WorkspaceMemberModel } from '../workspaceModels.js';
import { callBotWebhook, isRestarting, recordLastDelivery, type WebhookReply } from './botEvents.js';
import { postBotMessage } from './botMessages.js';
import { announceAppChanged, announceLater } from './botAnnounce.js';
import { BotAppModel, BotCommandRunModel, BotInstallationModel, type BotCommandRun, type BotInstallation } from './botModels.js';
import { channelOf, personOf } from './botTriggers.js';
import { configureLateAnswers, settleLateAnswer } from './lateAnswers.js';

/**
 * Slash commands (`specs/BOTS-API.spec.md` §c-bis), like Slack: the app
 * registers its list, a member of a space where it is installed sends
 * «/clima lurin», the app hears `command.invoked` ONCE and answers in the
 * response body (3 s) or later through `/respond` (15 min, up to 5 times).
 * An ephemeral answer is never stored: it goes back to the asker only.
 */
export type CommandError = { status: 400 | 404 | 409 | 410; error: string; message: string };
export type ChatOfCommand = Pick<Chat, '_id' | 'kind' | 'name' | 'channel' | 'workspaceId' | 'members'>;
export type Base = Pick<CommandOutcome, 'commandId' | 'appId' | 'appName'>;

const COMMAND_TTL_MS = 15 * 60_000;
const RESPONSES_PER_COMMAND = 5;
const RUN_ERROR_MAX = 300;
const FAILED_RUN_KEPT_MS = 7 * 24 * 3_600_000;
const isId = (value: unknown): value is string => typeof value === 'string' && Types.ObjectId.isValid(value);
const fail = (status: CommandError['status'], error: string, message: string): CommandError => ({ status, error, message });
let answerTimeoutMs = 3_000;
let notifyAsker: (userId: string, notice: CommandNotice) => void = () => undefined;

/** How long an answer in the webhook body is awaited (forms too, `botForms.ts`). */
export const commandAnswerTimeout = (): number => answerTimeoutMs;

/** The socket sets who hears a late ephemeral answer; tests shorten the wait. */
export function configureCommands(options: { answerTimeoutMs?: number; lateAnswerWaitMs?: number; notify?: (userId: string, notice: CommandNotice) => void }): void {
  if (options.answerTimeoutMs !== undefined) answerTimeoutMs = options.answerTimeoutMs;
  if (options.lateAnswerWaitMs !== undefined) configureLateAnswers({ waitMs: options.lateAnswerWaitMs });
  if (options.notify) notifyAsker = options.notify;
}

export const commandsToWire = (commands: readonly BotCommand[]) =>
  commands.map((entry) => ({ command: entry.command, description: entry.description, ...(entry.usageHint ? { usage_hint: entry.usageHint } : {}) }));

export async function registerCommands(installation: Pick<BotInstallation, 'appId'>, commands: BotCommand[]): Promise<BotCommand[]> {
  await BotAppModel.updateOne({ _id: installation.appId }, { $set: { commands } });
  announceLater(announceAppChanged(installation.appId));
  return commands;
}

export async function commandsOfApp(installation: Pick<BotInstallation, 'appId'>): Promise<BotCommand[]> {
  return (await BotAppModel.findById(installation.appId).select('commands').lean())?.commands ?? [];
}

/** An app's own 1:1 offers everything it has, whatever the admin left for the channels. */
const isOwnChat = (chat: Pick<ChatOfCommand, 'kind' | 'members'> | null, installation: Pick<BotInstallation, 'botUserId'>) =>
  Boolean(chat && chat.kind === 'direct' && chat.members.some((member) => String(member.userId) === String(installation.botUserId)));

/**
 * What the composer and the ⚡ offer in a space: each installed app with what
 * works at that place (José, 23/10: the admin enables each one per channel and
 * for the ⚡). Without a place (clients before R160), everything. Null if not
 * an active member.
 */
export async function commandGroupsOf(workspaceId: string, userId: Types.ObjectId, place?: ItemPlace): Promise<CommandGroup[] | null> {
  if (!isId(workspaceId) || !(await WorkspaceMemberModel.exists({ workspaceId, userId, status: 'active' }))) return null;
  const inChat = place && place !== 'space' ? place : null;
  const [installations, chat] = await Promise.all([
    BotInstallationModel.find({ workspaceId, revokedAt: { $exists: false } }).select('appId botUserId itemSettings').lean(),
    inChat && isId(inChat.chatId) ? ChatModel.findOne({ _id: inChat.chatId, workspaceId, 'members.userId': userId }).select('kind members.userId').lean<Pick<ChatOfCommand, 'kind' | 'members'> | null>() : null,
  ]);
  if (inChat && !chat) return [];
  const byApp = new Map(installations.map((one) => [String(one.appId), one]));
  const apps = await BotAppModel.find({ _id: { $in: installations.map((one) => one.appId) }, $or: [{ 'commands.0': { $exists: true } }, { 'shortcuts.0': { $exists: true } }] }).select('name avatarUrl commands shortcuts').sort({ name: 1 }).lean();
  return apps
    .map((app) => {
      const installation = byApp.get(String(app._id))!;
      const open = (kind: 'command' | 'shortcut', key: string) => !place || isOwnChat(chat, installation) || enabledAt(itemSettingOf(installation.itemSettings, kind, key), place);
      const commands = (app.commands ?? []).filter((entry) => open('command', entry.command));
      const shortcuts = (app.shortcuts ?? []).filter((entry) => open('shortcut', entry.key));
      return { appId: String(app._id), appName: app.name, commands, ...(app.avatarUrl ? { avatarUrl: app.avatarUrl } : {}), shortcuts };
    })
    .filter((group) => !place || group.commands.length > 0 || group.shortcuts.length > 0);
}

/** In a channel or group the app posts as itself; in its own 1:1 too; a 1:1 between people only gets the ephemeral answer. */
function inChannelTarget(chat: ChatOfCommand, installation: Pick<BotInstallation, 'botUserId'>, askerId: Types.ObjectId): BotPost['target'] | null {
  if (chat.kind === 'group') return { channelId: String(chat._id) };
  return chat.members.some((member) => String(member.userId) === String(installation.botUserId)) ? { userId: String(askerId) } : null;
}

/** `chat` is null for the space's ⚡: an in_channel answer has nowhere to go and stays for the asker. */
export async function deliverResponse(installation: BotInstallation, run: Pick<BotCommandRun, '_id' | 'userId' | 'responses'>, chat: ChatOfCommand | null, response: CommandResponse, base: Base): Promise<CommandOutcome> {
  if (response.responseType === 'form' && response.form) {
    // Kept to check what is sent against it (`botForms.ts`).
    await BotCommandRunModel.updateOne({ _id: run._id }, { $set: { form: response.form } });
    return { ...base, outcome: 'form', response };
  }
  const target = response.responseType === 'in_channel' && chat ? inChannelTarget(chat, installation, run.userId) : null;
  if (target) {
    const posted = await postBotMessage(installation, { target, ...(response.text ? { text: response.text } : {}), ...(response.card ? { card: response.card } : {}), idempotencyKey: `cmd:${run._id}:${run.responses}` });
    if (!('error' in posted)) return { ...base, outcome: 'posted' };
  }
  // Kept for «Enviar al canal»: only the asker saw it.
  await BotCommandRunModel.updateOne({ _id: run._id }, { $set: { answer: { ...(response.text ? { text: response.text } : {}), ...(response.card ? { card: response.card } : {}), ...(response.shareable === false ? { shareable: false } : {}) } } });
  return { ...base, outcome: 'ephemeral', response: { ...response, responseType: 'ephemeral' } };
}

/** What the asker reads when the app was restarting (a deploy) even after the second try. */
export const restartingMessage = (appName: string): string => `${appName} se está actualizando: vuelve a intentarlo en unos segundos.`;

/** Kept on the run, not awaited: the installation's last delivery is overwritten by the next one. */
export function recordRunFailure(commandId: string, error: string): void {
  void BotCommandRunModel.updateOne({ _id: commandId }, { $set: { failure: { at: new Date(), error: error.slice(0, RUN_ERROR_MAX) } } }).catch((failure: unknown) => console.error('[bots] no se pudo guardar la falla del comando:', failure instanceof Error ? failure.message : failure));
}

/**
 * What the body of the webhook means for the asker, with Integraciones' health written once: a
 * timeout or an empty 200 is pending (not a failure), an error or a body that cannot be shown fails.
 */
function judgeReply(reply: WebhookReply, command: string, installationId: Types.ObjectId, base: Base): CommandOutcome | { accepted: CommandResponse } {
  if (reply.error === 'timeout') return { ...base, outcome: 'pending' };
  const failed = (error: string, message = `${base.appName} no pudo responder.`): CommandOutcome => {
    recordLastDelivery(installationId, { ok: false, error });
    recordRunFailure(base.commandId, error);
    return { ...base, outcome: 'failed', message };
  };
  if (isRestarting(reply)) return failed(reply.error ?? 'Sin respuesta', restartingMessage(base.appName));
  if (reply.status === null || reply.status >= 400) return failed(reply.error ?? 'Sin respuesta');
  // An empty body, `{}` or a response_type alone: the answer comes by /respond.
  if (isAckBody(reply.body)) {
    recordLastDelivery(installationId, { ok: true });
    return { ...base, outcome: 'pending' };
  }
  const valid = validateCommandResponse(reply.body);
  if (!valid.ok) return failed(`Respuesta de /${command} inválida: ${reply.body === undefined ? 'no es JSON' : valid.message}`);
  recordLastDelivery(installationId, { ok: true });
  return { accepted: valid.response };
}

/** What the person did: typed a command, or tapped an action of the «+» (R160, design e-29). */
type Trigger = { kind: 'command'; command: string; text: string } | { kind: 'shortcut'; key: string };

/** The chat where it was used and its space, or the space alone (its ⚡); null if the person is not in it. */
async function placeOf(userId: Types.ObjectId, scope: CommandScope): Promise<{ chat: ChatOfCommand | null; workspaceId: Types.ObjectId } | null> {
  if ('chatId' in scope) {
    if (!isId(scope.chatId)) return null;
    const chat = await ChatModel.findOne({ _id: scope.chatId, 'members.userId': userId, workspaceId: { $exists: true } }).select('_id kind name channel workspaceId members.userId').lean<ChatOfCommand | null>();
    return chat?.workspaceId ? { chat, workspaceId: chat.workspaceId } : null;
  }
  if (!isId(scope.workspaceId) || !(await WorkspaceMemberModel.exists({ workspaceId: scope.workspaceId, userId, status: 'active' }))) return null;
  return { chat: null, workspaceId: new Types.ObjectId(scope.workspaceId) };
}

async function invokeApp(userId: Types.ObjectId, scope: CommandScope, appId: unknown, trigger: Trigger): Promise<CommandOutcome | CommandError> {
  const name = trigger.kind === 'command' ? trigger.command : trigger.key;
  const notFound = () => fail(404, 'command_not_found', trigger.kind === 'command' ? `No hay un comando /${name} en este espacio.` : 'Esa acción ya no está en este espacio.');
  if (!isId(appId)) return notFound();
  // In parallel where nothing depends on the other: each trip to the vault counts while the person waits.
  const [place, app] = await Promise.all([placeOf(userId, scope), BotAppModel.findById(appId).select('name commands shortcuts webhookUrl').lean()]);
  if (!place) return 'chatId' in scope ? fail(404, 'chat_not_found', 'Ese chat no existe.') : fail(404, 'space_not_found', 'Ese espacio no existe.');
  const offered = trigger.kind === 'command' ? app?.commands?.some((entry) => entry.command === name) : app?.shortcuts?.some((entry) => entry.key === name);
  const installation = app && offered ? await BotInstallationModel.findOne({ appId: app._id, workspaceId: place.workspaceId, revokedAt: { $exists: false } }).lean() : null;
  if (!app || !installation) return notFound();
  const setting = itemSettingOf(installation.itemSettings, trigger.kind, name);
  if (!isOwnChat(place.chat, installation) && !enabledAt(setting, place.chat ? { chatId: String(place.chat._id) } : 'space')) return fail(404, 'not_enabled_here', 'Eso no está habilitado aquí: lo decide un admin del espacio.');
  // A failed run stays a week: its `failure` is how a «no pudo responder» gets explained (23/10).
  void BotCommandRunModel.deleteMany({ $or: [{ expiresAt: { $lt: new Date() }, failure: { $exists: false } }, { expiresAt: { $lt: new Date(Date.now() - FAILED_RUN_KEPT_MS) } }] }).catch((error: unknown) => console.error('[bots] no se pudieron purgar comandos vencidos:', error instanceof Error ? error.message : error));
  const { chat } = place;
  const [run, user] = await Promise.all([BotCommandRunModel.create({ installationId: installation._id, ...(chat ? { chatId: chat._id } : {}), workspaceId: place.workspaceId, userId, command: name, expiresAt: new Date(Date.now() + COMMAND_TTL_MS) }), personOf(userId, installation.grantedScopes)]);
  // Slack's global shortcuts carry no channel either.
  const common = { command_id: String(run._id), channel: chat ? channelOf(chat) : null, user };
  const reply = trigger.kind === 'command'
    ? await callBotWebhook({ ...installation, webhookUrl: app.webhookUrl }, 'command.invoked', { ...common, command: name, text: trigger.text }, answerTimeoutMs)
    : await callBotWebhook({ ...installation, webhookUrl: app.webhookUrl }, 'shortcut.invoked', { ...common, shortcut: name }, answerTimeoutMs);
  const base: Base = { commandId: String(run._id), appId: String(app._id), appName: app.name };
  const judged = judgeReply(reply, name, installation._id, base);
  if (!('accepted' in judged)) return judged;
  const [outcome] = await Promise.all([deliverResponse(installation, { ...run.toObject(), responses: 1 }, chat, judged.accepted, base), BotCommandRunModel.updateOne({ _id: run._id }, { $inc: { responses: 1 } })]);
  return outcome;
}

export function invokeCommand(userId: Types.ObjectId, scope: CommandScope, input: { appId: unknown; command: unknown; text: unknown }): Promise<CommandOutcome | CommandError> {
  const text = typeof input.text === 'string' ? input.text.trim().slice(0, COMMAND_LIMITS.input) : '';
  return invokeApp(userId, scope, input.appId, { kind: 'command', command: typeof input.command === 'string' ? input.command : '', text });
}

/** An action of the «+»: the app hears `shortcut.invoked` and answers like a command, usually with its form. */
export function invokeShortcut(userId: Types.ObjectId, scope: CommandScope, input: { appId: unknown; shortcut: unknown }): Promise<CommandOutcome | CommandError> {
  return invokeApp(userId, scope, input.appId, { kind: 'shortcut', key: typeof input.shortcut === 'string' ? input.shortcut : '' });
}

/** The late answer: once per call, five at most, within 15 minutes of the command. */
export async function respondToCommand(installation: BotInstallation, commandId: string, raw: unknown): Promise<{ response_type: 'ephemeral' | 'in_channel' | 'form' } | CommandError> {
  if (!isId(commandId)) return fail(404, 'command_not_found', 'Ese comando no existe.');
  const formReply = validateFormReply(raw);
  if (formReply.ok && 'errors' in formReply) return respondWithErrors(installation, commandId, formReply.errors);
  const valid = validateCommandResponse(raw);
  if (!valid.ok) return fail(400, 'invalid_request', valid.message);
  const run = await BotCommandRunModel.findOneAndUpdate({ _id: commandId, installationId: installation._id, expiresAt: { $gt: new Date() }, responses: { $lt: RESPONSES_PER_COMMAND } }, { $inc: { responses: 1 } }, { returnDocument: 'after' }).lean();
  if (!run) {
    const existing = await BotCommandRunModel.findOne({ _id: commandId, installationId: installation._id }).select('expiresAt').lean();
    if (!existing) return fail(404, 'command_not_found', 'Ese comando no existe o es de otra app.');
    if (existing.expiresAt.getTime() <= Date.now()) return fail(410, 'command_expired', 'Pasaron más de 15 minutos: ese comando ya no se puede responder.');
    return fail(409, 'too_many_responses', `Un comando se responde hasta ${RESPONSES_PER_COMMAND} veces.`);
  }
  const [chat, app] = await Promise.all([
    run.chatId ? ChatModel.findById(run.chatId).select('_id kind name channel workspaceId members.userId').lean<ChatOfCommand | null>() : null,
    BotAppModel.findById(installation.appId).select('name').lean(),
  ]);
  if (run.chatId && !chat) return fail(404, 'chat_not_found', 'El chat de ese comando ya no existe.');
  const base: Base = { commandId, appId: String(installation.appId), appName: app?.name ?? 'App' };
  const outcome = await deliverResponse(installation, run, chat, valid.response, base);
  const where = chat ? { chatId: String(chat._id) } : { workspaceId: String(run.workspaceId ?? installation.workspaceId) };
  if (outcome.outcome === 'ephemeral' || outcome.outcome === 'form') notifyAsker(String(run.userId), { ...where, commandId, appId: base.appId, appName: base.appName, response: outcome.response! });
  // Posted in the channel: the asker's «working…» card must go away too (it stayed forever, 23/10).
  else notifyAsker(String(run.userId), { ...where, commandId, appId: base.appId, appName: base.appName, response: valid.response, posted: true });
  settleLateAnswer(commandId, outcome);
  return { response_type: outcome.outcome === 'posted' ? 'in_channel' : outcome.outcome === 'form' ? 'form' : 'ephemeral' };
}

/**
 * A late refusal of the sent form (agentes, 23/10: «Ya marcaste ingreso» came
 * after the 1.5 s and got a 400): the asker's form opens again with the errors,
 * while it is still open (sent and not yet answered).
 */
async function respondWithErrors(installation: BotInstallation, commandId: string, errors: Record<string, string>): Promise<{ response_type: 'form' } | CommandError> {
  const run = await BotCommandRunModel.findOne({ _id: commandId, installationId: installation._id, expiresAt: { $gt: new Date() }, form: { $exists: true } }).lean();
  if (!run?.form) return fail(409, 'form_closed', 'Ese formulario ya no está abierto: los errores van mientras la persona espera su respuesta.');
  const app = await BotAppModel.findById(installation.appId).select('name').lean();
  const where = run.chatId ? { chatId: String(run.chatId) } : { workspaceId: String(run.workspaceId ?? installation.workspaceId) };
  notifyAsker(String(run.userId), { ...where, commandId, appId: String(installation.appId), appName: app?.name ?? 'App', response: { responseType: 'form', form: run.form }, errors });
  settleLateAnswer(commandId, { status: 422, errors });
  return { response_type: 'form' };
}

/**
 * «Enviar al canal» (José, 23/10): the answer only the asker saw goes to the
 * channel as the app's message, with «José usó /clima» on top. Once: a second tap
 * gets the same message back.
 */
export async function shareCommandAnswer(userId: Types.ObjectId, chatId: string, commandId: string): Promise<{ seq: number } | CommandError> {
  if (!isId(chatId) || !isId(commandId)) return fail(404, 'command_not_found', 'Ese comando no existe.');
  const run = await BotCommandRunModel.findOne({ _id: commandId, chatId, userId }).lean();
  if (!run) return fail(404, 'command_not_found', 'Ese comando no existe o no es tuyo.');
  if (run.expiresAt.getTime() <= Date.now()) return fail(410, 'command_expired', 'Pasaron más de 15 minutos: vuelve a usar el comando.');
  if (!run.answer) return fail(409, 'nothing_to_share', 'La app todavía no respondió.');
  if (run.answer.shareable === false) return fail(409, 'not_shareable', 'Esta respuesta no se comparte: es solo para ti.');
  const [chat, installation, person] = await Promise.all([
    ChatModel.findById(chatId).select('_id kind name channel workspaceId members.userId').lean<ChatOfCommand | null>(),
    BotInstallationModel.findOne({ _id: run.installationId, revokedAt: { $exists: false } }).lean(),
    personOf(userId),
  ]);
  if (!chat || chat.kind !== 'group') return fail(409, 'not_shareable', 'Solo se comparte en un canal o un grupo.');
  if (!installation) return fail(410, 'app_uninstalled', 'La app ya no está instalada en este espacio.');
  const card = run.answer.card as BotPost['card'] | undefined;
  const sharedBy = { userId, name: person.name ?? 'Alguien', command: run.command };
  const posted = await postBotMessage(installation, { target: { channelId: String(chat._id) }, ...(run.answer.text ? { text: run.answer.text } : {}), ...(card ? { card } : {}), idempotencyKey: `share:${run._id}` }, sharedBy);
  if ('error' in posted) return fail(409, 'not_shareable', 'La app no está en este canal.');
  return { seq: posted.message.seq };
}
