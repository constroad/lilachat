import { Types } from 'mongoose';
import { COMMAND_LIMITS, validateCommandResponse, type BotCommand, type BotPost, type CommandGroup, type CommandNotice, type CommandOutcome, type CommandResponse } from '@lilachat/shared';
import { ChatModel, type Chat } from '../chatModels.js';
import { WorkspaceMemberModel } from '../workspaceModels.js';
import { callBotWebhook } from './botEvents.js';
import { postBotMessage } from './botMessages.js';
import { BotAppModel, BotCommandRunModel, BotInstallationModel, type BotCommandRun, type BotInstallation } from './botModels.js';
import { channelOf, personOf } from './botTriggers.js';

/**
 * Slash commands (`specs/BOTS-API.spec.md` §c-bis), like Slack: the app
 * registers its list, a member of a space where it is installed sends
 * «/clima lurin», the app hears `command.invoked` ONCE and answers in the
 * response body (3 s) or later through `/respond` (15 min, up to 5 times).
 * An ephemeral answer is never stored: it goes back to the asker only.
 */
export type CommandError = { status: 400 | 404 | 409 | 410; error: string; message: string };
type ChatOfCommand = Pick<Chat, '_id' | 'kind' | 'name' | 'channel' | 'workspaceId' | 'members'>;
type Base = Pick<CommandOutcome, 'commandId' | 'appId' | 'appName'>;

const COMMAND_TTL_MS = 15 * 60_000;
const RESPONSES_PER_COMMAND = 5;
const isId = (value: unknown): value is string => typeof value === 'string' && Types.ObjectId.isValid(value);
const fail = (status: CommandError['status'], error: string, message: string): CommandError => ({ status, error, message });
let answerTimeoutMs = 3_000;
let notifyAsker: (userId: string, notice: CommandNotice) => void = () => undefined;

/** The socket sets who hears a late ephemeral answer; tests shorten the wait. */
export function configureCommands(options: { answerTimeoutMs?: number; notify?: (userId: string, notice: CommandNotice) => void }): void {
  if (options.answerTimeoutMs !== undefined) answerTimeoutMs = options.answerTimeoutMs;
  if (options.notify) notifyAsker = options.notify;
}

export const commandsToWire = (commands: readonly BotCommand[]) =>
  commands.map((entry) => ({ command: entry.command, description: entry.description, ...(entry.usageHint ? { usage_hint: entry.usageHint } : {}) }));

export async function registerCommands(installation: Pick<BotInstallation, 'appId'>, commands: BotCommand[]): Promise<BotCommand[]> {
  await BotAppModel.updateOne({ _id: installation.appId }, { $set: { commands } });
  return commands;
}

export async function commandsOfApp(installation: Pick<BotInstallation, 'appId'>): Promise<BotCommand[]> {
  return (await BotAppModel.findById(installation.appId).select('commands').lean())?.commands ?? [];
}

/** What the composer suggests in a space: each installed app with its commands, by name. Null if not an active member. */
export async function commandGroupsOf(workspaceId: string, userId: Types.ObjectId): Promise<CommandGroup[] | null> {
  if (!isId(workspaceId) || !(await WorkspaceMemberModel.exists({ workspaceId, userId, status: 'active' }))) return null;
  const installations = await BotInstallationModel.find({ workspaceId, revokedAt: { $exists: false } }).select('appId').lean();
  const apps = await BotAppModel.find({ _id: { $in: installations.map((one) => one.appId) }, 'commands.0': { $exists: true } }).select('name commands').sort({ name: 1 }).lean();
  return apps.map((app) => ({ appId: String(app._id), appName: app.name, commands: app.commands ?? [] }));
}

/** In a channel or group the app posts as itself; in its own 1:1 too; a 1:1 between people only gets the ephemeral answer. */
function inChannelTarget(chat: ChatOfCommand, installation: Pick<BotInstallation, 'botUserId'>, askerId: Types.ObjectId): BotPost['target'] | null {
  if (chat.kind === 'group') return { channelId: String(chat._id) };
  return chat.members.some((member) => String(member.userId) === String(installation.botUserId)) ? { userId: String(askerId) } : null;
}

async function deliverResponse(installation: BotInstallation, run: Pick<BotCommandRun, '_id' | 'userId' | 'responses'>, chat: ChatOfCommand, response: CommandResponse, base: Base): Promise<CommandOutcome> {
  const target = response.responseType === 'in_channel' ? inChannelTarget(chat, installation, run.userId) : null;
  if (target) {
    const posted = await postBotMessage(installation, { target, ...(response.text ? { text: response.text } : {}), ...(response.card ? { card: response.card } : {}), idempotencyKey: `cmd:${run._id}:${run.responses}` });
    if (!('error' in posted)) return { ...base, outcome: 'posted' };
  }
  return { ...base, outcome: 'ephemeral', response: { ...response, responseType: 'ephemeral' } };
}

