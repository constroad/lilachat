import { Types } from 'mongoose';
import { CLIENT_ID, serviceFilesOf, type ServiceFiles } from '@lilachat/shared';
import { ChatModel } from '../chatModels.js';
import { UserModel } from '../models.js';
import { actorIn } from '../workspaces.js';
import { ClientChannelModel, type ClientChannel } from './botClients.js';
import { callBotWebhook, recordLastDelivery } from './botEvents.js';
import { BotAppModel, BotInstallationModel } from './botModels.js';

/** agentes answers within 7 s (its contract); this waits a little longer so its own 502 arrives first. */
const FILES_TIMEOUT_MS = 8_000;
export const DRIVE_FAILED = 'No se pudo traer el Drive';

type FilesError = { status: 404; error: string; message: string };
export type FilesOutcome = { ok: true; files: ServiceFiles } | { ok: false; message: string; fallbackUrl: string | null };

const notFound = (): FilesError => ({ status: 404, error: 'service_not_found', message: 'Ese servicio no existe o no estás en el canal del cliente.' });

/**
 * The Drive of a client's service, on demand (pending 121, agentes c27e939):
 * a signed `client.files.requested` to the app that owns the client, answered
 * in the same request. Only a member of the client's PRIVATE channel asks,
 * and only for a service the app listed in its last PUT (Portal only checks
 * the company). Nothing is stored: the links never expire, so they only show
 * inside that channel.
 */
export async function clientServiceFiles(workspaceId: string, clientId: string, serviceId: string, userId: Types.ObjectId): Promise<FilesOutcome | FilesError> {
  await actorIn(workspaceId, userId);
  if (!CLIENT_ID.test(clientId) || !CLIENT_ID.test(serviceId)) return notFound();
  const client = await ClientChannelModel.findOne({ workspaceId: new Types.ObjectId(workspaceId), clientId }).select('appId chatId driveUrl services').lean<Pick<ClientChannel, 'appId' | 'chatId' | 'driveUrl' | 'services'> | null>();
  const service = client?.services.find((one) => one.id === serviceId);
  if (!client || !service || !(await ChatModel.exists({ _id: client.chatId, 'members.userId': userId }))) return notFound();
  const fallbackUrl = service.url ?? client.driveUrl ?? null;
  const [installation, app, user] = await Promise.all([
    BotInstallationModel.findOne({ appId: client.appId, workspaceId: new Types.ObjectId(workspaceId), revokedAt: { $exists: false } }).lean(),
    BotAppModel.findById(client.appId).select('webhookUrl').lean(),
    UserModel.findById(userId).select('name phone').lean(),
  ]);
  if (!installation || !app?.webhookUrl) return { ok: false, message: DRIVE_FAILED, fallbackUrl };
  const reply = await callBotWebhook({ ...installation, webhookUrl: app.webhookUrl }, 'client.files.requested', { client_id: clientId, service_id: serviceId, user: { id: String(userId), ...(user?.name ? { name: user.name } : {}), ...(user?.phone ? { phone: user.phone } : {}) } }, FILES_TIMEOUT_MS);
  const files = reply.status === 200 ? serviceFilesOf(reply.body) : null;
  if (files) {
    recordLastDelivery(installation._id, { ok: true });
    return { ok: true, files };
  }
  // The person sees one screen; the log keeps agentes' code (product_failed, not-configured, invalid-input).
  const code = (reply.body as { code?: unknown } | null)?.code;
  console.warn('[clientes] Drive del servicio sin respuesta:', reply.status ?? reply.error, typeof code === 'string' ? code : '');
  recordLastDelivery(installation._id, { ok: false, error: reply.error ?? `HTTP ${reply.status}` });
  return { ok: false, message: DRIVE_FAILED, fallbackUrl };
}
