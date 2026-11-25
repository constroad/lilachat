/**
 * Points one notice topic of a space's app to a channel, as an admin would in the app's notice
 * routing panel. José 25/11/2026: the first-visit cards (agentes' topic `informes`) go to Constroad's
 * #admin and Globofast's #oficina instead of #general. It goes through `setTopicChannels`, so the
 * app joins a private channel the same way.
 *
 *   npx tsx --env-file=.env scripts/topic-channel.ts --space=<name> --topic=informes --channel=admin --by=<admin name>   # dry-run
 *   … --apply
 */
import mongoose from 'mongoose';
import { normalizeChannelName } from '@lilachat/shared';
import { connectDb } from '../server/src/db.js';
import { UserModel } from '../server/src/models.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../server/src/workspaceModels.js';
import { BotAppModel, BotInstallationModel } from '../server/src/bots/botModels.js';
import { setTopicChannels, topicRoutesOf } from '../server/src/bots/botTopics.js';

type Options = { space: string; topic: string; channel: string; by: string; apply: boolean };

function optionsOf(argv: string[]): Options {
  const value = (key: string) => argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3) ?? '';
  const options = { space: value('space'), topic: value('topic'), channel: normalizeChannelName(value('channel')), by: value('by'), apply: argv.includes('--apply') };
  if (!options.space || !options.topic || !options.channel || !options.by) throw new Error('Faltan --space, --topic, --channel o --by.');
  return options;
}

/** The live installation in the space whose app declares the topic; exactly one, or it stops. */
async function installationWithTopic(workspaceId: mongoose.Types.ObjectId, topic: string) {
  const installations = await BotInstallationModel.find({ workspaceId, revokedAt: { $exists: false } }).lean();
  const apps = await BotAppModel.find({ _id: { $in: installations.map((one) => one.appId) }, 'noticeTopics.key': topic }).select('_id name').lean();
  const matching = installations.filter((one) => apps.some((app) => String(app._id) === String(one.appId)));
  if (matching.length !== 1) throw new Error(`Tema «${topic}»: ${matching.length} apps instaladas lo declaran.`);
  return matching[0]!;
}

/** An active admin (or owner) of the space whose name starts with `name`: the actor kept on the installation. */
async function adminNamed(workspaceId: mongoose.Types.ObjectId, name: string) {
  const members = await WorkspaceMemberModel.find({ workspaceId, status: 'active', role: { $in: ['owner', 'admin'] } }).select('userId').lean();
  const users = await UserModel.find({ _id: { $in: members.map((one) => one.userId) }, name: { $regex: `^${name}`, $options: 'i' } }).select('name').lean();
  if (users.length !== 1) throw new Error(`«${name}»: ${users.length} admins coinciden.`);
  return users[0]!;
}

async function main(): Promise<void> {
  const options = optionsOf(process.argv.slice(2));
  await connectDb();
  const spaces = await WorkspaceModel.find({ name: { $regex: `^${options.space}$`, $options: 'i' } }).select('name').lean();
  if (spaces.length !== 1) throw new Error(`Espacio «${options.space}»: ${spaces.length} coinciden.`);
  const space = spaces[0]!;
  const installation = await installationWithTopic(space._id, options.topic);
  const admin = await adminNamed(space._id, options.by);
  const before = await topicRoutesOf(installation);
  const target = before.channels.find((one) => one.name === options.channel);
  if (!target) throw new Error(`#${options.channel} no existe en ${space.name}.`);
  const current = before.topics.find((one) => one.key === options.topic)?.channel?.name ?? 'sin canal';
  console.log(`${space.name}: «${options.topic}» llega hoy a #${current}; pasaría a #${target.name}${target.private ? ' (privado)' : ''}, por ${admin.name}.`);
  if (!options.apply) return console.log('Dry-run: nada escrito. Repite con --apply.');
  const after = await setTopicChannels(installation, { [options.topic]: target.id }, { kind: 'user', userId: String(admin._id) });
  if ('error' in after) throw new Error(after.message);
  console.log(`Listo: «${options.topic}» → #${after.topics.find((one) => one.key === options.topic)?.channel?.name}.`);
}

main()
  .catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => void mongoose.disconnect());
