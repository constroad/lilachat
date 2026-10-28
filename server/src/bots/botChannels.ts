import type { Types } from 'mongoose';
import type { AppChannel } from '@lilachat/shared';
import { ChatModel } from '../chatModels.js';

/** A space has a handful of channels; this bounds the read, never the choice. */
const CHANNELS_READ = 200;
type Row = { _id: Types.ObjectId; name?: string; descripcion?: string; channel?: { visibility: 'public' | 'private' }; members: { userId: Types.ObjectId; role?: 'admin' | 'member' }[] };

/**
 * «En qué canales está» an app (pending 99, design c-05): the space's channels
 * I can see (public ones and the private ones I am in), oldest first, with the
 * app in or out. The switch rides `POST`/`DELETE /api/chats/:id/members`, so
 * `canChange` is what those routes allow: a space admin in the channel puts it
 * back, and takes it out only as that channel's admin.
 */
export async function appChannelsOf(params: { workspaceId: Types.ObjectId; botUserId: Types.ObjectId; userId: Types.ObjectId; spaceAdmin: boolean }): Promise<AppChannel[]> {
  const rows = await ChatModel.find({ workspaceId: params.workspaceId, kind: 'group', channel: { $exists: true }, $or: [{ 'channel.visibility': 'public' }, { 'members.userId': params.userId }] })
    .select('_id name descripcion channel members.userId members.role')
    .sort({ createdAt: 1, _id: 1 })
    .limit(CHANNELS_READ)
    .lean<Row[]>();
  return rows.map((row) => {
    const me = row.members.find((member) => String(member.userId) === String(params.userId));
    const inChannel = row.members.some((member) => String(member.userId) === String(params.botUserId));
    const description = row.descripcion?.split('\n').map((line) => line.trim()).find(Boolean);
    return { id: String(row._id), name: row.name ?? '', ...(description ? { description } : {}), private: row.channel?.visibility !== 'public', inChannel, canChange: params.spaceAdmin && Boolean(me) && (!inChannel || me?.role === 'admin') };
  });
}
