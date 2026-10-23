import { Types } from 'mongoose';
import { normalizeEmail, normalizePeruPhone, toInternationalPhone } from '@lilachat/shared';
import { UserModel } from '../models.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../workspaceModels.js';
import type { AppsError } from './botApps.js';
import { BotAppModel, BotInstallationModel, type BotApp } from './botModels.js';

/**
 * Which spaces may install each app, decided from agentes' console (José,
 * 23/10; `specs/BOTS-API.spec.md` §0-ter). An app with no list is available
 * everywhere, as before; with a list, only there. Agentes sees the spaces of
 * the person signed in to its console (owner or admin), never anyone else's.
 */
export type AppRef = { key: string } | { clientId: string };
export type Availability = { everywhere: true } | { spaces: string[] };

/** A list longer than this is not a product decision, it is a mistake. */
const MAX_LISTED_SPACES = 500;
const SPACE_MANAGERS = ['owner', 'admin'] as const;
const fail = (status: AppsError['status'], error: string, message: string): AppsError => ({ status, error, message });

export const isAvailableIn = (app: Pick<BotApp, 'availableIn'>, spaceId: string | Types.ObjectId): boolean =>
  !app.availableIn || app.availableIn.some((id) => String(id) === String(spaceId));

/** The account agentes' console signed in with: a verified email, or a phone in either stored form. */
async function personBy(admin: string): Promise<Types.ObjectId | null | AppsError> {
  const email = normalizeEmail(admin);
  const local = email ? '' : normalizePeruPhone(admin);
  if (!email && !local) return fail(400, 'invalid_request', 'admin debe ser un correo o un celular.');
  const query = email ? { email, emailVerifiedAt: { $exists: true } } : { phone: { $in: [local, toInternationalPhone(local)] } };
  const user = await UserModel.findOne(query).select('_id').lean();
  return user?._id ?? null;
}

export async function spacesRunBy(developer: BotApp, admin: string) {
  const person = await personBy(admin);
  if (person && 'error' in person) return person;
  if (!person) return { spaces: [] };
  const memberships = await WorkspaceMemberModel.find({ userId: person, status: 'active', role: { $in: SPACE_MANAGERS } }).select('workspaceId role').lean();
  const ids = memberships.map((member) => member.workspaceId);
  const [spaces, counts, owned] = await Promise.all([
    WorkspaceModel.find({ _id: { $in: ids } }).select('name').sort({ name: 1 }).lean(),
    WorkspaceMemberModel.aggregate<{ _id: Types.ObjectId; count: number }>([{ $match: { workspaceId: { $in: ids }, status: 'active' } }, { $group: { _id: '$workspaceId', count: { $sum: 1 } } }]),
    BotAppModel.find({ ownerAppId: developer._id }).select('_id key').lean(),
  ]);
  const installations = await BotInstallationModel.find({ workspaceId: { $in: ids }, appId: { $in: owned.map((app) => app._id) }, revokedAt: { $exists: false } }).select('workspaceId appId').lean();
  const keyOf = new Map(owned.map((app) => [String(app._id), app.key ?? '']));
  const roleOf = new Map(memberships.map((member) => [String(member.workspaceId), member.role]));
  const membersOf = new Map(counts.map((count) => [String(count._id), count.count]));
  return {
    spaces: spaces.map((space) => ({
      id: String(space._id),
      name: space.name,
      members: membersOf.get(String(space._id)) ?? 0,
      role: roleOf.get(String(space._id)),
      installed: installations.filter((one) => String(one.workspaceId) === String(space._id)).flatMap((one) => keyOf.get(String(one.appId)) || []),
    })),
  };
}

const ownedBy = (developer: BotApp, ref: AppRef) =>
  BotAppModel.findOne({ ownerAppId: developer._id, ...('key' in ref ? { key: ref.key } : { clientId: ref.clientId }) }).select('_id availableIn').lean<Pick<BotApp, '_id' | 'availableIn'> | null>();

const toWire = (app: Pick<BotApp, 'availableIn'>): Availability => (app.availableIn ? { spaces: app.availableIn.map(String) } : { everywhere: true });

export async function availabilityOf(developer: BotApp, ref: AppRef): Promise<Availability | AppsError> {
  const app = await ownedBy(developer, ref);
  return app ? toWire(app) : fail(404, 'app_not_found', 'Esa app no existe o no es tuya.');
}

/** `{ everywhere: true }`, or `{ spaces: [...] }` with existing space ids (an empty list = nowhere). */
export async function setAvailability(developer: BotApp, ref: AppRef, body: unknown): Promise<Availability | AppsError> {
  const app = await ownedBy(developer, ref);
  if (!app) return fail(404, 'app_not_found', 'Esa app no existe o no es tuya.');
  const input = (body ?? {}) as { everywhere?: unknown; spaces?: unknown };
  if (input.everywhere === true) {
    await BotAppModel.updateOne({ _id: app._id }, { $unset: { availableIn: 1 } });
    return { everywhere: true };
  }
  const list = input.spaces;
  if (!Array.isArray(list) || list.length > MAX_LISTED_SPACES || !list.every((id) => typeof id === 'string' && Types.ObjectId.isValid(id))) {
    return fail(400, 'invalid_request', `Manda { "everywhere": true } o { "spaces": [ids] } (hasta ${MAX_LISTED_SPACES}).`);
  }
  const ids = [...new Set(list as string[])].map((id) => new Types.ObjectId(id));
  if ((await WorkspaceModel.countDocuments({ _id: { $in: ids } })) !== ids.length) return fail(400, 'unknown_space', 'Algún espacio de la lista no existe.');
  await BotAppModel.updateOne({ _id: app._id }, { $set: { availableIn: ids } });
  return { spaces: ids.map(String) };
}
