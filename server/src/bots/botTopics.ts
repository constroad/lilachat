import { Types } from 'mongoose';
import { validateTopicChannels, type NoticeTopic, type TopicRoute } from '@lilachat/shared';
import { ChatModel } from '../chatModels.js';
import { BotAppModel, BotInstallationModel, type BotInstallation } from './botModels.js';

/**
 * Where each notice topic of an app lands in a space (R160, design e-31;
 * `specs/BOTS-API.spec.md` §c-quater). Lilachat keeps it: the admin picks in
 * the app's «Avisos», the app posts with `topic` and never stores channel ids.
 * A topic never touched goes to #general (or the oldest public channel), as
 * agentes did; `null` is «Sin canal» and is not posted.
 */
type Installation = Pick<BotInstallation, '_id' | 'appId' | 'workspaceId' | 'botUserId'>;
export type Channel = { _id: Types.ObjectId; name?: string; channel?: { visibility: 'public' | 'private' } };
export type TopicsError = { status: 400 | 404 | 409; error: string; message: string };
const fail = (status: TopicsError['status'], error: string, message: string): TopicsError => ({ status, error, message });
/** A space has a handful of channels; this bounds the read, never the choice. */
const CHANNELS_READ = 200;

/** The space's channels, oldest first (also what «Comandos y acciones» lists, `botItems.ts`). */
export const channelsOf = (workspaceId: Types.ObjectId) =>
  ChatModel.find({ workspaceId, kind: 'group', channel: { $exists: true } }).select('_id name channel').sort({ createdAt: 1, _id: 1 }).limit(CHANNELS_READ).lean<Channel[]>();

/** #general, or the oldest public channel. */
const defaultOf = (channels: readonly Channel[]) => channels.find((one) => one.channel?.visibility === 'public' && one.name?.toLowerCase() === 'general') ?? channels.find((one) => one.channel?.visibility === 'public') ?? null;

async function stateOf(installation: Pick<Installation, '_id' | 'appId' | 'workspaceId'>) {
  const [app, stored, channels] = await Promise.all([
    BotAppModel.findById(installation.appId).select('noticeTopics').lean(),
    BotInstallationModel.findById(installation._id).select('topicChannels').lean(),
    channelsOf(installation.workspaceId),
  ]);
  return { topics: app?.noticeTopics ?? [], chosen: stored?.topicChannels ?? {}, channels };
}

function channelOfTopic(topic: NoticeTopic, chosen: Record<string, string | null>, channels: readonly Channel[]): Channel | null {
  if (chosen[topic.key] === null) return null;
  // A channel deleted after it was picked falls back like a topic never touched;
  // a topic declared with `default: null` (amounts) waits in «Sin canal» until an admin picks.
  return channels.find((one) => String(one._id) === chosen[topic.key]) ?? (topic.noDefault ? null : defaultOf(channels));
}

export async function topicRoutesOf(installation: Pick<Installation, '_id' | 'appId' | 'workspaceId'>): Promise<{ topics: TopicRoute[]; channels: { id: string; name: string; private: boolean }[] }> {
  const { topics, chosen, channels } = await stateOf(installation);
  return {
    topics: topics.map((topic) => {
      const channel = channelOfTopic(topic, chosen, channels);
      return { ...topic, channel: channel ? { id: String(channel._id), name: channel.name ?? '' } : null };
    }),
    channels: channels.map((one) => ({ id: String(one._id), name: one.name ?? '', private: one.channel?.visibility !== 'public' })),
  };
}

/** A partial map: what is not sent keeps its value. A private channel gets the bot as a member, or it could not post there. */
export async function setTopicChannels(installation: Installation, raw: unknown): Promise<Awaited<ReturnType<typeof topicRoutesOf>> | TopicsError> {
  const { topics, channels } = await stateOf(installation);
  const valid = validateTopicChannels(raw, topics.map((topic) => topic.key));
  if (!valid.ok) return fail(400, 'invalid_request', valid.message);
  const picked = Object.values(valid.channels).filter((id): id is string => id !== null);
  const unknown = picked.find((id) => !channels.some((one) => String(one._id) === id));
  if (unknown) return fail(404, 'channel_not_found', 'Ese canal no existe en el espacio.');
  // A channel picked for a topic gets the app as a member: a private one, or one an admin had taken it out of (pending 91).
  const pickedIds = channels.filter((one) => picked.includes(String(one._id))).map((one) => one._id);
  await Promise.all([
    Object.keys(valid.channels).length ? BotInstallationModel.updateOne({ _id: installation._id }, { $set: Object.fromEntries(Object.entries(valid.channels).map(([key, id]) => [`topicChannels.${key}`, id])) }) : null,
    pickedIds.length ? ChatModel.updateMany({ _id: { $in: pickedIds }, 'members.userId': { $ne: installation.botUserId } }, { $push: { members: { userId: installation.botUserId, role: 'member', joinedAt: new Date() } }, $pull: { appsRemoved: installation.botUserId } }) : null,
  ]);
  return topicRoutesOf(installation);
}

/** The channel of a topic when the app posts with `topic`. */
export async function channelOfPostedTopic(installation: Pick<Installation, '_id' | 'workspaceId'>, key: string): Promise<string | TopicsError> {
  const stored = await BotInstallationModel.findById(installation._id).select('appId workspaceId').lean();
  if (!stored) return fail(404, 'topic_not_found', 'Esa instalación ya no existe.');
  const { topics, chosen, channels } = await stateOf(stored);
  const topic = topics.find((one) => one.key === key);
  if (!topic) return fail(404, 'topic_not_found', `La app no declaró el tema «${key}» en su manifiesto.`);
  const channel = channelOfTopic(topic, chosen, channels);
  if (channel) return String(channel._id);
  const why = topic.noDefault && chosen[topic.key] === undefined ? 'espera a que un admin elija un canal privado' : 'el admin lo dejó sin canal';
  return fail(409, 'topic_without_channel', `El tema «${topic.name}» no tiene canal: ${why}.`);
}