export async function invokeCommand(userId: Types.ObjectId, chatId: string, input: { appId: unknown; command: unknown; text: unknown }): Promise<CommandOutcome | CommandError> {
  const command = typeof input.command === 'string' ? input.command : '';
  if (!isId(chatId) || !isId(input.appId)) return fail(404, 'command_not_found', `No hay un comando /${command} en este espacio.`);
  // In parallel where nothing depends on the other: each trip to the vault counts while the person waits.
  const [chat, app] = await Promise.all([
    ChatModel.findOne({ _id: chatId, 'members.userId': userId, workspaceId: { $exists: true } }).select('_id kind name channel workspaceId members.userId').lean<ChatOfCommand | null>(),
    BotAppModel.findById(input.appId).select('name commands webhookUrl').lean(),
  ]);
  if (!chat) return fail(404, 'chat_not_found', 'Ese chat no existe.');
  const installation = app?.commands?.some((entry) => entry.command === command) ? await BotInstallationModel.findOne({ appId: app._id, workspaceId: chat.workspaceId, revokedAt: { $exists: false } }).lean() : null;
  if (!app || !installation) return fail(404, 'command_not_found', `No hay un comando /${command} en este espacio.`);
  void BotCommandRunModel.deleteMany({ expiresAt: { $lt: new Date() } }).catch((error: unknown) => console.error('[bots] no se pudieron purgar comandos vencidos:', error instanceof Error ? error.message : error));
  const [run, user] = await Promise.all([BotCommandRunModel.create({ installationId: installation._id, chatId: chat._id, userId, command, expiresAt: new Date(Date.now() + COMMAND_TTL_MS) }), personOf(userId)]);
  const text = typeof input.text === 'string' ? input.text.trim().slice(0, COMMAND_LIMITS.input) : '';
  const data = { command_id: String(run._id), command, text, channel: channelOf(chat), user };
  const reply = await callBotWebhook({ ...installation, webhookUrl: app.webhookUrl }, 'command.invoked', data, answerTimeoutMs);
  const base: Base = { commandId: String(run._id), appId: String(app._id), appName: app.name };
  if (reply.error === 'timeout' || (reply.status !== null && reply.status < 400 && reply.body === null)) return { ...base, outcome: 'pending' };
  const valid = reply.status !== null && reply.status < 400 ? validateCommandResponse(reply.body) : null;
  if (!valid?.ok) {
    // A 2xx with a body that cannot be shown: Integraciones says why, so the app's developer sees it.
    if (valid) void BotInstallationModel.updateOne({ _id: installation._id }, { $set: { lastDelivery: { at: new Date(), ok: false, error: `Respuesta de /${command} inválida: ${valid.message}`.slice(0, 200) } } }).catch((error: unknown) => console.error('[bots] no se pudo guardar la falla del comando:', error instanceof Error ? error.message : error));
    return { ...base, outcome: 'failed', message: `${app.name} no pudo responder.` };
  }
  const [outcome] = await Promise.all([deliverResponse(installation, { ...run.toObject(), responses: 1 }, chat, valid.response, base), BotCommandRunModel.updateOne({ _id: run._id }, { $inc: { responses: 1 } })]);
  return outcome;
}

/** The late answer: once per call, five at most, within 15 minutes of the command. */
export async function respondToCommand(installation: BotInstallation, commandId: string, raw: unknown): Promise<{ response_type: 'ephemeral' | 'in_channel' } | CommandError> {
  if (!isId(commandId)) return fail(404, 'command_not_found', 'Ese comando no existe.');
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
    ChatModel.findById(run.chatId).select('_id kind name channel workspaceId members.userId').lean<ChatOfCommand | null>(),
    BotAppModel.findById(installation.appId).select('name').lean(),
  ]);
  if (!chat) return fail(404, 'chat_not_found', 'El chat de ese comando ya no existe.');
  const base: Base = { commandId, appId: String(installation.appId), appName: app?.name ?? 'App' };
  const outcome = await deliverResponse(installation, run, chat, valid.response, base);
  if (outcome.outcome === 'ephemeral') notifyAsker(String(run.userId), { chatId: String(chat._id), commandId, appId: base.appId, appName: base.appName, response: outcome.response! });
  return { response_type: outcome.outcome === 'posted' ? 'in_channel' : 'ephemeral' };
}
