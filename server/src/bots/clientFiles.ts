import { Types } from 'mongoose';
import { CLIENT_ID, serviceDetailOf, serviceFilesOf, type ServiceDetail, type ServiceFiles } from '@lilachat/shared';
import { ChatModel } from '../chatModels.js';
import { UserModel } from '../models.js';
import { actorIn } from '../workspaces.js';
import { ClientChannelModel, type ClientChannel } from './botClients.js';
import { callBotWebhook, recordLastDelivery, type BotEventType } from './botEvents.js';
import { BotAppModel, BotInstallationModel } from './botModels.js';

/** agentes answers within 7 s (its contract); this waits a little longer so its own 502 arrives first. */
const ASK_TIMEOUT_MS = 8_000;
export const DRIVE_FAILED = 'No se pudo traer el Drive';
export const DETAIL_FAILED = 'No se pudo traer el detalle del servicio';

type NotFound = { status: 404; error: string; message: string };
export type AskOutcome<T> = { ok: true; value: T } | { ok: false; message: string; fallbackUrl: string | null };
export type FilesOutcome = { ok: true; files: ServiceFiles } | { ok: false; message: string; fallbackUrl: string | null };

const notFound = (): NotFound => ({ status: 404, error: 'service_not_found', message: 'Ese servicio no existe o no estás en el canal del cliente.' });

type ServiceAsk<T> = { event: Extract<BotEventType, `client.${string}.requested`>; parse: (body: unknown) => T | null; failed: string; label: string };

type AskedService = { client: Pick<ClientChannel, 'appId' | 'chatId' | 'driveUrl' | 'services'>; fallbackUrl: string | null };
type Asker = { id: string; name?: string; phone?: string };

/** The service, only for a member of the client's PRIVATE channel and only if the app listed it in its last PUT (Portal only checks the company). */
async function findAskedService(workspaceId: string, clientId: string, serviceId: string, userId: Types.ObjectId): Promise<AskedService | null> {
  await actorIn(workspaceId, userId);
  if (!CLIENT_ID.test(clientId) || !CLIENT_ID.test(serviceId)) return null;
  const client = await ClientChannelModel.findOne({ workspaceId: new Types.ObjectId(workspaceId), clientId }).select('appId chatId driveUrl services').lean<AskedService['client'] | null>();
  const service = client?.services.find((one) => one.id === serviceId);
  if (!client || !service || !(await ChatModel.exists({ _id: client.chatId, 'members.userId': userId }))) return null;
  return { client, fallbackUrl: service.url ?? client.driveUrl ?? null };
}

async function askerOf(userId: Types.ObjectId): Promise<Asker> {
  const user = await UserModel.findById(userId).select('name phone').lean();
  return { id: String(userId), ...(user?.name ? { name: user.name } : {}), ...(user?.phone ? { phone: user.phone } : {}) };
}

/** The person sees one screen; the log keeps agentes' code (product_failed, not-configured, invalid-input). */
function logUnanswered(label: string, reply: { status?: number; error?: string; body?: unknown }): void {
  const code = (reply.body as { code?: unknown } | null)?.code;
  console.warn(`[clientes] ${label} sin respuesta:`, reply.status ?? reply.error, typeof code === 'string' ? code : '');
}

/**
 * Asks the app that owns a client about one of its services, answered in the
 * same request (pending 121 Drive; José 30/10 detail). Nothing is stored: the
 * links never expire, so they only show inside that channel.
 */
async function askAboutService<T>(ask: ServiceAsk<T>, workspaceId: string, clientId: string, serviceId: string, userId: Types.ObjectId): Promise<AskOutcome<T> | NotFound> {
  const asked = await findAskedService(workspaceId, clientId, serviceId, userId);
  if (!asked) return notFound();
  const { client, fallbackUrl } = asked;
  const [installation, app, user] = await Promise.all([
    BotInstallationModel.findOne({ appId: client.appId, workspaceId: new Types.ObjectId(workspaceId), revokedAt: { $exists: false } }).lean(),
    BotAppModel.findById(client.appId).select('webhookUrl').lean(),
    askerOf(userId),
  ]);
  if (!installation || !app?.webhookUrl) return { ok: false, message: ask.failed, fallbackUrl };
  const reply = await callBotWebhook({ ...installation, webhookUrl: app.webhookUrl }, ask.event, { client_id: clientId, service_id: serviceId, user }, ASK_TIMEOUT_MS);
  const value = reply.status === 200 ? ask.parse(reply.body) : null;
  recordLastDelivery(installation._id, value ? { ok: true } : { ok: false, error: reply.error ?? `HTTP ${reply.status}` });
  if (value) return { ok: true, value };
  logUnanswered(ask.label, reply);
  return { ok: false, message: ask.failed, fallbackUrl };
}

const FILES: ServiceAsk<ServiceFiles> = { event: 'client.files.requested', parse: serviceFilesOf, failed: DRIVE_FAILED, label: 'Drive del servicio' };
const DETAIL: ServiceAsk<ServiceDetail> = { event: 'client.service.requested', parse: serviceDetailOf, failed: DETAIL_FAILED, label: 'Detalle del servicio' };

/** The Drive of a client's service (pending 121, agentes c27e939). */
export async function clientServiceFiles(workspaceId: string, clientId: string, serviceId: string, userId: Types.ObjectId): Promise<FilesOutcome | NotFound> {
  const outcome = await askAboutService(FILES, workspaceId, clientId, serviceId, userId);
  if ('error' in outcome) return outcome;
  return outcome.ok ? { ok: true, files: outcome.value } : outcome;
}

/** Its pedidos, despachos and informes (José, 30/10; agentes 77e7782, Portal 1d4072d5). */
export const clientServiceDetail = (workspaceId: string, clientId: string, serviceId: string, userId: Types.ObjectId) => askAboutService(DETAIL, workspaceId, clientId, serviceId, userId);
