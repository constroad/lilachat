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
export type BotEventType = 'message.created' | 'button.click' | 'checklist.item.toggled' | 'app.uninstalled';

const ATTEMPT_TIMEOUT_MS = 10_000;
const ERROR_MAX = 200;
let retryDelaysMs: readonly number[] = [10_000, 60_000, 300_000, 1_800_000];

/** Tests shorten the waits. */
export function configureBotDeliveries(options: { retryDelaysMs: readonly number[] }): void {
  retryDelaysMs = options.retryDelaysMs;
}

export async function sendBotEvent(installation: Pick<BotInstallation, '_id' | 'workspaceId'>, type: BotEventType, data: Record<string, unknown>): Promise<void> {
  const deliveryId = randomUUID();
  const body = JSON.stringify({ event_id: deliveryId, type, installation_id: String(installation._id), space_id: String(installation.workspaceId), created_at: new Date().toISOString(), data });
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
    const timestamp = Date.now();
    const error = await post(app.webhookUrl, {
      'Content-Type': 'application/json',
      'X-Lilachat-Event': delivery.event,
      'X-Lilachat-Delivery': delivery.deliveryId,
      'X-Lilachat-Installation': String(delivery.installationId),
      'X-Lilachat-Timestamp': String(timestamp),
      'X-Lilachat-Signature': eventSignature(installation.signingSecret, timestamp, delivery.body),
    }, delivery.body);
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
