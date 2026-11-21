/**
 * Makes a space's existing member an admin, and backfills every client channel that already
 * exists with them (José 21/11/2026, Globofast: «necesito que ellos estén en esos grupos»). Going
 * forward nothing else is needed: `addMissingAdmins` (`botClients.ts`) already adds a new admin to
 * a client channel on the app's next `PUT`, the same mechanism that creates the channel in the
 * first place — this script only does, right now, what that would otherwise do at the next update.
 *
 *   npx tsx --env-file=.env scripts/promote-client-channel-admins.ts --space=<name> --promote=<name>[,<name>]   # dry-run
 *   … --apply
 *   npx tsx --env-file=.env scripts/promote-client-channel-admins.ts --space=<name> --list            # members, to pick the names
 */
import mongoose, { Types } from 'mongoose';
import { connectDb } from '../server/src/db.js';
import { UserModel } from '../server/src/models.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../server/src/workspaceModels.js';
import { addMissingAdmins, ClientChannelModel } from '../server/src/bots/botClients.js';

type Options = { space: string; promote: string[]; apply: boolean };

function optionsOf(argv: string[]): Options {
  const value = (key: string) => argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3) ?? '';
  const promote = value('promote').split(',').map((one) => one.trim()).filter(Boolean);
  const options = { space: value('space'), promote, apply: argv.includes('--apply') };
  if (!options.space || (!argv.includes('--list') && !options.promote.length)) throw new Error('Faltan --space o --promote.');
  return options;
}

type Candidate = { id: Types.ObjectId; name: string; role: string };

/** The active member of the space whose name starts with `name` (case-insensitive); exactly one, or it stops. */
async function memberNamed(workspaceId: Types.ObjectId, name: string): Promise<Candidate> {
  const members = await WorkspaceMemberModel.find({ workspaceId, status: 'active', userId: { $exists: true } }).select('userId role').lean();
  const userIds = members.flatMap((one) => (one.userId ? [one.userId] : []));
  const users = await UserModel.find({ _id: { $in: userIds }, name: { $regex: `^${name}`, $options: 'i' } }).select('name').lean();
  if (users.length !== 1) throw new Error(`«${name}»: ${users.length} miembros activos coinciden (${users.map((one) => one.name).join(', ')}).`);
  const user = users[0]!;
  const role = members.find((one) => String(one.userId) === String(user._id))?.role ?? '';
  return { id: user._id as Types.ObjectId, name: user.name ?? '', role };
}

async function listMembers(workspaceId: Types.ObjectId): Promise<void> {
  const members = await WorkspaceMemberModel.find({ workspaceId }).select('userId role status').lean();
  const userIds = members.flatMap((one) => (one.userId ? [one.userId] : []));
  const users = await UserModel.find({ _id: { $in: userIds } }).select('name').lean();
  for (const member of members) console.log(member.status, member.role, users.find((user) => String(user._id) === String(member.userId))?.name ?? '(sin cuenta)');
}

async function main(): Promise<void> {
  const options = optionsOf(process.argv.slice(2));
  await connectDb();
  const spaces = await WorkspaceModel.find({ name: { $regex: `^${options.space}$`, $options: 'i' } }).select('name').lean();
  if (spaces.length !== 1) throw new Error(`Espacio «${options.space}»: ${spaces.length} coinciden.`);
  const space = spaces[0]!;
  if (process.argv.includes('--list')) return listMembers(space._id);
  const candidates = await Promise.all(options.promote.map((name) => memberNamed(space._id, name)));
  console.log(`Espacio ${space.name} (${space._id}).`);
  for (const candidate of candidates) {
    if (candidate.role === 'owner' || candidate.role === 'admin') {
      console.log(`${candidate.name}: ya es ${candidate.role}, sin cambios.`);
      continue;
    }
    console.log(`${candidate.name}: ${candidate.role} → admin${options.apply ? '' : ' (se aplicaría)'}.`);
    if (options.apply) await WorkspaceMemberModel.updateOne({ workspaceId: space._id, userId: candidate.id }, { $set: { role: 'admin' } });
  }
  const channels = await ClientChannelModel.find({ workspaceId: space._id }).select('name chatId').lean();
  console.log(`${channels.length} canal(es) de cliente en el espacio.`);
  if (!options.apply) {
    console.log('Dry-run: nada escrito. Repite con --apply (promueve y suma a los canales que ya existen).');
    return;
  }
  for (const channel of channels) await addMissingAdmins(space._id, channel.chatId);
  console.log(`Sumados a los ${channels.length} canales que ya existían (los admins que faltaban en cada uno).`);
}

main()
  .catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => void mongoose.disconnect());
