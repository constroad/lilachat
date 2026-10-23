import type { CommandGroup, CommandOutcome } from '@lilachat/shared';
import { api } from '../../api';

/** The slash commands of the apps (`specs/BOTS-API.spec.md` §c-bis). */
export const spaceCommands = (jwt: string, spaceId: string) => api<{ groups: CommandGroup[] }>(`/workspaces/${spaceId}/commands`, { jwt });

export const runCommand = (jwt: string, chatId: string, input: { appId: string; command: string; text: string }) =>
  api<CommandOutcome>(`/chats/${chatId}/commands`, { jwt, body: { app_id: input.appId, command: input.command, text: input.text } });

/** «Enviar al canal»: the app posts in the channel the answer only I saw. */
export const shareCommandAnswer = (jwt: string, chatId: string, commandId: string) => api<{ seq: number }>(`/chats/${chatId}/commands/${commandId}/share`, { jwt, body: {} });
