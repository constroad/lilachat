import type { Types } from 'mongoose';
import { emitAppsChanged } from '../reparto.js';
import { WorkspaceMemberModel } from '../workspaceModels.js';
import { BotInstallationModel } from './botModels.js';

/**
 * A space's apps changed (agentes re-sent a manifest, the commands changed, an
 * app was installed or uninstalled): its members read the «/» list and the
 * directory again at once. José, 23/10, saw /tanques after it was gone: the
 * list was asked once per chat opened. Never awaited by who changed it.
 */
let emit: (userIds: readonly string[], workspaceId: string) => void = emitAppsChanged;

/** Tests listen instead of a socket. */
export function configureAppsAnnounce(listener: (userIds: readonly string[], workspaceId: string) => void): void {
  emit = listener;
}

export async function announceSpaceApps(workspaceId: Types.ObjectId | string): Promise<void> {
  const members = await WorkspaceMemberModel.find({ workspaceId, status: 'active', userId: { $exists: true } }).select('userId').lean();
  emit(members.map((member) => String(member.userId)), String(workspaceId));
}

export async function announceAppChanged(appId: Types.ObjectId | string): Promise<void> {
  const installations = await BotInstallationModel.find({ appId, revokedAt: { $exists: false } }).select('workspaceId').lean();
  await Promise.all(installations.map((installation) => announceSpaceApps(installation.workspaceId)));
}

/** Fire and forget: a failed notice only means the next open reads it. */
export const announceLater = (work: Promise<void>): void => void work.catch((error: unknown) => console.error('[bots] no se pudo avisar el cambio de apps:', error instanceof Error ? error.message : error));
