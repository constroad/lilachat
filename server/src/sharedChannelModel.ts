import { Schema, Types, model } from 'mongoose';
import type { ShareStatus } from '@lilachat/shared';

/** A channel of one space shared with another (José 11/11, like Slack Connect). The service is `sharedChannels.ts`. */
export type SharedChannel = {
  _id: Types.ObjectId;
  chatId: Types.ObjectId;
  ownerWorkspaceId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  status: ShareStatus;
  invitedBy: Types.ObjectId;
  acceptedBy?: Types.ObjectId;
  removedBy?: Types.ObjectId;
};

const sharedChannelSchema = new Schema<SharedChannel>(
  {
    chatId: { type: Schema.Types.ObjectId, required: true },
    ownerWorkspaceId: { type: Schema.Types.ObjectId, required: true },
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, enum: ['pending', 'active', 'removed'], required: true },
    invitedBy: { type: Schema.Types.ObjectId, required: true },
    acceptedBy: { type: Schema.Types.ObjectId },
    removedBy: { type: Schema.Types.ObjectId },
  },
  { timestamps: true }
);
sharedChannelSchema.index({ chatId: 1, workspaceId: 1 }, { unique: true });
sharedChannelSchema.index({ workspaceId: 1, status: 1 });
/** The shares a space gives out, read when someone leaves it or is deactivated there (12/11). */
sharedChannelSchema.index({ ownerWorkspaceId: 1, status: 1 });
export const SharedChannelModel = model<SharedChannel>('SharedChannel', sharedChannelSchema);
