import mongoose, { Schema, type Model, type Types } from 'mongoose';
import type { JoinPolicy, WorkspaceMemberStatus, WorkspaceRole } from '@lilachat/shared';

/**
 * Company spaces (E1, spec §66). A person keeps ONE account (their phone) and
 * joins spaces; the company never sees anything personal.
 *
 * Indexes are declared here and created by hand in the vault (no `autoIndex`,
 * memory `boveda-no-autoindex`): `scripts/workspace-indexes.mts`.
 */
export type Workspace = {
  _id: Types.ObjectId;
  name: string;
  rubro?: string;
  logoUrl?: string;
  ownerId: Types.ObjectId;
  joinCode: string;
  joinPolicy: JoinPolicy;
  /** Its #general (José, 22/10): every active member is in it and «X se unió al espacio» lands there (`workspaceGeneral.ts`). */
  generalChatId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * A company invites by email (José, 22/10): the person keeps their one account
 * (phone) and becomes a member when they VERIFY that email in their profile
 * (`workspaceEmailInvites.ts`). Until then this row is the invitation.
 */
export type WorkspaceEmailInvite = {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  email: string;
  title?: string;
  area?: string;
  addedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * A person in a space. `invited` = added by phone before having an account:
 * `userId` arrives when that phone signs up (`claimPhoneInvites`).
 */
export type WorkspaceMember = {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  userId?: Types.ObjectId;
  phone: string;
  role: WorkspaceRole;
  status: WorkspaceMemberStatus;
  title?: string;
  area?: string;
  addedBy?: Types.ObjectId;
  joinedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const workspaceSchema = new Schema<Workspace>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    rubro: { type: String, trim: true, maxlength: 40 },
    logoUrl: { type: String },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    joinCode: { type: String, required: true },
    joinPolicy: { type: String, enum: ['open', 'approval'], default: 'approval' },
    generalChatId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true }
);
workspaceSchema.index({ joinCode: 1 }, { unique: true });

const memberSchema = new Schema<WorkspaceMember>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId },
    phone: { type: String, required: true },
    role: { type: String, enum: ['owner', 'admin', 'member', 'guest'], default: 'member' },
    status: { type: String, enum: ['active', 'pending', 'invited', 'deactivated'], required: true },
    title: { type: String, trim: true, maxlength: 60 },
    area: { type: String, trim: true, maxlength: 40 },
    addedBy: { type: Schema.Types.ObjectId },
    joinedAt: { type: Date },
  },
  { timestamps: true }
);
memberSchema.index({ workspaceId: 1, phone: 1 }, { unique: true });
memberSchema.index({ userId: 1, status: 1 });
memberSchema.index({ phone: 1, status: 1 });
memberSchema.index({ workspaceId: 1, status: 1 });

const emailInviteSchema = new Schema<WorkspaceEmailInvite>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    title: { type: String, trim: true, maxlength: 60 },
    area: { type: String, trim: true, maxlength: 40 },
    addedBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);
emailInviteSchema.index({ workspaceId: 1, email: 1 }, { unique: true });
emailInviteSchema.index({ email: 1 });

export const WorkspaceModel: Model<Workspace> =
  (mongoose.models.Workspace as Model<Workspace>) ?? mongoose.model<Workspace>('Workspace', workspaceSchema);
export const WorkspaceMemberModel: Model<WorkspaceMember> =
  (mongoose.models.WorkspaceMember as Model<WorkspaceMember>) ?? mongoose.model<WorkspaceMember>('WorkspaceMember', memberSchema);
export const WorkspaceEmailInviteModel: Model<WorkspaceEmailInvite> =
  (mongoose.models.WorkspaceEmailInvite as Model<WorkspaceEmailInvite>) ?? mongoose.model<WorkspaceEmailInvite>('WorkspaceEmailInvite', emailInviteSchema);
