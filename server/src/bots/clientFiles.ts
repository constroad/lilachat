import { Types } from 'mongoose';
import { canManageMembers, canSeeDrive, canSeeTab, CLIENT_ID, isFieldReport, clientAccountOf, REPORT_PDF_FAILED, reportPdfOf, serviceDetailOf, serviceFilesOf, type ClientAccount, type MyClientAccess, type RestrictableTab, type ReportPdf, type ServiceDetail, type ServiceFiles, type ServiceOrder } from '@lilachat/shared';
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
export const BILLING_FAILED = 'No se pudo traer la cobranza del servicio';
const SERVICE_GONE = 'Este servicio ya no está en el Portal.';

export type NotFound = { status: 404; error: string; message: string };
export type AskOutcome<T> = { ok: true; value: T } | { ok: false; message: string; fallbackUrl: string | null };
export type FilesOutcome = { ok: true; files: ServiceFiles } | { ok: false; message: string; fallbackUrl: string | null };

export const notFound = (): NotFound => ({ status: 404, error: 'service_not_found', message: 'Ese servicio no existe o no estás en el canal del cliente.' });

/** What the question needs from the member's access (José 30/10 night): a tab, seeing money, or Portal's Drive (José 05/11). */
/** `admin`: a space admin, the only one who registers the progress of the work for now (design o-07). */
type Need = RestrictableTab | 'money' | 'drive' | 'admin';
/** `gone`: what it says when Portal no longer has it (agentes 6fc3ca5: 404 `not-found`), without a link that would 404 too. */
export type { Need };
export type ServiceAsk<T> = { event: Extract<BotEventType, `client.${string}.requested`>; parse: (body: unknown) => T | null; failed: string; gone: string; label: string; need: Need; scrub?: (value: T, seesMoney: boolean) => T };

export type AskedService = { client: Pick<ClientChannel, 'appId' | 'chatId' | 'driveUrl' | 'services'>; fallbackUrl: string | null; seesBilling: boolean };
type Asker = { id: string; name?: string; phone?: string; sees_billing?: true };

function meets(access: MyClientAccess, need: Need): boolean {
  if (need === 'admin') return access.admin === true;
  if (need === 'money') return access.money;
  return need === 'drive' ? canSeeDrive(access) : canSeeTab(access, need);
}

/**
 * The client (and, when asked, its service), only for a member of the client's PRIVATE channel and only if the app
 * listed that service in its last PUT (Portal only checks the company). `serviceId` null asks about the whole client.
 */
