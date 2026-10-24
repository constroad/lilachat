import type { Types } from 'mongoose';
import { linkOfReply, revokedOfReply, type AppLink } from '@lilachat/shared';
import { callBotWebhook, type BotEventType, type WebhookReply } from './botEvents.js';
import { BotAppModel, type BotInstallation } from './botModels.js';

/**
 * «Conectado como … / Desconectar» (pending 59; `specs/BOTS-API.spec.md`
 * §c-novies). The account is per app (agentes f02cb99): Lilachat asks the
 * webhook of THIS installation's app, signed like `command.invoked`, and
 * stores nothing.
 */
type Installation = Pick<BotInstallation, '_id' | 'appId' | 'workspaceId' | 'signingSecret'>;
/** Drawn while the detail opens: a slow app hides the row instead of holding the screen. */
const LINK_TIMEOUT_MS = 5_000;
const HTTP_OK_MAX = 299;

async function askApp(installation: Installation, type: Extract<BotEventType, 'link.status' | 'link.revoke'>, userId: Types.ObjectId): Promise<WebhookReply | null> {
  const app = await BotAppModel.findById(installation.appId).select('webhookUrl').lean();
  if (!app?.webhookUrl) return null;
  return callBotWebhook({ ...installation, webhookUrl: app.webhookUrl }, type, { user: { id: String(userId) } }, LINK_TIMEOUT_MS);
}

const answered = (reply: WebhookReply | null): reply is WebhookReply => reply !== null && reply.status !== null && reply.status <= HTTP_OK_MAX;

export async function linkOf(installation: Installation, userId: Types.ObjectId): Promise<AppLink> {
  const reply = await askApp(installation, 'link.status', userId);
  return answered(reply) ? linkOfReply(reply.body) : { unknown: true };
}

export async function revokeLink(installation: Installation, userId: Types.ObjectId): Promise<boolean> {
  const reply = await askApp(installation, 'link.revoke', userId);
  return answered(reply) && revokedOfReply(reply.body);
}
