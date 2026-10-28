import { MANIFEST_LIMITS, type AppManifest } from '@lilachat/shared';
import type { Types } from 'mongoose';
import { UserModel } from '../models.js';
import { callBotWebhook } from './botEvents.js';
import { announceAppChanged, announceLater } from './botAnnounce.js';
import { revokeInstallation } from './botInstall.js';
import { commandsToWire } from './botCommands.js';
import { BotAppModel, BotInstallationModel, type BotApp } from './botModels.js';
import { newSecret, sha256 } from './botSecrets.js';
import { authenticatedClient } from './oauthService.js';

/**
 * Apps made by a developer app through a manifest (`specs/BOTS-API.spec.md`
 * §0-bis), like Slack's: agentes holds ONE Lilachat credential (Lila's) and
 * creates the bot of each product with it; each bot's secret comes back in
 * the response, server to server (José, 23/10: no key per app in Torre).
 */
export type AppsError = { status: 400 | 401 | 403 | 404; error: string; message: string };

/** Who may create apps: a reviewed code change, not a database flag. The client id is public. */
const DEVELOPER_APP_CLIENT_IDS: readonly string[] = ['lca_lnkjg6KXzr_GBiF-YG3V'];
const UNINSTALL_NOTICE_TIMEOUT_MS = 5_000;
const CLIENT_ID_LENGTH = 24;
let developerClientIds = DEVELOPER_APP_CLIENT_IDS;
const fail = (status: AppsError['status'], error: string, message: string): AppsError => ({ status, error, message });

/** Tests use their own developer app. */
export function configureDevelopers(clientIds: readonly string[]): void {
  developerClientIds = clientIds;
}

/** `Authorization: Basic base64(client_id:client_secret)` of a developer app. */
export async function developerFrom(header: string | undefined): Promise<BotApp | AppsError> {
  const encoded = header?.startsWith('Basic ') ? header.slice(6) : '';
  const [clientId, clientSecret] = Buffer.from(encoded, 'base64').toString('utf8').split(':');
  const app = await authenticatedClient(clientId, clientSecret);
  if (!app) return fail(401, 'invalid_client', 'client_id o client_secret no coinciden.');
  if (!developerClientIds.includes(app.clientId)) return fail(403, 'not_a_developer', 'Esta app no puede crear otras apps.');
  return app;
}

const manifestFields = (manifest: AppManifest) => ({
  name: manifest.name,
  redirectUris: [manifest.redirectUri],
  webhookUrl: manifest.webhookUrl,
  ...(manifest.avatarUrl ? { avatarUrl: manifest.avatarUrl } : {}),
  ...(manifest.installUrl ? { installUrl: manifest.installUrl } : {}),
  ...(manifest.commands ? { commands: manifest.commands } : {}),
  shortcuts: manifest.shortcuts,
  noticeTopics: manifest.noticeTopics,
  suggestedSchedules: manifest.suggestedSchedules,
  scopes: manifest.scopes,
  ...(manifest.description ? { description: manifest.description } : {}),
  ...(manifest.features ? { features: manifest.features } : {}),
  ...(manifest.developer ? { developer: manifest.developer } : {}),
  ...(manifest.category ? { category: manifest.category } : {}),
});

/**
 * The bot users copy the app's name and logo when they are made (`botUserFor`), so a re-sent manifest
 * has to reach them too (José, 24/10: Portal kept the SVG it was installed with and showed a «P»).
 */
async function syncBotUsers(appId: Types.ObjectId, manifest: AppManifest): Promise<void> {
  await UserModel.updateMany({ 'app.appId': appId }, { $set: { name: manifest.name, ...(manifest.avatarUrl ? { avatarUrl: manifest.avatarUrl } : {}) } });
}

