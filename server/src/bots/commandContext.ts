import { Types } from 'mongoose';
import { contextOf, EncryptedChatError, NotAMemberError } from '../assistantService.js';
import { developerAppClientIds } from './botApps.js';
import { BotAppModel, BotCommandRunModel, type BotInstallation } from './botModels.js';
import type { CommandError } from './botCommands.js';

/**
 * agentes' Lila answers «/lila ¿qué se decidió?» in a channel (José 18/11: one Lila). A bot never reads a
 * channel's text; this door gives the recent messages ONLY for a live /lila run of an app of agentes, in the chat
 * where it was asked, with the asker's membership as the permission (the same reader as Lilachat's assistant).
 */
export const CONTEXT_COMMAND = 'lila';

export type CommandContext = { chat: { name: string }; messages: { from: string; text: string }[] };

const fail = (status: CommandError['status'], error: string, message: string): CommandError => ({ status, error, message });
const notAContextCommand = () => fail(403, 'not_a_context_command', 'Solo /lila de Lila lee el chat donde se pidió.');

/** The app is agentes' Lila or one of the apps it made (§0-bis). */
async function isAgentesApp(appId: Types.ObjectId): Promise<boolean> {
  const developers = developerAppClientIds();
  if (developers.length === 0) return false;
  const app = await BotAppModel.findById(appId).select('clientId ownerAppId').lean();
  if (!app) return false;
  if (developers.includes(app.clientId)) return true;
  return Boolean(app.ownerAppId && (await BotAppModel.exists({ _id: app.ownerAppId, clientId: { $in: developers } })));
}

export async function commandContextOf(installation: Pick<BotInstallation, '_id' | 'appId'>, commandId: string): Promise<CommandContext | CommandError> {
  if (!Types.ObjectId.isValid(commandId)) return fail(404, 'command_not_found', 'Ese comando no existe.');
  const run = await BotCommandRunModel.findOne({ _id: commandId, installationId: installation._id }).select('chatId userId command expiresAt').lean();
  if (!run) return fail(404, 'command_not_found', 'Ese comando no existe o es de otra app.');
  if (run.expiresAt.getTime() <= Date.now()) return fail(410, 'command_expired', 'Pasaron más de 15 minutos: ese comando ya no lee el chat.');
  if (run.command !== CONTEXT_COMMAND || !(await isAgentesApp(installation.appId))) return notAContextCommand();
  if (!run.chatId) return fail(409, 'no_chat', '/lila se usa dentro de un chat.');
  try {
    const { chatName, messages } = await contextOf(run.chatId, run.userId);
    return { chat: { name: chatName }, messages: messages.map((message) => ({ from: message.from, text: message.body })) };
  } catch (error) {
    if (error instanceof EncryptedChatError) return fail(409, 'encrypted_chat', error.message);
    if (error instanceof NotAMemberError) return fail(404, 'chat_not_found', error.message);
    throw error;
  }
}
