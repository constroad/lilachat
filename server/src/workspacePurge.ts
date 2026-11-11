import type { Model, Types } from 'mongoose';
import { ChatModel, MessageModel, ReceiptModel } from './chatModels.js';
import { ChecklistModel } from './checklistModel.js';
import { DestacadoModel } from './destacadoModel.js';
import { EventModel, PollModel, ReminderModel } from './eventModels.js';
import { ScheduledMessageModel } from './scheduledMessages.js';
import { AutoReplyStateModel } from './autoReply.js';
import { CustomEmojiModel } from './customEmojiModel.js';
import { UserModel } from './models.js';
import { WorkspaceEmailInviteModel, WorkspaceMemberModel, WorkspaceModel } from './workspaceModels.js';
import { BotCommandRunModel, BotDeliveryModel, BotInstallationModel, OAuthCodeModel } from './bots/botModels.js';
import { ClientChannelModel } from './bots/botClients.js';
import { ReportDraftModel } from './bots/clientReports.js';
import { AppScheduleModel } from './bots/scheduleModels.js';

/**
 * Deleted spaces are erased for real after a while (José 11/11). Until then
 * the owner's mistake can be undone by hand (`workspaceDelete.ts`). Files on
 * disk stay, as with «Eliminar para todos»: thumbnails are named by content and
 * can be shared with chats of other spaces.
 */
export const PURGE_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A few spaces per pass: each one is several deletes. */
const SPACES_PER_PASS = 5;
const PURGE_EVERY_MS = 6 * 60 * 60 * 1000;

type AnyModel = Model<never>;
const CHAT_SCOPED: AnyModel[] = [MessageModel, ReceiptModel, ChecklistModel, DestacadoModel, EventModel, ReminderModel, PollModel, ScheduledMessageModel, AutoReplyStateModel].map((model) => model as unknown as AnyModel);
const SPACE_SCOPED: AnyModel[] = [WorkspaceMemberModel, WorkspaceEmailInviteModel, CustomEmojiModel, OAuthCodeModel, BotCommandRunModel, ClientChannelModel, ReportDraftModel, AppScheduleModel].map((model) => model as unknown as AnyModel);

/**
 * `deleteMany` with a field the schema lacks could match every document if the
 * filter lost it: each delete checks the path exists first.
 */
function deleteBy(model: AnyModel, field: string, value: unknown) {
  if (!model.schema.path(field)) throw new Error(`purge: ${model.modelName} has no ${field}`);
  return model.deleteMany({ [field]: value } as never);
}

/** One space, in an order a crash can resume: its chats' content, then the space's rows, then the space. */
export async function purgeWorkspace(workspaceId: Types.ObjectId): Promise<void> {
  // Only a space its owner deleted: a live one is never emptied by mistake.
  if (!(await WorkspaceModel.exists({ _id: workspaceId, deletedAt: { $exists: true } }))) throw new Error('purge: that space is not deleted');
  const [chats, installations] = await Promise.all([
    ChatModel.find({ workspaceId }).select('_id').lean<{ _id: Types.ObjectId }[]>(),
    BotInstallationModel.find({ workspaceId }).select('_id').lean<{ _id: Types.ObjectId }[]>(),
  ]);
  const chatIds = { $in: chats.map((chat) => chat._id) };
  await Promise.all([
    ...CHAT_SCOPED.map((model) => deleteBy(model, 'chatId', chatIds)),
    deleteBy(BotDeliveryModel as unknown as AnyModel, 'installationId', { $in: installations.map((installation) => installation._id) }),
    // The space's app bots are users of this space only.
    deleteBy(UserModel as unknown as AnyModel, 'app.workspaceId', workspaceId),
  ]);
  await Promise.all(SPACE_SCOPED.map((model) => deleteBy(model, 'workspaceId', workspaceId)));
  await Promise.all([deleteBy(ChatModel as unknown as AnyModel, 'workspaceId', workspaceId), deleteBy(BotInstallationModel as unknown as AnyModel, 'workspaceId', workspaceId)]);
  await WorkspaceModel.deleteOne({ _id: workspaceId, deletedAt: { $exists: true } });
}

/** One pass: the spaces deleted more than `PURGE_AFTER_DAYS` ago. Returns how many went. */
export async function purgeDeletedWorkspaces(now: Date = new Date()): Promise<number> {
  const before = new Date(now.getTime() - PURGE_AFTER_DAYS * DAY_MS);
  const due = await WorkspaceModel.find({ deletedAt: { $lte: before } }).select('_id').limit(SPACES_PER_PASS).lean<{ _id: Types.ObjectId }[]>();
  await Promise.all(due.map((space) => purgeWorkspace(space._id)));
  return due.length;
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Inside the server, like the other sweeps; a few hours late is fine for a 30-day clock. */
export function startWorkspacePurgeCron(): void {
  if (timer) return;
  const tick = () => void purgeDeletedWorkspaces().catch((error) => console.error('[cron] purga de espacios:', error instanceof Error ? error.message : error));
  timer = setInterval(tick, PURGE_EVERY_MS);
  tick();
}
