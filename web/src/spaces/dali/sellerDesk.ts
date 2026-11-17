import { useCallback, useEffect, useState } from 'react';
import type { LossReason, NextActionKind, ProspectOutcome, ProspectView } from '@lilachat/shared';
import { approveFollowUp, changeProspect, fetchProspectOfChat, handBackToDali } from './prospectsApi';
import { echoProspect, useProspectEcho } from './prospectEcho';
import { useProspectsPulse } from './useProspects';

/** What a seller decides (BOTS-API «Fase 2: contrato»), as the PATCH takes it. */
export type SellerPatch = {
  assignee?: 'me' | { id: string } | null;
  next_action?: { kind: NextActionKind; at: string; assignee_id?: string; note?: string; remind: boolean } | null;
  result?: { outcome: ProspectOutcome; reason?: LossReason; note?: string } | null;
};

export type ChangeOutcome = { ok: true; prospect: ProspectView } | { ok: false; stale: boolean; message: string };

const STALE_STATUS = 409;
export const STALE_MESSAGE = 'Alguien lo cambió antes que tú. Ya ves lo último: revísalo y vuelve a intentarlo.';

function outcomeOf(answer: Awaited<ReturnType<typeof changeProspect>>): ChangeOutcome {
  if (answer.ok) {
    echoProspect(answer.data.prospect);
    return { ok: true, prospect: answer.data.prospect };
  }
  const stale = answer.status === STALE_STATUS;
  return { ok: false, stale, message: stale ? STALE_MESSAGE : answer.message };
}

/** Every change goes with the version the seller saw: if someone was first, the server says so and nothing changes. */
export const sendChange = async (jwt: string, spaceId: string, prospect: ProspectView, patch: SellerPatch): Promise<ChangeOutcome> =>
  outcomeOf(await changeProspect(jwt, spaceId, prospect.id, { version: prospect.version, ...patch }));

export const sendFollowUp = async (jwt: string, spaceId: string, prospect: ProspectView, text: string): Promise<ChangeOutcome> =>
  outcomeOf(await approveFollowUp(jwt, spaceId, prospect.id, prospect.version, text));

export const sendHandBack = async (jwt: string, spaceId: string, prospect: ProspectView): Promise<ChangeOutcome> =>
  outcomeOf(await handBackToDali(jwt, spaceId, prospect.id, prospect.version));

/**
 * The prospect of an open channel, read by its chat (the strip and the ficha); `null` for a chat that is not a
 * prospect's, or while it loads. Read again when a prospect of the space changes.
 */
export function useProspectOfChat(jwt: string, spaceId: string, chatId: string | null) {
  const [prospect, setProspect] = useState<ProspectView | null>(null);
  const [round, setRound] = useState(0);
  const reload = useCallback(() => setRound((value) => value + 1), []);
  useEffect(() => {
    setProspect(null);
  }, [chatId]);
  useEffect(() => {
    if (!chatId) return;
    const controller = new AbortController();
    void fetchProspectOfChat(jwt, spaceId, chatId, controller.signal).then((answer) => {
      if (!controller.signal.aborted && answer.ok) setProspect(answer.data.prospect);
    });
    return () => controller.abort();
  }, [jwt, spaceId, chatId, round]);
  useProspectsPulse(spaceId, reload);
  useProspectEcho(useCallback((changed: ProspectView) => setProspect((current) => (current?.id === changed.id ? changed : current)), []));
  return { prospect, setProspect, reload };
}
