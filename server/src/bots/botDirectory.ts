import type { Types } from 'mongoose';
import { APP_SCOPES, newScopesOf, type AvailableApp, type DirectoryApp } from '@lilachat/shared';
import { ChatModel } from '../chatModels.js';
import { UserModel } from '../models.js';
import { isAvailableIn } from './botAvailability.js';
import { BotAppModel, BotInstallationModel, type BotApp } from './botModels.js';

/**
 * A space's apps directory (design e-24, like Slack's): every app with an
 * install address plus the ones already installed, with what they are, who
 * installed them and where they are active. The install address goes to admins
 * only, and only while the app is not installed.
 */
/** The space, and who installs as `login_hint` (agentes, 23/10: its sign-in asked «correo o celular» without saying which). */
const withSpace = (installUrl: string, spaceId: string, loginHint?: string): string => {
  const url = new URL(installUrl);
  url.searchParams.set('space', spaceId);
  if (loginHint) url.searchParams.set('login_hint', loginHint);
  return url.toString();
};

async function activityOf(workspaceId: string, botUserId: Types.ObjectId): Promise<{ channels: number; directs: number }> {
  const [channels, directs] = await Promise.all([
    ChatModel.countDocuments({ workspaceId, kind: 'group', channel: { $exists: true }, 'members.userId': botUserId }),
    ChatModel.countDocuments({ workspaceId, kind: 'direct', 'members.userId': botUserId }),
  ]);
  return { channels, directs };
}

const aboutOf = (app: BotApp) => ({
  appId: String(app._id),
  clientId: app.clientId,
  name: app.name,
  ...(app.avatarUrl ? { avatarUrl: app.avatarUrl } : {}),
  ...(app.description ? { description: app.description } : {}),
  features: app.features ?? [],
  ...(app.developer ? { developer: app.developer } : {}),
  ...(app.category ? { category: app.category } : {}),
  commands: app.commands ?? [],
  ...(app.scopes?.length ? { asks: newScopesOf(app.scopes, []).map((scope) => APP_SCOPES[scope]) } : {}),
});

/** A newer manifest asks for more than this space accepted (pending 95): in words, for the detail's «Reinstalar». */
function newPermissionsOf(app: BotApp, granted: readonly string[] | undefined): { newPermissions?: string[] } {
  const fresh = newScopesOf(app.scopes, granted).map((scope) => APP_SCOPES[scope]);
  return fresh.length ? { newPermissions: fresh } : {};
}

export async function directoryOf(spaceId: string, canInstall: boolean, loginHint?: string): Promise<DirectoryApp[]> {
  const installations = await BotInstallationModel.find({ workspaceId: spaceId, revokedAt: { $exists: false } }).select('appId botUserId installedBy createdAt grantedScopes').lean();
  const [apps, people, activity] = await Promise.all([
    BotAppModel.find({ $or: [{ installUrl: { $exists: true, $ne: '' } }, { _id: { $in: installations.map((one) => one.appId) } }] }).lean<BotApp[]>(),
    UserModel.find({ _id: { $in: installations.map((one) => one.installedBy) } }).select('name').lean(),
    Promise.all(installations.map((one) => activityOf(spaceId, one.botUserId))),
  ]);
  const names = new Map(people.map((person) => [String(person._id), person.name ?? null]));
  const byApp = new Map(installations.map((one, index) => [String(one.appId), { one, activity: activity[index]! }]));
  return apps
    .filter((app) => byApp.has(String(app._id)) || isAvailableIn(app, spaceId))
    .map((app): DirectoryApp => {
      const installed = byApp.get(String(app._id));
      if (installed) {
        const { one } = installed;
        // An admin can install it again (Slack's «Reinstall»): the company or the permissions may have changed.
        return { ...aboutOf(app), ...(canInstall && app.installUrl ? { installUrl: withSpace(app.installUrl, spaceId, loginHint) } : {}), installation: { installationId: String(one._id), botUserId: String(one.botUserId), installedBy: names.get(String(one.installedBy)) ?? null, installedAt: one.createdAt.toISOString(), ...installed.activity, ...newPermissionsOf(app, one.grantedScopes) } };
      }
      return { ...aboutOf(app), ...(canInstall && app.installUrl ? { installUrl: withSpace(app.installUrl, spaceId, loginHint) } : {}) };
    })
    .sort((a, b) => Number(Boolean(b.installation)) - Number(Boolean(a.installation)) || a.name.localeCompare(b.name, 'es'));
}

/** Integraciones' «Para instalar» (admins), kept as it was. */
export async function availableAppsIn(spaceId: string, loginHint?: string): Promise<AvailableApp[]> {
  const [apps, installed] = await Promise.all([
    BotAppModel.find({ installUrl: { $exists: true, $ne: '' } }).select('name avatarUrl installUrl availableIn').sort({ name: 1 }).lean<BotApp[]>(),
    BotInstallationModel.find({ workspaceId: spaceId, revokedAt: { $exists: false } }).select('appId').lean(),
  ]);
  const inside = new Set(installed.map((one) => String(one.appId)));
  return apps.filter((one) => inside.has(String(one._id)) || isAvailableIn(one, spaceId)).map((one) => ({ id: String(one._id), name: one.name, ...(one.avatarUrl ? { avatarUrl: one.avatarUrl } : {}), installUrl: withSpace(one.installUrl!, spaceId, loginHint), installed: inside.has(String(one._id)) }));
}
