import { isSiteVisitShortcut, visitDraftResultOf, type CommandOutcome, type ShortcutRow } from '@lilachat/shared';
import type { JsonResult } from '../../api/jsonCall';
import type { useAppAnswers } from '../../chat/commands/useAppAnswers';
import { devicePlaceNow } from '../clients/reports/devicePlace';
import { askVisitDraft, openVisitForm, type VisitAskRef } from './visitsApi';

type Track = ReturnType<typeof useAppAnswers>['track'];

/**
 * A new visit from the space's ⚡ (José 20/11, as the web's): its draft is read first (Portal keeps it),
 * then «Datos» opens where the phone is. Saving it makes Portal publish its card lv01 in «Informes»,
 * whose buttons open the visit's screen in that chat: the screen needs a chat for its stamped photos.
 */
export async function startSpaceVisit(ref: VisitAskRef): Promise<JsonResult<CommandOutcome>> {
  const draft = visitDraftResultOf(await askVisitDraft(ref, null));
  if (!draft.ok) return { ok: false, message: draft.message };
  const place = await devicePlaceNow();
  const where = place.lat !== undefined && place.lng !== undefined ? { lat: place.lat, lng: place.lng } : {};
  return openVisitForm(ref, { kind: 'section', section: 'datos', ...where });
}

/**
 * «Visita técnica» from the space's ⚡: the visit itself, never the app's shortcut (Portal only answers
 * «se abre en su pantalla de Lilachat»). Any other row answers null and runs as always.
 */
export function runVisitShortcut(row: ShortcutRow, ref: VisitAskRef, track: Track): Promise<boolean> | null {
  if (!isSiteVisitShortcut(row)) return null;
  return track({ appName: row.appName, command: '', action: row.name, ...(row.avatarUrl ? { avatarUrl: row.avatarUrl } : {}) }, () => startSpaceVisit(ref));
}
