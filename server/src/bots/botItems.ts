import type { Types } from 'mongoose';
import { allOffSettings, itemKey, itemSettingOf, validateItemSettings, type AppItemRow } from '@lilachat/shared';
import { announceLater, announceSpaceApps } from './botAnnounce.js';
import { WorkspaceMemberModel } from '../workspaceModels.js';
import { BotAppModel, BotInstallationModel, type BotInstallation } from './botModels.js';
import { channelsOf } from './botTopics.js';

/**
 * The commands and actions of an installed app (R160; José, 23/10: only some
 * are global; 28/10: all start off, and once on only admins use them until
 * the admin widens it). The admin decides per item where (⚡, channels, the
 * 1:1) and who; `botCommands.ts` filters what is offered and refuses the rest.
 */
type Installation = Pick<BotInstallation, '_id' | 'appId' | 'workspaceId'>;
export type ItemsError = { status: 400 | 404; message: string };

export async function itemRowsOf(installation: Installation): Promise<{ items: AppItemRow[]; channels: { id: string; name: string; private: boolean }[] }> {
  const [app, stored, channels] = await Promise.all([
    BotAppModel.findById(installation.appId).select('commands shortcuts').lean(),
    BotInstallationModel.findById(installation._id).select('itemSettings itemsV2').lean(),
    channelsOf(installation.workspaceId),
  ]);
  const settings = stored?.itemSettings;
  const legacy = !stored?.itemsV2;
  return {
    items: [
      ...(app?.shortcuts ?? []).map((entry) => ({ kind: 'shortcut' as const, key: entry.key, name: entry.name, ...(entry.description ? { description: entry.description } : {}), ...itemSettingOf(settings, 'shortcut', entry.key, legacy) })),
      ...(app?.commands ?? []).map((entry) => ({ kind: 'command' as const, key: entry.command, name: `/${entry.command}`, description: entry.description, ...(entry.schedulable ? { schedulable: true as const } : {}), ...(entry.shareable === false ? { shareable: false as const } : {}), ...itemSettingOf(settings, 'command', entry.command, legacy) })),
    ],
    channels: channels.map((one) => ({ id: String(one._id), name: one.name ?? '', private: one.channel?.visibility !== 'public' })),
  };
}

/** A partial map; the space's members hear `workspace.apps.changed`, so a «/» or a ⚡ already read is not stale. */
export async function setItemSettings(installation: Installation, raw: unknown): Promise<Awaited<ReturnType<typeof itemRowsOf>> | ItemsError> {
  const app = await BotAppModel.findById(installation.appId).select('commands shortcuts').lean();
  const known = [...(app?.shortcuts ?? []).map((entry) => itemKey('shortcut', entry.key)), ...(app?.commands ?? []).map((entry) => itemKey('command', entry.command))];
  const valid = validateItemSettings(raw, known);
  if (!valid.ok) return { status: 400, message: valid.message };
  const spaceChannels = new Set((await channelsOf(installation.workspaceId as Types.ObjectId)).map((one) => String(one._id)));
  const picked = Object.values(valid.settings).flatMap((setting) => (Array.isArray(setting.channels) ? setting.channels : []));
  if (picked.some((id) => !spaceChannels.has(id))) return { status: 404, message: 'Ese canal no existe en el espacio.' };
  // «Quién puede»: the people chosen are active members of this space, never someone from outside (§2.1).
  const people = [...new Set(Object.values(valid.settings).flatMap((setting) => (setting.who?.kind === 'people' ? setting.who.userIds : [])))];
  if (people.length && (await WorkspaceMemberModel.countDocuments({ workspaceId: installation.workspaceId, userId: { $in: people }, status: 'active' })) !== people.length) return { status: 400, message: 'Solo puedes elegir a miembros del espacio.' };
  const changes = Object.entries(valid.settings).flatMap(([key, setting]) => Object.entries(setting).map(([field, value]) => [`itemSettings.${key}.${field}`, value] as const));
  if (changes.length) {
    await BotInstallationModel.updateOne({ _id: installation._id }, { $set: Object.fromEntries(changes) });
    announceLater(announceSpaceApps(installation.workspaceId));
  }
  return itemRowsOf(installation);
}

/**
 * José's go (agentes COMANDOS-Y-HORARIOS §2.1): every installation from before
 * gets every command and action written off and is marked, so it runs once and
 * a later change of the default turns nothing on. Each space hears it.
 */
export async function migrateItemsToAllOff(): Promise<{ installations: number }> {
  const pending = await BotInstallationModel.find({ itemsV2: { $ne: true } }).select('_id appId workspaceId').lean();
  const apps = await BotAppModel.find({ _id: { $in: [...new Set(pending.map((one) => String(one.appId)))] } }).select('commands shortcuts').lean();
  const keysOf = (appId: Types.ObjectId) => {
    const app = apps.find((one) => String(one._id) === String(appId));
    return [...(app?.shortcuts ?? []).map((entry) => itemKey('shortcut', entry.key)), ...(app?.commands ?? []).map((entry) => itemKey('command', entry.command))];
  };
  const written = await Promise.all(pending.map((one) => BotInstallationModel.updateOne({ _id: one._id, itemsV2: { $ne: true } }, { $set: { itemSettings: allOffSettings(keysOf(one.appId)), itemsV2: true } })));
  await Promise.all([...new Set(pending.map((one) => String(one.workspaceId)))].map((spaceId) => announceSpaceApps(spaceId)));
  return { installations: written.filter((outcome) => outcome.modifiedCount > 0).length };
}
