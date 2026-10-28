import { itemKey, type AppItemSetting } from '@lilachat/shared';
import { BotAppModel, BotInstallationModel } from './botModels.js';

/** Everywhere and for everyone: what the tests that are not about permissions need (José, 28/10: untouched is off). */
const OPEN: AppItemSetting = { global: true, channels: 'all', direct: true, who: { kind: 'everyone' } };

/** Turns on every command and action of every installation, as an admin would one by one. Test support only. */
export async function openEveryItem(): Promise<void> {
  const installations = await BotInstallationModel.find({}).select('appId').lean();
  for (const installation of installations) {
    const app = await BotAppModel.findById(installation.appId).select('commands shortcuts').lean();
    const keys = [...(app?.commands ?? []).map((entry) => itemKey('command', entry.command)), ...(app?.shortcuts ?? []).map((entry) => itemKey('shortcut', entry.key))];
    await BotInstallationModel.updateOne({ _id: installation._id }, { $set: { itemSettings: Object.fromEntries(keys.map((key) => [key, OPEN])) } });
  }
}
