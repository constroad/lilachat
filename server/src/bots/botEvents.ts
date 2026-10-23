import { randomUUID } from 'node:crypto';
import type { Types } from 'mongoose';
import { BotAppModel, BotDeliveryModel, BotInstallationModel, type BotInstallation } from './botModels.js';
import { eventSignature } from './botSecrets.js';

/**
 * The events a bot receives (`specs/BOTS-API.spec.md` §c): POST to its app's
 * `webhook_url`, signed with the installation's secret. Each delivery keeps its
 * id and its exact body across attempts (agentes deduplicates by the id); the
 * timestamp is the attempt's, so a retry still passes the 5-minute window.
 * Retries are timers in this process, not a poll of the database: at boot,
 * `resumeBotDeliveries` sets the timers of what was left pending.
 */
export type BotEventType = 'message.created' | 'button.click' | 'checklist.item.toggled' | 'app.uninstalled' | 'command.invoked' | 'form.submitted' | 'shortcut.invoked';
export type WebhookReply = { status: number | null; body: unknown; error?: string };

const ATTEMPT_TIMEOUT_MS = 10_000;
const ERROR_MAX = 200;
/** A command's answer is at most a 16 KB card plus its text: anything bigger is not read. */
const REPLY_MAX_BYTES = 64_000;
let retryDelaysMs: readonly number[] = [10_000, 60_000, 300_000, 1_800_000];

/** Tests shorten the waits. */
export function configureBotDeliveries(options: { retryDelaysMs: readonly number[] }): void {
  retryDelaysMs = options.retryDelaysMs;
}

const envelope = (installation: Pick<BotInstallation, '_id' | 'workspaceId'>, deliveryId: string, type: BotEventType, data: Record<string, unknown>) =>
  JSON.stringify({ event_id: deliveryId, type, installation_id: String(installation._id), space_id: String(installation.workspaceId), created_at: new Date().toISOString(), data });

function signedHeaders(signingSecret: string, event: string, deliveryId: string, installationId: Types.ObjectId, body: string): Record<string, string> {
  const timestamp = Date.now();
  return {
    'Content-Type': 'application/json',
    'X-Lilachat-Event': event,
    'X-Lilachat-Delivery': deliveryId,
    'X-Lilachat-Installation': String(installationId),
    'X-Lilachat-Timestamp': String(timestamp),
    'X-Lilachat-Signature': eventSignature(signingSecret, timestamp, body),
  };
}

export async function sendBotEvent(installation: Pick<BotInstallation, '_id' | 'workspaceId'>, type: BotEventType, data: Record<string, unknown>): Promise<void> {
  const deliveryId = randomUUID();
  const body = envelope(installation, deliveryId, type, data);
  const delivery = await BotDeliveryModel.create({ installationId: installation._id, deliveryId, event: type, body, status: 'pending' });
  void attemptDelivery(delivery._id);
}

async function post(url: string, headers: Record<string, string>, body: string): Promise<string | null> {
  try {
    const response = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS) });
    return response.ok ? null : `HTTP ${response.status}`;
  } catch (error) {
    return (error instanceof Error ? error.message : String(error)).slice(0, ERROR_MAX);
  }
}

async function attemptDelivery(id: Types.ObjectId): Promise<void> {
  try {
    const delivery = await BotDeliveryModel.findOne({ _id: id, status: 'pending' }).lean();
    if (!delivery) return;
    const installation = await BotInstallationModel.findById(delivery.installationId).select('appId signingSecret').lean();
    const app = installation ? await BotAppModel.findById(installation.appId).select('webhookUrl').lean() : null;
    if (!installation || !app) return void (await BotDeliveryModel.updateOne({ _id: id }, { $set: { status: 'failed', lastError: 'Sin instalación o app' } }));
    const error = await post(app.webhookUrl, signedHeaders(installation.signingSecret, delivery.event, delivery.deliveryId, delivery.installationId, delivery.body), delivery.body);
    await recordAttempt(delivery, error);
  } catch (error) {
    console.error('[bots] no se pudo entregar un evento:', error instanceof Error ? error.message : error);
  }
}

async function recordAttempt(delivery: { _id: Types.ObjectId; installationId: Types.ObjectId; attempts: number }, error: string | null): Promise<void> {
  const attempts = delivery.attempts + 1;
  const delay = retryDelaysMs[attempts - 1];
  const status = error === null ? 'delivered' : delay === undefined ? 'failed' : 'pending';
  await BotDeliveryModel.updateOne(
    { _id: delivery._id },
    { $set: { attempts, status, ...(error ? { lastError: error } : {}), ...(status === 'pending' ? { nextAttemptAt: new Date(Date.now() + delay!) } : {}) } }
  );
  await BotInstallationModel.updateOne({ _id: delivery.installationId }, { $set: { lastDelivery: { at: new Date(), ok: error === null, ...(error ? { error } : {}) } } });
  if (status === 'pending') setTimeout(() => void attemptDelivery(delivery._id), delay).unref();
}

/** At boot: the deliveries left pending get their timers back. */
export async function resumeBotDeliveries(): Promise<number> {
  const pending = await BotDeliveryModel.find({ status: 'pending' }).select('_id nextAttemptAt').lean();
  for (const delivery of pending) {
    const wait = Math.max(0, (delivery.nextAttemptAt?.getTime() ?? 0) - Date.now());
    setTimeout(() => void attemptDelivery(delivery._id), wait).unref();
  }
  return pending.length;
}

/**
 * A slash command (§c-bis): the event goes out ONCE and the person waits for
 * the answer in the response body, so there is no queue and no retry. A
 * timeout is not an error: the app may still answer through `/respond`.
 */
export async function callBotWebhook(installation: Pick<BotInstallation, '_id' | 'workspaceId' | 'signingSecret'> & { webhookUrl: string }, type: BotEventType, data: Record<string, unknown>, timeoutMs: number): Promise<WebhookReply> {
  const deliveryId = randomUUID();
  const body = envelope(installation, deliveryId, type, data);
  let reply: WebhookReply;
  try {
    const response = await fetch(installation.webhookUrl, { method: 'POST', headers: signedHeaders(installation.signingSecret, type, deliveryId, installation._id, body), body, signal: AbortSignal.timeout(timeoutMs) });
    const text = (await response.text()).slice(0, REPLY_MAX_BYTES);
    let parsed: unknown = null;
    try {
      parsed = text.trim() ? JSON.parse(text) : null;
    } catch {
      parsed = undefined; // a body that is not JSON: the answer is broken, not missing
    }
    reply = { status: response.status, body: parsed, ...(response.ok ? {} : { error: `HTTP ${response.status}` }) };
  } catch (error) {
    const slow = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    // Slow is the deferred answer, not a broken app.
    if (slow) return { status: null, body: null, error: 'timeout' };
    reply = { status: null, body: null, error: (error instanceof Error ? error.message : String(error)).slice(0, ERROR_MAX) };
  }
  return reply;
}

/** Integraciones' health after a call, written ONCE with the final verdict and not awaited: the person waits for the answer, not for this. */
export function recordLastDelivery(installationId: Types.ObjectId, verdict: { ok: true } | { ok: false; error: string }): void {
  const lastDelivery = { at: new Date(), ok: verdict.ok, ...(verdict.ok ? {} : { error: verdict.error.slice(0, ERROR_MAX) }) };
  void BotInstallationModel.updateOne({ _id: installationId }, { $set: { lastDelivery } }).catch((error: unknown) => console.error('[bots] no se pudo guardar la última entrega:', error instanceof Error ? error.message : error));
}
