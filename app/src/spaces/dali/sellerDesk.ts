import { useCallback, useEffect, useState } from 'react';
import { changeOutcomeOf, type ChangeAnswer, type ChangeOutcome, type ProspectView, type SellerPatch } from '@lilachat/shared';
import { approveFollowUp, changeProspect, fetchProspectOfChat, handBackToDali } from './prospectsApi';
import { echoProspect, useProspectEcho } from './prospectEcho';
import { useProspectsPulse } from './useProspects';

/** A change that took shows at once everywhere it is on screen (the strip, the ficha, the inbox). */
function settled(answer: ChangeAnswer): ChangeOutcome {
  const outcome = changeOutcomeOf(answer);
  if (outcome.ok) echoProspect(outcome.prospect);
  return outcome;
}

/** Every change goes with the version the seller saw: if someone was first, the server says so and nothing changes. */
export const sendChange = async (jwt: string, spaceId: string, prospect: ProspectView, patch: SellerPatch): Promise<ChangeOutcome> =>
  settled(await changeProspect(jwt, spaceId, prospect.id, { version: prospect.version, ...patch }));
export const sendFollowUp = async (jwt: string, spaceId: string, prospect: ProspectView, text: string): Promise<ChangeOutcome> =>
  settled(await approveFollowUp(jwt, spaceId, prospect.id, prospect.version, text));
export const sendHandBack = async (jwt: string, spaceId: string, prospect: ProspectView): Promise<ChangeOutcome> =>
  settled(await handBackToDali(jwt, spaceId, prospect.id, prospect.version));

/**
 * The prospect of an open channel, read by its chat (the strip and the ficha); `null` for a chat that is not a
 * prospect's, or while it loads. Read again when a prospect of the space changes.
 */
export function useProspectOfChat(jwt: string, spaceId: string | undefined, chatId: string, enabled: boolean) {
  const [prospect, setProspect] = useState<ProspectView | null>(null);
  const [round, setRound] = useState(0);
  const reload = useCallback(() => setRound((value) => value + 1), []);
  useEffect(() => {
    setProspect(null);
  }, [chatId]);
  useEffect(() => {
    if (!enabled || !spaceId) return;
    let alive = true;
    void fetchProspectOfChat(jwt, spaceId, chatId).then((answer) => {
      if (alive && answer.ok) setProspect(answer.data.prospect);
    });
    return () => {
      alive = false;
    };
  }, [jwt, spaceId, chatId, enabled, round]);
  useProspectsPulse(jwt, enabled && spaceId ? spaceId : '', reload);
  useProspectEcho(useCallback((changed: ProspectView) => setProspect((current) => (current?.id === changed.id ? changed : current)), []));
  return { prospect, setProspect, reload };
}