export async function findAskedService(workspaceId: string, clientId: string, serviceId: string | null, userId: Types.ObjectId, need: Need): Promise<AskedService | null> {
  const actor = await actorIn(workspaceId, userId);
  if (!CLIENT_ID.test(clientId) || (serviceId !== null && !CLIENT_ID.test(serviceId))) return null;
  const client = await ClientChannelModel.findOne({ workspaceId: new Types.ObjectId(workspaceId), clientId }).select('appId chatId driveUrl services restrictedMembers').lean<(AskedService['client'] & Pick<ClientChannel, 'restrictedMembers'>) | null>();
  const service = serviceId === null ? null : client?.services.find((one) => one.id === serviceId);
  if (!client || service === undefined || !(await ChatModel.exists({ _id: client.chatId, 'members.userId': userId }))) return null;
  // José 07/11: money only for the space's admins; Portal widens `billing` with it.
  const access = accessOf(client, userId, canManageMembers(actor.role));
  if (!meets(access, need)) return null;
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

const isGone = (reply: { status?: number | null; body?: unknown }): boolean => reply.status === 404 && (reply.body as { code?: unknown } | null)?.code === 'not-found';

/**
 * Asks the app that owns a client about one of its services, answered in the
 * same request (pending 121 Drive; José 30/10 detail). Nothing is stored: the
 * links never expire, so they only show inside that channel.
 */
export async function askAboutService<T>(ask: ServiceAsk<T>, workspaceId: string, clientId: string, serviceId: string | null, userId: Types.ObjectId, extra: Record<string, string | number> = {}): Promise<AskOutcome<T> | NotFound> {
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
  if (isGone(reply)) return { ok: false, message: ask.gone, fallbackUrl: null };
  logUnanswered(ask.label, reply);
  return { ok: false, message: ask.failed, fallbackUrl };
}

/** An order's invoice, price, credit and payments (José 05/11): the invoice's PDF carries the amounts. */
function orderWithoutMoney(order: ServiceOrder): ServiceOrder {
  const { invoice: _invoice, invoiceUrl: _invoiceUrl, unitPrice: _unitPrice, total: _total, isCredit: _isCredit, dueAt: _dueAt, payments: _payments, ...rest } = order;
  return rest;
}

/**
 * José 30/10 night, 05/11: quotes, collection, invoices and all but the field reports only for whoever sees money, whatever Portal decided to send.
 * The units of the Control de pista stay: everyone confirms the progress they suggest (José 07/11: «todos pueden crear y actualizar»).
 */
function withoutMoney(detail: ServiceDetail, seesMoney: boolean): ServiceDetail {
  if (seesMoney) return detail;
  const { quotes: _quotes, billing: _billing, totals, ...rest } = detail;
  const { quotes: _count, ...counts } = totals;
  const reports = detail.reports.filter(isFieldReport);
  return { ...rest, orders: detail.orders.map(orderWithoutMoney), reports, totals: { ...counts, reports: counts.reports - (detail.reports.length - reports.length) } };
}

const FILES: ServiceAsk<ServiceFiles> = { event: 'client.files.requested', parse: serviceFilesOf, failed: DRIVE_FAILED, gone: SERVICE_GONE, label: 'Drive del servicio', need: 'drive' };
const DETAIL: ServiceAsk<ServiceDetail> = { event: 'client.service.requested', parse: serviceDetailOf, failed: DETAIL_FAILED, gone: SERVICE_GONE, label: 'Detalle del servicio', need: 'services', scrub: withoutMoney };
/** «Cobranza» opens from «Cuenta» (José 05/11): the same question, only for whoever sees money, even without «Servicios». */
const BILLING: ServiceAsk<ServiceDetail> = { ...DETAIL, failed: BILLING_FAILED, label: 'Cobranza del servicio', need: 'money' };
const ACCOUNT: ServiceAsk<ClientAccount> = { event: 'client.account.requested', parse: clientAccountOf, failed: ACCOUNT_FAILED, gone: 'Este cliente ya no está en el Portal.', label: 'Cuenta del cliente', need: 'money' };
const REPORT_PDF: ServiceAsk<ReportPdf> = { event: 'client.report.requested', parse: reportPdfOf, failed: REPORT_PDF_FAILED, gone: 'Este informe ya no está en el Portal.', label: 'PDF del informe', need: 'services' };

/** The Drive of a client's service (pending 121, agentes c27e939). */
export async function clientServiceFiles(workspaceId: string, clientId: string, serviceId: string, userId: Types.ObjectId): Promise<FilesOutcome | NotFound> {
  const outcome = await askAboutService(FILES, workspaceId, clientId, serviceId, userId);
  if ('error' in outcome) return outcome;
  return outcome.ok ? { ok: true, files: outcome.value } : outcome;
}

/** Its pedidos, despachos and informes (José, 30/10; agentes 77e7782, Portal 1d4072d5). */
export const clientServiceDetail = (workspaceId: string, clientId: string, serviceId: string, userId: Types.ObjectId) => askAboutService(DETAIL, workspaceId, clientId, serviceId, userId);

/** A service's collection, from «Cuenta» (José 05/11). */
export const clientServiceBilling = (workspaceId: string, clientId: string, serviceId: string, userId: Types.ObjectId) => askAboutService(BILLING, workspaceId, clientId, serviceId, userId);

/** All the client's quotes and its orders on credit (José 30/10, design f-08; agentes cf37b98, Portal 0227a1f0). */
export const clientAccount = (workspaceId: string, clientId: string, userId: Types.ObjectId) => askAboutService(ACCOUNT, workspaceId, clientId, null, userId);

/** A report's PDF: ready, or still generating with how long to wait (agentes 30/10, Portal 588e3ff9). The app or the web asks again. */
export async function clientReportPdf(workspaceId: string, clientId: string, serviceId: string, reportId: string, userId: Types.ObjectId): Promise<AskOutcome<ReportPdf> | NotFound> {
  if (!CLIENT_ID.test(reportId)) return notFound();
  return askAboutService(REPORT_PDF, workspaceId, clientId, serviceId, userId, { report_id: reportId });
}
