import { Types } from 'mongoose';
import { canManageMembers, canSeeTab, CLIENT_ID, clientAccountOf, REPORT_PDF_FAILED, reportPdfOf, serviceDetailOf, serviceFilesOf, type ClientAccount, type RestrictableTab, type ReportPdf, type ServiceDetail, type ServiceFiles } from '@lilachat/shared';
import { ChatModel } from '../chatModels.js';
import { UserModel } from '../models.js';
import { actorIn } from '../workspaces.js';
import { accessOf } from '../stageAccess.js';
import { ClientChannelModel, type ClientChannel } from './botClients.js';
import { callBotWebhook, recordLastDelivery, type BotEventType } from './botEvents.js';
import { BotAppModel, BotInstallationModel } from './botModels.js';

/** agentes answers within 7 s (its contract); this waits a little longer so its own 502 arrives first. */
const ASK_TIMEOUT_MS = 8_000;
export const DRIVE_FAILED = 'No se pudo traer el Drive';
export const DETAIL_FAILED = 'No se pudo traer el detalle del servicio';
export const ACCOUNT_FAILED = 'No se pudo traer la cuenta del cliente';

type NotFound = { status: 404; error: string; message: string };
export type AskOutcome<T> = { ok: true; value: T } | { ok: false; message: string; fallbackUrl: string | null };
export type FilesOutcome = { ok: true; files: ServiceFiles } | { ok: false; message: string; fallbackUrl: string | null };

const notFound = (): NotFound => ({ status: 404, error: 'service_not_found', message: 'Ese servicio no existe o no estás en el canal del cliente.' });

/** What the question needs from the member's access (José 30/10 night): a tab, or seeing money. */
type Need = RestrictableTab | 'money';
type ServiceAsk<T> = { event: Extract<BotEventType, `client.${string}.requested`>; parse: (body: unknown) => T | null; failed: string; label: string; need: Need; scrub?: (value: T, seesMoney: boolean) => T };

type AskedService = { client: Pick<ClientChannel, 'appId' | 'chatId' | 'driveUrl' | 'services'>; fallbackUrl: string | null; seesBilling: boolean };
type Asker = { id: string; name?: string; phone?: string; sees_billing?: true };

/**
 * The client (and, when asked, its service), only for a member of the client's PRIVATE channel and only if the app
 * listed that service in its last PUT (Portal only checks the company). `serviceId` null asks about the whole client.
 */
async function findAskedService(workspaceId: string, clientId: string, serviceId: string | null, userId: Types.ObjectId, need: Need): Promise<AskedService | null> {
  const actor = await actorIn(workspaceId, userId);
  if (!CLIENT_ID.test(clientId) || (serviceId !== null && !CLIENT_ID.test(serviceId))) return null;
  const client = await ClientChannelModel.findOne({ workspaceId: new Types.ObjectId(workspaceId), clientId }).select('appId chatId driveUrl services billingViewers restrictedMembers').lean<(AskedService['client'] & Pick<ClientChannel, 'billingViewers' | 'restrictedMembers'>) | null>();
  const service = serviceId === null ? null : client?.services.find((one) => one.id === serviceId);
  if (!client || service === undefined || !(await ChatModel.exists({ _id: client.chatId, 'members.userId': userId }))) return null;
  // José 30/10: the space's admins, plus whoever an admin marked in THIS channel; Portal widens `billing` with it.
  const access = accessOf(client, userId, canManageMembers(actor.role));
  if (need === 'money' ? !access.money : !canSeeTab(access, need)) return null;
  return { client, fallbackUrl: service?.url ?? client.driveUrl ?? null, seesBilling: access.money };
}

async function askerOf(userId: Types.ObjectId, seesBilling: boolean): Promise<Asker> {
  const user = await UserModel.findById(userId).select('name phone').lean();
  return { id: String(userId), ...(user?.name ? { name: user.name } : {}), ...(user?.phone ? { phone: user.phone } : {}), ...(seesBilling ? { sees_billing: true as const } : {}) };
}

/** The person sees one screen; the log keeps agentes' code (product_failed, not-configured, invalid-input). */
function logUnanswered(label: string, reply: { status?: number | null; error?: string; body?: unknown }): void {
  const code = (reply.body as { code?: unknown } | null)?.code;
  console.warn(`[clientes] ${label} sin respuesta:`, reply.status ?? reply.error, typeof code === 'string' ? code : '');
}

/**
 * Asks the app that owns a client about one of its services, answered in the
 * same request (pending 121 Drive; José 30/10 detail). Nothing is stored: the
 * links never expire, so they only show inside that channel.
 */
