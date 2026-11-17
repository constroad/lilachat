import { overdueOf, type FollowUpItem, type ProspectView } from './prospectBoard.js';
import { overdueLabelOf } from './prospectPlan.js';
import { nextActionLineOf } from './prospectSheet.js';

/**
 * «Seguimientos de hoy» (dl-05), what each card says: the late ones apart, why each one is here, who attends it, and
 * whether the seller is about to throw away a draft they edited. Dali proposes, the seller approves: a draft leaves
 * only with their OK. The web's sheet and the APK's screen draw the same. PURE.
 */

export type FollowUpGroup = { key: 'late' | 'today'; title: string; followUps: FollowUpItem[] };
export type FollowUpReason = { text: string; late: boolean; icon: 'overdue' | 'action' | 'draft' };

/** «Atrasados» (past their hour) first, then «Para hoy»; an empty group is not drawn. */
export function followUpGroupsOf(followUps: readonly FollowUpItem[], now: Date): FollowUpGroup[] {
  const late = followUps.filter((followUp) => Date.parse(followUp.at) < now.getTime());
  const today = followUps.filter((followUp) => Date.parse(followUp.at) >= now.getTime());
  const groups: FollowUpGroup[] = [
    { key: 'late', title: `Atrasados · ${late.length}`, followUps: late },
    { key: 'today', title: `Para hoy · ${today.length}`, followUps: today },
  ];
  return groups.filter((group) => group.followUps.length > 0);
}

/** Why it is here: the next action that is due, else what is late on it, else Dali's proposal for today. */
export function followUpReasonOf(followUp: FollowUpItem, now: Date): FollowUpReason {
  const { prospect } = followUp;
  const overdue = overdueOf(prospect, now);
  const action = followUp.kind === 'action' ? prospect.nextAction : undefined;
  if (action) return { text: nextActionLineOf(action, now), late: Boolean(overdue), icon: 'action' };
  if (overdue) return { text: overdueLabelOf(overdue, now), late: true, icon: 'overdue' };
  return { text: 'Dali propone escribirle hoy', late: false, icon: 'draft' };
}

/** A draft card while Dali still has its text (sent or withdrawn, the card keeps only its next action). */
export const isDraftFollowUp = (followUp: FollowUpItem): boolean => followUp.kind === 'draft' && Boolean(followUp.prospect.followUpDraft);

/** «Atiende Rosa»: the first name of whoever took it. */
export const attendantLineOf = (prospect: Pick<ProspectView, 'assignee'>): string | null =>
  prospect.assignee ? `Atiende ${prospect.assignee.name.trim().split(/\s+/)[0] ?? prospect.assignee.name}` : null;

/** Leaving would throw away a draft the seller changed (by prospect id, among the follow-ups still on screen). */
export function hasUnsentEdits(followUps: readonly FollowUpItem[], edits: Readonly<Record<string, string>>): boolean {
  return followUps.some((followUp) => {
    const edit = edits[followUp.prospect.id];
    return isDraftFollowUp(followUp) && edit !== undefined && edit.trim() !== (followUp.prospect.followUpDraft?.text ?? '').trim();
  });
}
