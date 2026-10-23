import type { Types } from 'mongoose';
import { itemKey, itemSettingOf, validateItemSettings, type AppItemRow } from '@lilachat/shared';
import { announceLater, announceSpaceApps } from './botAnnounce.js';
import { BotAppModel, BotInstallationModel, type BotInstallation } from './botModels.js';
import { channelsOf } from './botTopics.js';

/**
 * The commands and actions of an installed app (R160; José, 23/10: only some
 * are global, switched on and off from Lilachat, per channel and for the
 * whole space). The admin decides per item; `botCommands.ts` filters what is
 * offered and refuses what is not enabled at that place.
 */
type Installation = Pick<BotInstallation, '_id' | 'appId' | 'workspaceId'>;
export type ItemsError = { status: 400 | 404; message: string };

export async function itemRowsOf(installation: Installation): Promise<{ items: AppItemRow[]; channels: { id: string; name: string; private: boolean }[] }> {
  const [app, stored, channels] = await Promise.all([
    BotAppModel.findById(installation.appId).select('commands shortcuts').lean(),
    BotInstallationModel.findById(installation._id).select('itemSettings').lean(),
    channelsOf(installation.workspaceId),
  ]);
  const settings = stored?.itemSettings;
  return {
    items: [
      ...(app?.shortcuts ?? []).map((entry) => ({ kind: 'shortcut' as const, key: entry.key, name: entry.name, ...(entry.description ? { description: entry.description } : {}), ...itemSettingOf(settings, 'shortcut', entry.key) })),
      ...(app?.commands ?? []).map((entry) => ({ kind: 'command' as const, key: entry.command, name: `/${entry.command}`, description: entry.description, ...itemSettingOf(settings, 'command', entry.command) })),
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
  const changes = Object.entries(valid.settings).flatMap(([key, setting]) => Object.entries(setting).map(([field, value]) => [`itemSettings.${key}.${field}`, value] as const));
  if (changes.length) {
    await BotInstallationModel.updateOne({ _id: installation._id }, { $set: Object.fromEntries(changes) });
    announceLater(announceSpaceApps(installation.workspaceId));
  }
  return itemRowsOf(installation);
}