async function askAboutService<T>(ask: ServiceAsk<T>, workspaceId: string, clientId: string, serviceId: string | null, userId: Types.ObjectId, extra: Record<string, string> = {}): Promise<AskOutcome<T> | NotFound> {
  const asked = await findAskedService(workspaceId, clientId, serviceId, userId, ask.need);
  if (!asked) return notFound();
  const { client, fallbackUrl, seesBilling } = asked;
  const [installation, app, user] = await Promise.all([
    BotInstallationModel.findOne({ appId: client.appId, workspaceId: new Types.ObjectId(workspaceId), revokedAt: { $exists: false } }).lean(),
    BotAppModel.findById(client.appId).select('webhookUrl').lean(),
    askerOf(userId, seesBilling),
  ]);
  if (!installation || !app?.webhookUrl) return { ok: false, message: ask.failed, fallbackUrl };
  const reply = await callBotWebhook({ ...installation, webhookUrl: app.webhookUrl }, ask.event, { client_id: clientId, ...(serviceId ? { service_id: serviceId } : {}), ...extra, user }, ASK_TIMEOUT_MS);
  const value = reply.status === 200 ? ask.parse(reply.body) : null;
  recordLastDelivery(installation._id, value ? { ok: true } : { ok: false, error: reply.error ?? `HTTP ${reply.status}` });
  if (value) return { ok: true, value: ask.scrub ? ask.scrub(value, seesBilling) : value };
  logUnanswered(ask.label, reply);
  return { ok: false, message: ask.failed, fallbackUrl };
}

/** José 30/10 night: quotes, collection and valuations only for whoever sees money, whatever Portal decided to send. */
function withoutMoney(detail: ServiceDetail, seesMoney: boolean): ServiceDetail {
  if (seesMoney) return detail;
  const { quotes: _quotes, billing: _billing, valuations: _valuations, valuationsUrl: _valuationsUrl, totals, ...rest } = detail;
  const { quotes: _count, valuations: _valuationCount, ...counts } = totals;
  return { ...rest, totals: counts };
}

const FILES: ServiceAsk<ServiceFiles> = { event: 'client.files.requested', parse: serviceFilesOf, failed: DRIVE_FAILED, label: 'Drive del servicio', need: 'files' };
const DETAIL: ServiceAsk<ServiceDetail> = { event: 'client.service.requested', parse: serviceDetailOf, failed: DETAIL_FAILED, label: 'Detalle del servicio', need: 'services', scrub: withoutMoney };
const ACCOUNT: ServiceAsk<ClientAccount> = { event: 'client.account.requested', parse: clientAccountOf, failed: ACCOUNT_FAILED, label: 'Cuenta del cliente', need: 'money' };
const REPORT_PDF: ServiceAsk<ReportPdf> = { event: 'client.report.requested', parse: reportPdfOf, failed: REPORT_PDF_FAILED, label: 'PDF del informe', need: 'services' };

/** The Drive of a client's service (pending 121, agentes c27e939). */
export async function clientServiceFiles(workspaceId: string, clientId: string, serviceId: string, userId: Types.ObjectId): Promise<FilesOutcome | NotFound> {
  const outcome = await askAboutService(FILES, workspaceId, clientId, serviceId, userId);
  if ('error' in outcome) return outcome;
  return outcome.ok ? { ok: true, files: outcome.value } : outcome;
}

/** Its pedidos, despachos and informes (José, 30/10; agentes 77e7782, Portal 1d4072d5). */
export const clientServiceDetail = (workspaceId: string, clientId: string, serviceId: string, userId: Types.ObjectId) => askAboutService(DETAIL, workspaceId, clientId, serviceId, userId);

/** All the client's quotes and its orders on credit (José 30/10, design f-08; agentes cf37b98, Portal 0227a1f0). */
export const clientAccount = (workspaceId: string, clientId: string, userId: Types.ObjectId) => askAboutService(ACCOUNT, workspaceId, clientId, null, userId);

/** A report's PDF: ready, or still generating with how long to wait (agentes 30/10, Portal 588e3ff9). The app or the web asks again. */
export async function clientReportPdf(workspaceId: string, clientId: string, serviceId: string, reportId: string, userId: Types.ObjectId): Promise<AskOutcome<ReportPdf> | NotFound> {
  if (!CLIENT_ID.test(reportId)) return notFound();
  return askAboutService(REPORT_PDF, workspaceId, clientId, serviceId, userId, { report_id: reportId });
}
