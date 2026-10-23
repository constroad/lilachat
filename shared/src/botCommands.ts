import { validateBotCard, type BotCard } from './bots.js';

/**
 * Slash commands of the apps (`specs/BOTS-API.spec.md` §c), like Slack: an
 * app registers its list with `PUT /api/bots/commands`, the composer suggests
 * them grouped by app when the line starts with «/», and the answer comes back
 * only to the asker (ephemeral) or to the whole chat (in_channel). PURE: the
 * server validates with this and the app and the web suggest with it.
 * The wire is snake_case; what comes out is camelCase.
 */
export type BotCommand = { command: string; description: string; usageHint?: string };
export type CommandGroup = { appId: string; appName: string; commands: BotCommand[] };
export type CommandResponseType = 'ephemeral' | 'in_channel';
export type CommandResponse = { responseType: CommandResponseType; text?: string; card?: BotCard };

export const COMMAND_LIMITS = { commands: 25, name: 32, description: 100, usageHint: 60, text: 4000, input: 2000 };
const COMMAND_NAME = /^[a-z][a-z0-9_-]+$/;

const line = (value: unknown, max: number): string => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});

function validateCommand(raw: unknown): { ok: true; command: BotCommand } | { ok: false; message: string } {
  const entry = record(raw);
  const name = typeof entry.command === 'string' ? entry.command : '';
  if (!COMMAND_NAME.test(name) || name.length > COMMAND_LIMITS.name) {
    return { ok: false, message: `«${name}» no sirve: el comando va en minúsculas, sin «/» ni espacios, de 2 a ${COMMAND_LIMITS.name} (a-z, 0-9, - o _).` };
  }
  const description = line(entry.description, COMMAND_LIMITS.description);
  if (!description) return { ok: false, message: `«/${name}» necesita una descripción.` };
  const usageHint = line(entry.usage_hint, COMMAND_LIMITS.usageHint);
  return { ok: true, command: { command: name, description, ...(usageHint ? { usageHint } : {}) } };
}

/** The body of `PUT /api/bots/commands`: the whole list, which replaces the app's previous one. */
export function validateBotCommands(raw: unknown): { ok: true; commands: BotCommand[] } | { ok: false; message: string } {
  const list = record(raw).commands;
  if (!Array.isArray(list)) return { ok: false, message: 'Falta «commands»: la lista de comandos de la app.' };
  if (list.length > COMMAND_LIMITS.commands) return { ok: false, message: `Una app registra hasta ${COMMAND_LIMITS.commands} comandos.` };
  const commands: BotCommand[] = [];
  for (const entry of list) {
    const checked = validateCommand(entry);
    if (!checked.ok) return checked;
    if (commands.some((other) => other.command === checked.command.command)) return { ok: false, message: `El comando «/${checked.command.command}» está repetido.` };
    commands.push(checked.command);
  }
  return { ok: true, commands };
}

/** What the app answers to `command.invoked`, in the webhook body or later through `/respond`. */
export function validateCommandResponse(raw: unknown): { ok: true; response: CommandResponse } | { ok: false; message: string } {
  const body = record(raw);
  const responseType: CommandResponseType = body.response_type === 'in_channel' ? 'in_channel' : 'ephemeral';
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, COMMAND_LIMITS.text) : '';
  let card: BotCard | undefined;
  if (body.card !== undefined) {
    const checked = validateBotCard(body.card);
    if (!checked.ok) return checked;
    card = checked.card;
  }
  if (!text && !card) return { ok: false, message: 'La respuesta lleva «text» o «card».' };
  return { ok: true, response: { responseType, ...(text ? { text } : {}), ...(card ? { card } : {}) } };
}

/** «/clima lurin» → the command and the rest of the line; anything else is a normal message. */
export function parseSlashInput(input: string): { command: string; text: string } | null {
  const match = /^\/([a-zA-Z][a-zA-Z0-9_-]*)(?:\s+([\s\S]*))?$/.exec(input.trim());
  const [, name, rest] = match ?? [];
  if (!name) return null;
  return { command: name.toLowerCase(), text: (rest ?? '').trim() };
}

/** While the name is being typed («/cl»), the part to suggest for; null once there is a space or no slash. */
export function slashQuery(input: string): string | null {
  const match = /^\/([a-zA-Z0-9_-]*)$/.exec(input);
  return match ? (match[1] ?? '').toLowerCase() : null;
}

/** The suggestions, still grouped by app: the ones that start with the query first, then the ones that contain it. */
export function matchCommands(groups: readonly CommandGroup[], query: string): CommandGroup[] {
  const wanted = query.toLowerCase();
  if (!wanted) return groups.filter((group) => group.commands.length > 0);
  return groups
    .map((group) => {
      const starts = group.commands.filter((entry) => entry.command.startsWith(wanted));
      const contains = group.commands.filter((entry) => !entry.command.startsWith(wanted) && entry.command.includes(wanted));
      return { ...group, commands: [...starts, ...contains] };
    })
    .filter((group) => group.commands.length > 0);
}

/** What the composer gets back after sending a command (`POST /api/chats/:id/commands`). */
export type CommandOutcome = {
  commandId: string;
  appId: string;
  appName: string;
  outcome: 'ephemeral' | 'posted' | 'pending' | 'failed';
  response?: CommandResponse;
  message?: string;
};

/** A late answer that only the asker sees, over the socket (`command.response`). */
export type CommandNotice = { chatId: string; commandId: string; appId: string; appName: string; response: CommandResponse };

/**
 * The answers only the asker sees, on top of the composer (never stored).
 * A late answer to the same command replaces the previous one; the oldest
 * goes away beyond `EPHEMERAL_KEPT`.
 */
export type EphemeralAnswer = {
  commandId: string;
  appName: string;
  command: string;
  state: 'pending' | 'answered' | 'failed';
  response?: CommandResponse;
  message?: string;
};
export const EPHEMERAL_KEPT = 3;

export function answerOfOutcome(outcome: CommandOutcome, command: string): EphemeralAnswer | null {
  if (outcome.outcome === 'posted') return null;
  const base = { commandId: outcome.commandId, appName: outcome.appName, command };
  if (outcome.outcome === 'ephemeral' && outcome.response) return { ...base, state: 'answered', response: outcome.response };
  if (outcome.outcome === 'failed') return { ...base, state: 'failed', message: outcome.message ?? `${outcome.appName} no pudo responder.` };
  return { ...base, state: 'pending' };
}

export function withAnswer(list: readonly EphemeralAnswer[], answer: EphemeralAnswer): EphemeralAnswer[] {
  const rest = list.filter((entry) => entry.commandId !== answer.commandId);
  return [...rest, answer].slice(-EPHEMERAL_KEPT);
}

/** A notice from the socket: it answers its pending command, or arrives on its own if that one was dismissed. */
export function withNotice(list: readonly EphemeralAnswer[], notice: CommandNotice): EphemeralAnswer[] {
  const known = list.find((entry) => entry.commandId === notice.commandId);
  return withAnswer(list, { commandId: notice.commandId, appName: notice.appName, command: known?.command ?? '', state: 'answered', response: notice.response });
}
