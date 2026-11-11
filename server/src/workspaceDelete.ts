import type { Types } from 'mongoose';
import { canDeleteSpace, confirmsSpaceName, toInternationalPhone } from '@lilachat/shared';
import { ChatModel } from './chatModels.js';
import { UserModel } from './models.js';
import { WorkspaceModel, type Workspace } from './workspaceModels.js';
import { activeIdsOf, actorIn, WorkspaceError } from './workspaces.js';
import { noticeSpacesChanged } from './workspaceNotices.js';
import { BotInstallationModel, type BotInstallation } from './bots/botModels.js';
import { revokeInstallation } from './bots/botInstall.js';
import { sendBotEvent } from './bots/botEvents.js';

/**
 * Deleting a space (José 10/11: «no es posible eliminar un espacio»). Only its
 * owner, typing its name. Nothing is erased: the space is marked, every chat
 * keeps its members aside in `deletedWithSpace` (like a deleted channel keeps
 * them in `deletedChannel`) and its apps are uninstalled, so it can be brought
 * back by hand. For everyone else it is gone at once.
 */
export async function deleteWorkspace(workspaceId: string, actorId: Types.ObjectId, input: { confirmName?: unknown }): Promise<void> {
  const actor = await actorIn(workspaceId, actorId);
  if (!canDeleteSpace(actor.role)) throw new WorkspaceError(403, 'Solo el dueño del espacio puede eliminarlo.');
  const space = await WorkspaceModel.findById(actor.workspaceId).select('name').lean<Pick<Workspace, '_id' | 'name'> | null>();
  if (!space) throw new WorkspaceError(404, 'Ese espacio no existe.');
  if (!confirmsSpaceName(input.confirmName, space.name)) throw new WorkspaceError(400, 'Escribe el nombre del espacio tal como está para confirmar.');
  const members = await activeIdsOf(space._id);
  const at = new Date();
  await WorkspaceModel.updateOne({ _id: space._id }, { $set: { deletedAt: at, deletedBy: actorId } });
  // Native driver: an update pipeline copies each chat's own members aside in one statement.
  await ChatModel.collection.updateMany({ workspaceId: space._id, 'members.0': { $exists: true } }, [{ $set: { deletedWithSpace: { at, by: actorId, members: '$members' }, members: [] } }]);
  await uninstallSpaceApps(space._id, actorId);
  noticeSpacesChanged(members);
}

/** Each app hears `app.uninstalled`, as from Integraciones, and its token dies. */
async function uninstallSpaceApps(workspaceId: Types.ObjectId, actorId: Types.ObjectId): Promise<void> {
  const [installations, actor] = await Promise.all([
    BotInstallationModel.find({ workspaceId, revokedAt: { $exists: false } }).select('_id workspaceId botUserId').lean<Pick<BotInstallation, '_id' | 'workspaceId' | 'botUserId'>[]>(),
    UserModel.findById(actorId).select('name phone').lean(),
  ]);
  const by = { id: String(actorId), name: actor?.name ?? null, phone: actor ? toInternationalPhone(actor.phone) || null : null };
  await Promise.all(installations.map(async (installation) => {
    await sendBotEvent(installation, 'app.uninstalled', { by });
    await revokeInstallation(installation);
  }));
}
