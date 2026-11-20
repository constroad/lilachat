import mongoose, { Types, type Model } from 'mongoose';
import { CLIENT_ID, unloadOrderOf, type FieldDocument } from '@lilachat/shared';
import type { CommandError } from './botCommands.js';
import { findAskedService, notFound } from './clientFiles.js';

/**
 * The unloading order of a control de pista (José 20/11, spec INFORMES-DESDE-LILACHAT §25): the
 * person decides in the field which truck unloads next. Portal keeps no such field and adding one
 * to its tools would make José approve them again, so Lilachat keeps it, one per report, shared by
 * every device of the channel. The placement number stays Portal's: a unit closes only after the
 * one before it in this order left, so both agree.
 */
const UNIT_REPORT_TYPE = 'CTL-PIS';
/** A finished pedido is not reordered after a month: the row goes by itself. */
const KEPT_S = 30 * 24 * 60 * 60;

type UnloadOrder = { _id: Types.ObjectId; workspaceId: Types.ObjectId; serviceId: string; reportId: string; order: string[]; updatedBy: Types.ObjectId; updatedAt: Date };
const unloadOrderSchema = new mongoose.Schema<UnloadOrder>(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    serviceId: { type: String, required: true },
    reportId: { type: String, required: true },
    order: { type: [String], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);
unloadOrderSchema.index({ workspaceId: 1, serviceId: 1, reportId: 1 }, { unique: true });
unloadOrderSchema.index({ updatedAt: 1 }, { expireAfterSeconds: KEPT_S });
export const UnloadOrderModel: Model<UnloadOrder> = (mongoose.models.UnloadOrder as Model<UnloadOrder>) ?? mongoose.model<UnloadOrder>('UnloadOrder', unloadOrderSchema);

const fail = (status: CommandError['status'], error: string, message: string): CommandError => ({ status, error, message });

/** «Siguiente ↑» or a drag: any member of the client's channel who fills the report sets it. */
export async function saveUnloadOrder(workspaceId: string, clientId: string, serviceId: string, reportId: string, userId: Types.ObjectId, body: unknown): Promise<{ order: string[] } | CommandError> {
  const order = unloadOrderOf((body as { order?: unknown } | null)?.order);
  if (!CLIENT_ID.test(reportId) || !order) return fail(400, 'invalid_request', 'El orden de descarga no es válido.');
  if (!(await findAskedService(workspaceId, clientId, serviceId, userId, 'services'))) return notFound();
  // The service checked at the door is part of the key: a member of one client never reorders another's report.
  await UnloadOrderModel.updateOne({ workspaceId: new Types.ObjectId(workspaceId), serviceId, reportId }, { $set: { order, updatedBy: userId } }, { upsert: true });
  return { order };
}

/** The document Portal answered, with the order kept here; any other report goes as it came. */
export async function withUnloadOrder<T>(workspaceId: string, serviceId: string, document: T): Promise<T> {
  const report = document as Partial<FieldDocument> | null;
  if (report?.type !== UNIT_REPORT_TYPE || !report.id) return document;
  const kept = await UnloadOrderModel.findOne({ workspaceId: new Types.ObjectId(workspaceId), serviceId, reportId: report.id }).select('order').lean();
  return kept?.order.length ? ({ ...report, unloadOrder: kept.order } as T) : document;
}
