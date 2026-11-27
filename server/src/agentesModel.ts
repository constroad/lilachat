import { Types } from 'mongoose';
import { WorkspaceMemberModel } from './workspaceModels.js';
import { developerAppClientIds } from './bots/botApps.js';
import { callBotWebhook, recordLastDelivery, type WebhookReply } from './bots/botEvents.js';
import { BotAppModel, BotInstallationModel } from './bots/botModels.js';

/**
 * Lilachat asks agentes for a model task (José, 18/11): it holds no model key and names no provider; agentes picks
 * the model per task (agentes `core/llm/tasks.ts`). The ask travels as the signed webhook event
 * `llm.task.requested`, answered in the body like a form preview. It is signed with the installation of an agentes
 * app in a space where a member of the chat is active; that installation's company carries the usage.
 */
/** The tasks agentes accepts from Lilachat (agentes `core/llm/tasks.ts`). With a schema the answer is JSON; without, text. */
export type ModelTask = {
  task: 'link.classify' | 'link.propose' | 'assistant.catch_up' | 'assistant.mention' | 'event.draft';
  system: string;
  input: string;
  schema?: Record<string, unknown>;
};
export type ModelAnswer = { ok: true; json: unknown; text: string } | { ok: false; reason: 'not_configured' | 'failed' };
/** `memberIds`: the chat's members, whose space signs the ask. */
export type ModelAsker = (memberIds: readonly string[], request: ModelTask) => Promise<ModelAnswer>;

/** agentes cuts a read at 7 s; a deploy restart gets the one retry of `callBotWebhook` inside this. */
const ASK_TIMEOUT_MS = 10_000;

type Door = { _id: Types.ObjectId; workspaceId: Types.ObjectId; signingSecret: string; webhookUrl: string };

type AgentesApp = { _id: Types.ObjectId; webhookUrl: string };

/**
 * The apps agentes hosts: those whose webhook is on the host of its developer app (Lila). Any of them may sign a model
 * task or a sticker voice (José 27/11 via Agentes: in production Lila had no installation; Dali, Portal and Inframaq
 * did). An app of another product on its own host never signs.
 */
export async function agentesApps(): Promise<AgentesApp[]> {
  const developer = await BotAppModel.findOne({ clientId: { $in: developerAppClientIds() }, webhookUrl: { $exists: true } }).select('webhookUrl').lean();
  if (!developer?.webhookUrl) return [];
  const host = new URL(developer.webhookUrl).host;
  const apps = await BotAppModel.find({ webhookUrl: { $exists: true } }).select('_id webhookUrl').lean();
  return apps.flatMap((app) => (app.webhookUrl && new URL(app.webhookUrl).host === host ? [{ _id: app._id, webhookUrl: app.webhookUrl }] : []));
}

/** A live installation of an agentes app in a space where one of these people is an active member. */
export async function lilaDoorFor(memberIds: readonly string[]): Promise<Door | null> {
  const ids = memberIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
  if (ids.length === 0) return null;
  const [spaces, apps] = await Promise.all([
    WorkspaceMemberModel.distinct('workspaceId', { userId: { $in: ids }, status: 'active' }),
    agentesApps(),
  ]);
  if (spaces.length === 0 || apps.length === 0) return null;
  const installation = await BotInstallationModel.findOne({ appId: { $in: apps.map((app) => app._id) }, workspaceId: { $in: spaces }, revokedAt: { $exists: false } })
    .select('_id workspaceId signingSecret appId')
    .lean();
  const app = installation ? apps.find((one) => String(one._id) === String(installation.appId)) : undefined;
  return installation && app?.webhookUrl ? { _id: installation._id, workspaceId: installation.workspaceId, signingSecret: installation.signingSecret, webhookUrl: app.webhookUrl } : null;
}

/** agentes answers `{ ok: true, json, text }` or `{ ok: false, code }`; `off` means it has no model configured. */
export function modelAnswerOf(reply: WebhookReply): ModelAnswer {
  const body = reply.status === 200 && reply.body && typeof reply.body === 'object' ? (reply.body as { ok?: unknown; json?: unknown; text?: unknown; code?: unknown }) : null;
  if (body?.ok === true) return { ok: true, json: body.json ?? null, text: typeof body.text === 'string' ? body.text : '' };
  if (body?.ok === false && body.code === 'off') return { ok: false, reason: 'not_configured' };
  return { ok: false, reason: 'failed' };
}

export const askAgentesModel: ModelAsker = async (memberIds, request) => {
  const door = await lilaDoorFor(memberIds);
  if (!door) return { ok: false, reason: 'not_configured' };
  const reply = await callBotWebhook(door, 'llm.task.requested', request, ASK_TIMEOUT_MS);
  recordLastDelivery(door._id, reply.error ? { ok: false, error: reply.error } : { ok: true });
  const answer = modelAnswerOf(reply);
  if (!answer.ok && answer.reason === 'failed') console.error(`[model] agentes did not answer ${request.task}: ${reply.error ?? `HTTP ${reply.status}`}`);
  return answer;
};
