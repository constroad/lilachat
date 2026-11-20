import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { REPORT_REASONS, type ReportPriority, type ReportReason, type ReportStatus, type ReportTarget } from '@lilachat/shared';

/**
 * A report of a person or a message (Google Play, José 19/11/2026). The
 * evidence is a COPY taken when it was reported: deleting the message later
 * (or the disappearing sweep) must not erase what the superadmin reviews.
 */
export interface Report {
  _id: Types.ObjectId;
  reporterId: Types.ObjectId;
  target: ReportTarget;
  reportedUserId: Types.ObjectId;
  chatId?: Types.ObjectId;
  workspaceId?: Types.ObjectId;
  reason: ReportReason;
  note: string;
  priority: ReportPriority;
  status: ReportStatus;
  alsoBlocked: boolean;
  evidence?: { seq: number; senderId: Types.ObjectId; kind: string; body?: string; mediaIds: string[]; sentAt: Date; encrypted: boolean };
  closedAt?: Date;
  closedBy?: Types.ObjectId;
  closedNote?: string;
  createdAt: Date;
}

const evidenceSchema = new Schema(
  {
    seq: { type: Number, required: true },
    senderId: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, required: true },
    body: { type: String },
    mediaIds: { type: [String], default: [] },
    sentAt: { type: Date, required: true },
    encrypted: { type: Boolean, default: false },
  },
  { _id: false }
);

const reportSchema = new Schema<Report>(
  {
    reporterId: { type: Schema.Types.ObjectId, required: true },
    target: { type: String, enum: ['user', 'message'], required: true },
    reportedUserId: { type: Schema.Types.ObjectId, required: true },
    chatId: { type: Schema.Types.ObjectId },
    workspaceId: { type: Schema.Types.ObjectId },
    reason: { type: String, enum: REPORT_REASONS.map((reason) => reason.id), required: true },
    note: { type: String, default: '' },
    priority: { type: String, enum: ['high', 'normal'], required: true },
    status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open' },
    alsoBlocked: { type: Boolean, default: false },
    evidence: { type: evidenceSchema },
    closedAt: { type: Date },
    closedBy: { type: Schema.Types.ObjectId },
    closedNote: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// The queue: open first, urgent on top, newest first.
reportSchema.index({ status: 1, priority: 1, createdAt: -1 });
// The anti-abuse count and the «already reported» check of one reporter.
reportSchema.index({ reporterId: 1, createdAt: -1 });

export const ReportModel: Model<Report> = (mongoose.models.Report as Model<Report>) ?? mongoose.model<Report>('Report', reportSchema);
