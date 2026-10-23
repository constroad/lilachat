import type { CommandGroup, CommandOutcome } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { jsonCall } from '../../api/jsonCall';

/** The slash commands of the apps (`specs/BOTS-API.spec.md` §c-bis). */
export const spaceCommands = (jwt: string, spaceId: string) => jsonCall<{ groups: CommandGroup[] }>(`${BASE_URL}/api/workspaces/${spaceId}/commands`, jwt);

export const runCommand = (jwt: string, chatId: string, input: { appId: string; command: string; text: string }) =>
  jsonCall<CommandOutcome>(`${BASE_URL}/api/chats/${chatId}/commands`, jwt, { method: 'POST', body: JSON.stringify({ app_id: input.appId, command: input.command, text: input.text }) });

/** «Enviar al canal»: the app posts in the channel the answer only I saw. */
export const shareCommandAnswer = (jwt: string, chatId: string, commandId: string) => jsonCall<{ seq: number }>(`${BASE_URL}/api/chats/${chatId}/commands/${commandId}/share`, jwt, { method: 'POST', body: '{}' });
