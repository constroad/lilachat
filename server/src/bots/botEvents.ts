import { randomUUID } from 'node:crypto';
import type { Types } from 'mongoose';
import { BotAppModel, BotDeliveryModel, BotInstallationModel, type BotInstallation } from './botModels.js';
import { loopbackUrlOf, machineLoopbackOrigins } from './botLoopback.js';
import { eventSignature } from './botSecrets.js';

/**
 * The events a bot receives (`specs/BOTS-API.spec.md` §c): POST to its app's
 * `webhook_url`, signed with the installation's secret. Each delivery keeps its
 * id and its exact body across attempts (agentes deduplicates by the id); the
 * timestamp is the attempt's, so a retry still passes the 5-minute window.
 * Retries are timers in this process, not a poll of the database: at boot,
 * `resumeBotDeliveries` sets the timers of what was left pending.
 */
export type BotEventType = 'message.created' | 'message.edited' | 'message.deleted' | 'button.click' | 'checklist.item.toggled' | 'app.uninstalled' | 'command.invoked' | 'form.submitted' | 'shortcut.invoked' | 'link.status' | 'link.revoke' | 'client.files.requested' | 'client.service.requested' | 'client.account.requested' | 'client.report.requested';
export type WebhookReply = { status: number | null; body: unknown; error?: string };

const ATTEMPT_TIMEOUT_MS = 10_000;
const ERROR_MAX = 200;
/** A command's answer is a 16 KB card at most; a Drive of 200 files with thumbnails is ~150 KB of JSON, which a 64 KB cut broke (agentes, 30/10). */
const REPLY_MAX_BYTES = 256_000;
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

/** One attempt of a queued event: by loopback when the app lives on this machine, by its public address if nobody listens there. */
async function post(url: string, headers: Record<string, string>, body: string): Promise<string | null> {
  const local = loopbackUrlOf(url, machineLoopbackOrigins());
  if (local) {
    const attempt = await postTo(local, headers, body);
    if (attempt.reached) return attempt.error;
  }
  return (await postTo(url, headers, body)).error;
}

/** `reached`: the app answered (any status) or was too slow; false when nothing listens at that address. */
async function postTo(url: string, headers: Record<string, string>, body: string): Promise<{ error: string | null; reached: boolean }> {
  try {
    const response = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS) });
    return { error: response.ok ? null : `HTTP ${response.status}`, reached: true };
  } catch (error) {
    return { error: (error instanceof Error ? error.message : String(error)).slice(0, ERROR_MAX), reached: isTimeout(error) };
  }
}

const isTimeout = (error: unknown) => error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');

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

/** A restarting app (agentes deploys several times an hour): its proxy answers these, or nobody listens. */
const RESTARTING_STATUSES = [502, 503, 504];
/** The second try waits about what agentes takes to listen again after a deploy (~1 s, 23/10). */
const RETRY_DELAY_MS = 1_200;
const RETRY_SHARE_OF_WAIT = 0.4;

/** A body with a `code` (`product_failed`, `not-configured`) came from the app itself, not from a proxy without it. */
const appCodeOf = (body: unknown): string | null => {
  const code = (body as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code ? code : null;
};

/**
 * The app was down for a moment (a deploy), not broken: the asker is told to
 * try again in a few seconds. A 502/503 carrying the app's own `code` is its
 * answer: retrying it comes back 200 as a duplicate delivery and the code is
 * lost (agentes, 30/10).
 */
export function isRestarting(reply: WebhookReply): boolean {
  if (reply.error === 'timeout' || appCodeOf(reply.body)) return false;
  return reply.status === null || RESTARTING_STATUSES.includes(reply.status);
}

/** By loopback when the app lives on this machine; by its public address if nobody listens there, within the same wait. */
async function postOnce(installation: Pick<BotInstallation, '_id' | 'signingSecret'> & { webhookUrl: string }, type: BotEventType, deliveryId: string, body: string, timeoutMs: number): Promise<WebhookReply> {
  const headers = signedHeaders(installation.signingSecret, type, deliveryId, installation._id, body);
  const local = loopbackUrlOf(installation.webhookUrl, machineLoopbackOrigins());
  if (!local) return postReply(installation.webhookUrl, headers, body, timeoutMs);
  const started = Date.now();
  const reply = await postReply(local, headers, body, timeoutMs);
  if (reply.status !== null || reply.error === 'timeout') return reply;
  return postReply(installation.webhookUrl, headers, body, Math.max(1, timeoutMs - (Date.now() - started)));
}

async function postReply(url: string, headers: Record<string, string>, body: string, timeoutMs: number): Promise<WebhookReply> {
  try {
    const response = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(timeoutMs) });
    const text = (await response.text()).slice(0, REPLY_MAX_BYTES);
    let parsed: unknown = null;
    try {
      parsed = text.trim() ? JSON.parse(text) : null;
    } catch {
      parsed = undefined; // a body that is not JSON: the answer is broken, not missing
    }
    const code = appCodeOf(parsed);
    return { status: response.status, body: parsed, ...(response.ok ? {} : { error: `HTTP ${response.status}${code ? ` ${code}` : ''}` }) };
  } catch (error) {
    // Slow is the deferred answer, not a broken app.
    if (isTimeout(error)) return { status: null, body: null, error: 'timeout' };
    return { status: null, body: null, error: (error instanceof Error ? error.message : String(error)).slice(0, ERROR_MAX) };
  }
}

/**
 * A slash command (§c-bis): the person waits for the answer in the response
 * body, so there is no queue. A timeout is not an error: the app may still
 * answer through `/respond`. A 502/503/504 or a refused connection (the app
 * restarting in a deploy) is tried ONCE more with the same delivery id, within
 * the same wait: the app deduplicates by delivery (agentes, 23/10). Not when
 * the body brings the app's `code`: that one already answered.
 */
export async function callBotWebhook(installation: Pick<BotInstallation, '_id' | 'workspaceId' | 'signingSecret'> & { webhookUrl: string }, type: BotEventType, data: Record<string, unknown>, timeoutMs: number): Promise<WebhookReply> {
  const deliveryId = randomUUID();
  const body = envelope(installation, deliveryId, type, data);
  const deadline = Date.now() + timeoutMs;
  const first = await postOnce(installation, type, deliveryId, body, timeoutMs);
  const delay = Math.min(RETRY_DELAY_MS, timeoutMs * RETRY_SHARE_OF_WAIT);
  if (!isRestarting(first) || deadline - Date.now() <= delay) return first;
  await new Promise((resolve) => setTimeout(resolve, delay));
  return postOnce(installation, type, deliveryId, body, Math.max(1, deadline - Date.now()));
}

/** Integraciones' health after a call, written ONCE with the final verdict and not awaited: the person waits for the answer, not for this. */
export function recordLastDelivery(installationId: Types.ObjectId, verdict: { ok: true } | { ok: false; error: string }): void {
  const lastDelivery = { at: new Date(), ok: verdict.ok, ...(verdict.ok ? {} : { error: verdict.error.slice(0, ERROR_MAX) }) };
  void BotInstallationModel.updateOne({ _id: installationId }, { $set: { lastDelivery } }).catch((error: unknown) => console.error('[bots] no se pudo guardar la última entrega:', error instanceof Error ? error.message : error));
}