/** Idempotent by (developer, key): 201 with the secret the first time, 200 without it afterwards. */
export async function upsertApp(developer: BotApp, manifest: AppManifest): Promise<{ status: 200 | 201; body: { client_id: string; client_secret?: string } } | AppsError> {
  const existing = await BotAppModel.findOne({ ownerAppId: developer._id, key: manifest.key }).select('clientId').lean();
  if (existing) {
    await BotAppModel.updateOne({ _id: existing._id }, { $set: manifestFields(manifest) });
    await syncBotUsers(existing._id, manifest);
    announceLater(announceAppChanged(existing._id));
    return { status: 200, body: { client_id: existing.clientId } };
  }
  if ((await BotAppModel.countDocuments({ ownerAppId: developer._id })) >= MANIFEST_LIMITS.appsPerDeveloper) return fail(400, 'too_many_apps', `Una desarrolladora crea hasta ${MANIFEST_LIMITS.appsPerDeveloper} apps.`);
  const clientId = newSecret('lca_').slice(0, CLIENT_ID_LENGTH);
  const clientSecret = newSecret('lcx_');
  await BotAppModel.create({ clientId, clientSecretHash: sha256(clientSecret), ownerAppId: developer._id, key: manifest.key, ...manifestFields(manifest) });
  return { status: 201, body: { client_id: clientId, client_secret: clientSecret } };
}

const ownedApp = (developer: BotApp, clientId: string) => BotAppModel.findOne({ clientId, ownerAppId: developer._id }).lean<BotApp | null>();

export async function rotateAppSecret(developer: BotApp, clientId: string): Promise<{ client_secret: string } | AppsError> {
  const app = await ownedApp(developer, clientId);
  if (!app) return fail(404, 'app_not_found', 'Esa app no existe o no es tuya.');
  const clientSecret = newSecret('lcx_');
  await BotAppModel.updateOne({ _id: app._id }, { $set: { clientSecretHash: sha256(clientSecret) } });
  return { client_secret: clientSecret };
}

export async function listOwnedApps(developer: BotApp) {
  const apps = await BotAppModel.find({ ownerAppId: developer._id }).select('clientId key name avatarUrl redirectUris webhookUrl installUrl commands shortcuts').sort({ key: 1 }).lean<BotApp[]>();
  const installed = await BotInstallationModel.aggregate<{ _id: unknown; count: number }>([{ $match: { appId: { $in: apps.map((app) => app._id) }, revokedAt: { $exists: false } } }, { $group: { _id: '$appId', count: { $sum: 1 } } }]);
  const counts = new Map(installed.map((one) => [String(one._id), one.count]));
  return apps.map((app) => ({
    client_id: app.clientId,
    key: app.key,
    name: app.name,
    ...(app.avatarUrl ? { avatar_url: app.avatarUrl } : {}),
    redirect_uri: app.redirectUris[0],
    webhook_url: app.webhookUrl,
    ...(app.installUrl ? { install_url: app.installUrl } : {}),
    commands: commandsToWire(app.commands ?? []),
    shortcuts: app.shortcuts ?? [],
    installations: counts.get(String(app._id)) ?? 0,
  }));
}

/** Like uninstalling from Integraciones in every space (`app.uninstalled`, by nobody), then the app is gone. */
export async function deleteOwnedApp(developer: BotApp, clientId: string): Promise<true | AppsError> {
  const app = await ownedApp(developer, clientId);
  if (!app) return fail(404, 'app_not_found', 'Esa app no existe o no es tuya.');
  const installations = await BotInstallationModel.find({ appId: app._id, revokedAt: { $exists: false } }).lean();
  // Sent and awaited before deleting: a queued delivery would no longer find the app to sign for.
  await Promise.all(installations.map((installation) => callBotWebhook({ ...installation, webhookUrl: app.webhookUrl }, 'app.uninstalled', { by: null }, UNINSTALL_NOTICE_TIMEOUT_MS)));
  await Promise.all(installations.map((installation) => revokeInstallation(installation)));
  await BotAppModel.deleteOne({ _id: app._id });
  return true;
}
