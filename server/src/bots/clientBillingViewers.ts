import { Types } from 'mongoose';
import { canManageMembers, CLIENT_ID } from '@lilachat/shared';
import { ChatModel } from '../chatModels.js';
import { actorIn, ONLY_ADMINS, WorkspaceError } from '../workspaces.js';
import { ClientChannelModel, type ClientChannel } from './botClients.js';

const NOT_IN_CHANNEL = 'Esa persona no está en el canal de este cliente.';
const CLIENT_NOT_FOUND = 'Ese cliente no existe en este espacio.';

type Viewers = { viewers: string[] };
type ClientKey = Pick<ClientChannel, '_id' | 'chatId' | 'billingViewers'>;

/** The client's channel, only for an admin of the space (José 30/10: admins choose who else sees the collection). */
async function clientForAdmin(workspaceId: string, clientId: string, userId: Types.ObjectId): Promise<ClientKey> {
  const actor = await actorIn(workspaceId, userId);
  if (!canManageMembers(actor.role)) throw new WorkspaceError(403, ONLY_ADMINS);
  const client = CLIENT_ID.test(clientId) ? await ClientChannelModel.findOne({ workspaceId: new Types.ObjectId(workspaceId), clientId }).select('chatId billingViewers').lean<ClientKey | null>() : null;
  if (!client) throw new WorkspaceError(404, CLIENT_NOT_FOUND);
  return client;
}

const wire = (viewers: readonly Types.ObjectId[] | undefined): Viewers => ({ viewers: (viewers ?? []).map(String) });

export async function listBillingViewers(workspaceId: string, clientId: string, userId: Types.ObjectId): Promise<Viewers> {
  return wire((await clientForAdmin(workspaceId, clientId, userId)).billingViewers);
}

/** Marks or unmarks a member of the client's channel; marking twice keeps one. */
export async function setBillingViewer(workspaceId: string, clientId: string, userId: Types.ObjectId, targetId: string, body: { sees?: unknown }): Promise<Viewers> {
  if (typeof body.sees !== 'boolean') throw new WorkspaceError(400, 'Falta «sees» (true o false).');
  const client = await clientForAdmin(workspaceId, clientId, userId);
  if (!Types.ObjectId.isValid(targetId) || !(await ChatModel.exists({ _id: client.chatId, 'members.userId': new Types.ObjectId(targetId) }))) throw new WorkspaceError(404, NOT_IN_CHANNEL);
  const target = new Types.ObjectId(targetId);
  const update = body.sees ? { $addToSet: { billingViewers: target } } : { $pull: { billingViewers: target } };
  const saved = await ClientChannelModel.findByIdAndUpdate(client._id, update, { new: true }).select('billingViewers').lean<Pick<ClientChannel, 'billingViewers'> | null>();
  return wire(saved?.billingViewers);
}
