import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Ban, Flag } from 'lucide-react';
import { REPORT_ACTION_LABEL, blockActionLabel, blockConfirmText, watchBlockedPerson, type CardPerson } from '@lilachat/shared';
import { blockPerson, listBlockedPeople, unblockPerson } from '../privacy/blockedApi';
import { ReportDialog } from './ReportDialog';

type Safety = { actions: ReactNode; dialog: ReactNode; reporting: boolean };

/**
 * «Denunciar» and «Bloquear» on a person's card (Google Play, José 19/11): from a 1:1
 * and from a member of a group or a channel. Never for an app. Whether they are
 * blocked is read once when the card opens; blocking asks first, unblocking does not.
 */
export function usePersonSafety(params: { jwt: string; person: CardPerson | null; chatId?: string; onError: (text: string) => void }): Safety {
  const { jwt, person, chatId, onError } = params;
  const personId = person && !person.isApp ? person.userId : null; // gates-allow: duplicate (React state twin of web/app; shared has no React, logic lives in watchBlockedPerson)
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    setBlocked(false);
    setReporting(false);
    if (!personId) return;
    return watchBlockedPerson(() => listBlockedPeople(jwt), personId, setBlocked);
  }, [jwt, personId]);

  const toggleBlock = useCallback(async () => {
    if (!personId || !person || busy) return;
    if (!blocked && !window.confirm(blockConfirmText(person.name))) return;
    setBusy(true);
    const outcome = blocked ? await unblockPerson(jwt, personId) : await blockPerson(jwt, personId);
    setBusy(false);
    if (outcome.ok) setBlocked(!blocked);
    else onError(outcome.message);
  }, [personId, person, busy, blocked, jwt, onError]);

  if (!personId || !person) return { actions: null, dialog: null, reporting: false };
  const row = 'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border text-sm font-semibold disabled:opacity-60';
  const actions = (
    <div className="mt-3 grid w-full grid-cols-2 gap-2">
      <button type="button" data-testid="persona-denunciar" onClick={() => setReporting(true)} className={`${row} border-error/30 text-error`}>
        <Flag size={16} />
        {REPORT_ACTION_LABEL}
      </button>
      <button type="button" data-testid="persona-bloquear" disabled={busy} onClick={() => void toggleBlock()} className={`${row} ${blocked ? 'border-primary/30 text-primary' : 'border-error/30 text-error'}`}>
        <Ban size={16} />
        <span className="truncate">{blockActionLabel(blocked, person.name)}</span>
      </button>
    </div>
  );
  const subject = { target: 'user' as const, userId: personId, ...(chatId ? { chatId } : {}) };
  const dialog = reporting ? <ReportDialog jwt={jwt} subject={subject} personName={person.name} onClose={() => setReporting(false)} onBlocked={() => setBlocked(true)} /> : null;
  return { actions, dialog, reporting };
}
