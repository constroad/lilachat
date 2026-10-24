import { validateFormSpec, type AppForm } from './appForms.js';
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
/** An action of the composer's «+» (R160, design e-29): tapping it is like a command without typing it. */
export type AppShortcut = { key: string; name: string; description?: string };
export type CommandGroup = { appId: string; appName: string; commands: BotCommand[]; avatarUrl?: string; shortcuts?: AppShortcut[] };
/** `form` (R160): the answer is a form only the asker sees; sending it is their confirmation. */
export type CommandResponseType = 'ephemeral' | 'in_channel' | 'form';
/** `shareable: false` (agentes, 23/10: debts, payments, payroll): no «Enviar al canal». */
export type CommandResponse = { responseType: CommandResponseType; text?: string; card?: BotCard; form?: AppForm; shareable?: false };

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
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, COMMAND_LIMITS.text) : '';
  if (body.response_type === 'form') {
    const form = validateFormSpec(body.form);
    // The text goes above the form: why it is asked (agentes, 23/10: «Inframaq no te reconoce todavía»).
    return form.ok ? { ok: true, response: { responseType: 'form', form: form.form, ...(text ? { text } : {}) } } : form;
  }
  const responseType: CommandResponseType = body.response_type === 'in_channel' ? 'in_channel' : 'ephemeral';
  let card: BotCard | undefined;
  if (body.card !== undefined) {
    const checked = validateBotCard(body.card);
    if (!checked.ok) return checked;
    card = checked.card;
  }
  if (!text && !card) return { ok: false, message: 'La respuesta lleva «text» o «card».' };
  return { ok: true, response: { responseType, ...(text ? { text } : {}), ...(card ? { card } : {}), ...(body.shareable === false ? { shareable: false as const } : {}) } };
}

/**
 * A body that only acknowledges (`{}`, or a response_type alone) means «I answer
 * by `/respond`», like an empty 200: the person sees «working…», never «no pudo
 * responder» (José, 23/10: red for a few seconds, then the good answer arrived).
 */
export function isAckBody(raw: unknown): boolean {
  if (raw === null) return true;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const body = raw as Record<string, unknown>;
  return body.response_type !== 'form' && !['text', 'card', 'form', 'errors'].some((key) => key in body && body[key] !== undefined && body[key] !== null && body[key] !== '');
}

/**
 * What the app answers to `form.submitted`: a normal answer (the form closes)
 * or `{ errors }`, a message per field and `"_"` for the whole form (it stays
 * open with them, agentes 23/10).
 */
export function validateFormReply(raw: unknown): { ok: true; errors: Record<string, string> } | { ok: true; response: CommandResponse } | { ok: false; message: string } {
  const errors = record(record(raw).errors);
  const messages = Object.fromEntries(Object.entries(errors).flatMap(([field, message]) => (typeof message === 'string' && message.trim() ? [[field, line(message, COMMAND_LIMITS.description * 2)]] : [])));
  if (Object.keys(messages).length) return { ok: true, errors: messages };
  const valid = validateCommandResponse(raw);
  return valid.ok ? { ok: true, response: valid.response } : valid;
}

/** «/clima lurin» → the command and the rest of the line; anything else is a normal message. */
export function parseSlashInput(input: string): { command: string; text: string } | null {
  const match = /^\/([a-zA-Z][a-zA-Z0-9_-]*)(?:\s+([\s\S]*))?$/.exec(input.trim());
  const [, name, rest] = match ?? [];
  if (!name) return null;
  return { command: name.toLowerCase(), text: (rest ?? '').trim() };
}

/** On top of an app's answer that who asked sent to the channel (José, 23/10), like Slack's «usó /giphy». */
export const sharedByLine = (sharedBy: { name: string; command: string }): string => `${sharedBy.name} usó /${sharedBy.command}`;

/** The app whose command this line is, with what goes after it; null when no app of the space has it. */
export function commandOf(groups: readonly CommandGroup[], input: string): { appId: string; command: string; text: string } | null {
  const parsed = parseSlashInput(input);
  const group = parsed ? groups.find((one) => one.commands.some((entry) => entry.command === parsed.command)) : undefined;
  return parsed && group ? { appId: group.appId, ...parsed } : null;
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
  outcome: 'ephemeral' | 'posted' | 'pending' | 'failed' | 'form';
  response?: CommandResponse;
  message?: string;
};

