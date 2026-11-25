/**
 * Creates public channels in a space on behalf of one of its admins, and joins other members to them.
 * José 14/11/2026: Globofast's #oficina, #cotizaciones, #gastos and #licitaciones, created by Medaly
 * (he is hidden there until ~19/11), with Nickole in them. It goes through the app's own functions:
 * the creator is the channel's admin and the space's apps join the public channels as usual.
 *
 *   npx tsx --env-file=.env scripts/space-channels.ts --space=<name> --by=<name> --join=<name>[,<name>] --channels=a,b   # dry-run
 *   … --apply
 *   npx tsx --env-file=.env scripts/space-channels.ts --space=<name> --list            # members, to pick the names
 */
import mongoose, { Types } from 'mongoose';
import { normalizeChannelName } from '@lilachat/shared';
import { connectDb } from '../server/src/db.js';
import { ChatModel } from '../server/src/chatModels.js';
import { UserModel } from '../server/src/models.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../server/src/workspaceModels.js';
import { createChannel, joinChannel } from '../server/src/workspaceChannels.js';
import { addBotsToPublicChannel } from '../server/src/bots/botInstall.js';
import { addMember } from '../server/src/miembrosDelChat.js';

type Options = { space: string; by: string; join: string[]; channels: string[]; privates: string[]; apply: boolean };

function optionsOf(argv: string[]): Options {
  const value = (key: string) => argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3) ?? '';
  const list = (key: string) => value(key).split(',').map((one) => one.trim()).filter(Boolean);
  const options = { space: value('space'), by: value('by'), join: list('join'), channels: list('channels'), privates: list('private'), apply: argv.includes('--apply') };
  if (!options.space || (!argv.includes('--list') && (!options.by || !options.channels.length))) throw new Error('Faltan --space, --by o --channels.');
  return options;
}

/** The ACTIVE member of the space whose name starts with `name` (case-insensitive); exactly one, or it stops. */
type Candidate = { id: Types.ObjectId; name: string; role: string };

async function memberNamed(workspaceId: Types.ObjectId, name: string): Promise<Candidate> {
  const members = await WorkspaceMemberModel.find({ workspaceId, status: 'active', userId: { $exists: true } }).select('userId role').lean();
  const users = await UserModel.find({ _id: { $in: members.map((one) => one.userId) }, name: { $regex: `^${name}`, $options: 'i' } }).select('name').lean();
  if (users.length !== 1) throw new Error(`«${name}»: ${users.length} miembros activos coinciden (${users.map((one) => one.name).join(', ')}).`);
  const user = users[0]!;
  const role = members.find((one) => String(one.userId) === String(user._id))?.role ?? '';
  return { id: user._id as Types.ObjectId, name: user.name ?? '', role };
}

async function listMembers(workspaceId: Types.ObjectId): Promise<void> {
  const members = await WorkspaceMemberModel.find({ workspaceId }).select('userId role status hidden').lean();
  const users = await UserModel.find({ _id: { $in: members.map((one) => one.userId) } }).select('name').lean();
  for (const member of members) console.log(member.status, member.role, member.hidden ? 'oculto' : '', users.find((user) => String(user._id) === String(member.userId))?.name ?? '(sin cuenta)');
}

/**
 * An existing channel is not recreated; the `--join` people who are not in it yet join it
 * (José 25/11/2026: Nikole, Leopoldo Campos, Cielo and Pachas into Globofast's #oficina).
 */
async function joinExisting(spaceId: string, name: string, channel: { _id: Types.ObjectId; channel?: { visibility?: string }; members?: { userId?: Types.ObjectId }[] }, by: Candidate, joiners: Candidate[], apply: boolean): Promise<void> {
  const inside = new Set((channel.members ?? []).map((member) => String(member.userId)));
  const missing = joiners.filter((joiner) => !inside.has(String(joiner.id)));
  console.log(`#${name}: ya existe (${channel._id}). Faltan: ${missing.map((one) => one.name).join(', ') || 'nadie'}.`);
  if (!apply) return;
  // A private channel takes people only from one of its members: the `--by` admin adds them.
  for (const joiner of missing) {
    const added = channel.channel?.visibility === 'private' ? await addMember({ chatId: String(channel._id), quien: by.id, aQuien: String(joiner.id) }) : await joinChannel(spaceId, joiner.id, String(channel._id));
    if ('ok' in added && !added.ok) throw new Error(`${joiner.name}: ${added.motivo}`);
  }
  if (missing.length) console.log(`#${name}: se unieron ${missing.length}.`);
}

async function main(): Promise<void> {
  const options = optionsOf(process.argv.slice(2));
  await connectDb();
  const spaces = await WorkspaceModel.find({ name: { $regex: `^${options.space}$`, $options: 'i' } }).select('name').lean();
  if (spaces.length !== 1) throw new Error(`Espacio «${options.space}»: ${spaces.length} coinciden.`);
  const space = spaces[0]!;
  if (process.argv.includes('--list')) return listMembers(space._id);
  const creator = await memberNamed(space._id, options.by);
  const joiners = await Promise.all(options.join.map((name) => memberNamed(space._id, name)));
  console.log(`Espacio ${space.name} (${space._id}). Crea: ${creator.name} (${creator.role}). Se unen: ${joiners.map((one) => `${one.name} (${one.role})`).join(', ') || 'nadie'}.`);
  for (const raw of options.channels) {
    const name = normalizeChannelName(raw);
    const existing = await ChatModel.findOne({ workspaceId: space._id, 'channel.visibility': { $exists: true }, name }).select('_id channel.visibility members.userId').lean();
    if (existing) { await joinExisting(String(space._id), name, existing, creator, joiners, options.apply); continue; }
    if (!options.apply) { console.log(`#${name}: se crearía ${options.privates.includes(name) ? 'privado' : 'público'}.`); continue; }
    const secret = options.privates.includes(name);
    const channel = await createChannel(String(space._id), creator.id, { name, visibility: secret ? 'private' : 'public' });
    // A private channel (money: only admins, José 13/11) gets the space's apps too, as a public one does on its own.
    if (secret) await addBotsToPublicChannel(space._id, new Types.ObjectId(channel.id));
    else for (const joiner of joiners) await joinChannel(String(space._id), joiner.id, channel.id);
    console.log(`#${name}: creado ${secret ? 'privado' : 'público'} (${channel.id}).`);
  }
  if (!options.apply) console.log('Dry-run: nada escrito. Repite con --apply.');
}

main()
  .catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => void mongoose.disconnect());
