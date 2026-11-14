import { isSiteVisitShortcut, type ShortcutRow } from '@lilachat/shared';
import type { useAppAnswers } from '../../chat/commands/useAppAnswers';
import { devicePlaceNow } from '../clients/reports/devicePlace';
import { startVisit, type VisitPlaceRef } from './visitsApi';

type Track = ReturnType<typeof useAppAnswers>['track'];

/**
 * «Visita técnica» from the ⚡ or the «+» (José 14/11): it opens the visit's own «Datos» where the browser
 * is, never the app's shortcut. Any other row answers null and runs as always.
 */
export function runVisitShortcut(row: ShortcutRow, place: VisitPlaceRef | null, track: Track): Promise<boolean> | null {
  if (!isSiteVisitShortcut(row) || !place) return null;
  return track({ appName: row.appName, command: '', action: row.name, ...(row.avatarUrl ? { avatarUrl: row.avatarUrl } : {}) }, async () => startVisit(place, await devicePlaceNow()));
}