/** A late answer that only the asker sees, over the socket (`command.response`). */
/** `workspaceId` instead of `chatId`: it was used from the space's ⚡, outside any chat (José, 23/10). */
export type CommandNotice = { chatId?: string; workspaceId?: string; commandId: string; appId: string; appName: string; response: CommandResponse; /** The late answer went to the channel as the app's message: the «working…» card just goes away. */ posted?: true };
/** Where a command or an action was used: a chat of the space, or the space itself (its ⚡). */
export type CommandScope = { chatId: string } | { workspaceId: string };
/** The API path of a scope: `/api/chats/<id>` or `/api/workspaces/<id>`. */
export const commandScopePath = (scope: CommandScope): string => ('chatId' in scope ? `/api/chats/${scope.chatId}` : `/api/workspaces/${scope.workspaceId}`);

/**
 * The answers only the asker sees, on top of the composer (never stored).
 * A late answer to the same command replaces the previous one; the oldest
 * goes away beyond `EPHEMERAL_KEPT`.
 */
export type EphemeralAnswer = {
  commandId: string;
  appName: string;
  command: string;
  /** The name of the action of the ⚡ or the «+» it came from (R160), shown instead of «/command». */
  action?: string;
  /** `form`: the app asked for a form (`response.form`), drawn as a sheet or a dialog. */
  state: 'pending' | 'answered' | 'failed' | 'form';
  response?: CommandResponse;
  message?: string;
};
export const EPHEMERAL_KEPT = 3;

export function answerOfOutcome(outcome: CommandOutcome, command: string): EphemeralAnswer | null {
  if (outcome.outcome === 'posted') return null;
  const base = { commandId: outcome.commandId, appName: outcome.appName, command };
  if (outcome.outcome === 'ephemeral' && outcome.response) return { ...base, state: 'answered', response: outcome.response };
  if (outcome.outcome === 'form' && outcome.response?.form) return { ...base, state: 'form', response: outcome.response };
  if (outcome.outcome === 'failed') return { ...base, state: 'failed', message: outcome.message ?? `${outcome.appName} no pudo responder.` };
  return { ...base, state: 'pending' };
}

export function withAnswer(list: readonly EphemeralAnswer[], answer: EphemeralAnswer): EphemeralAnswer[] {
  const rest = list.filter((entry) => entry.commandId !== answer.commandId);
  return [...rest, answer].slice(-EPHEMERAL_KEPT);
}

/**
 * The card shown the moment a command leaves (José, 23/10: no feedback while
 * the app thinks), swapped in place for what the server said; null (posted in
 * the channel) just takes it away.
 */
export function replaceAnswer(list: readonly EphemeralAnswer[], placeholderId: string, answer: EphemeralAnswer | null): EphemeralAnswer[] {
  // The socket can bring the app's late answer before its own request returns: a weaker state does not replace it.
  const settled = answer && (answer.state === 'pending' || answer.state === 'failed') && list.some((entry) => entry.commandId === answer.commandId && (entry.state === 'answered' || entry.state === 'form'));
  if (settled) return list.filter((entry) => entry.commandId !== placeholderId).map((entry) => (entry.commandId === answer.commandId && !entry.command ? { ...entry, command: answer.command, ...(answer.action ? { action: answer.action } : {}) } : entry));
  const index = list.findIndex((entry) => entry.commandId === placeholderId);
  if (index < 0) return answer ? withAnswer(list, answer) : [...list];
  const rest = list.filter((entry, at) => at !== index && entry.commandId !== answer?.commandId);
  if (!answer) return rest;
  return [...rest.slice(0, index), answer, ...rest.slice(index)].slice(-EPHEMERAL_KEPT);
}

/** A form's sheet is keyed by this: the next form of the same command (account code after destination) mounts fresh. */
export const formKeyOf = (answer: Pick<EphemeralAnswer, 'commandId' | 'response'>): string => `${answer.commandId}:${answer.response?.form?.id ?? ''}`;

/** A notice from the socket: it answers its pending command, or arrives on its own if that one was dismissed. */
export function withNotice(list: readonly EphemeralAnswer[], notice: CommandNotice): EphemeralAnswer[] {
  if (notice.posted) return list.filter((entry) => entry.commandId !== notice.commandId);
  const known = list.find((entry) => entry.commandId === notice.commandId);
  return withAnswer(list, { commandId: notice.commandId, appName: notice.appName, command: known?.command ?? '', ...(known?.action ? { action: known.action } : {}), state: notice.response.form ? 'form' : 'answered', response: notice.response });
}

/** A command still «working…» after this long gave up (pending 103: agentes never answered and the card stayed forever). */
export const PENDING_GIVE_UP_MS = 45_000;

/** The still-pending answer of that command becomes a failure the person can retry; anything else stays. */
export function giveUpPending(list: readonly EphemeralAnswer[], commandId: string): EphemeralAnswer[] {
  return list.map((entry) => (entry.commandId === commandId && entry.state === 'pending' ? { ...entry, state: 'failed', message: `${entry.appName} no respondió a tiempo. Vuelve a intentarlo.` } : entry));
}
