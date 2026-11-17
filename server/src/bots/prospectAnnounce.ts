import type { Types } from 'mongoose';
import { emitProspectsChanged } from '../reparto.js';
import { WorkspaceMemberModel } from '../workspaceModels.js';

/**
 * A Dali prospect changed (agentes' PUT, a seller's decision, the first person who answered): the space's active
 * members read their inbox again at once, so nobody takes a prospect someone already took (BOTS-API fase 2). It says
 * that something changed, not what: the inbox reads the list again, which is simpler to keep right than a diff.
 */
let emit: (userIds: readonly string[], workspaceId: string) => void = emitProspectsChanged;

/** Tests listen instead of a socket. */
export function configureProspectsAnnounce(listener: (userIds: readonly string[], workspaceId: string) => void): void {
  emit = listener;
}

/** Fire and forget: a lost notice only means the inbox reads it on the next change or when it opens. */
export function announceProspects(workspaceId: Types.ObjectId | string): void {
  void WorkspaceMemberModel.find({ workspaceId, status: 'active', userId: { $exists: true } })
    .select('userId')
    .lean()
    .then((members) => emit(members.map((member) => String(member.userId)), String(workspaceId)))
    .catch((error: unknown) => console.error('[prospectos] no se pudo avisar el cambio:', error instanceof Error ? error.message : error));
}
