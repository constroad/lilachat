import { useEffect, useState } from 'react';
import { Ban } from 'lucide-react';
import { blockActionLabel, blockConfirmText } from '@lilachat/shared';
import { blockPerson, unblockPerson } from './blockedApi';

/** «Bloquear a …» in a 1:1's info (pending 9): blocking asks first, unblocking does not. */
export function BlockContactRow(props: { jwt: string; personId: string; name: string; blockedByMe: boolean; onNotice: (text: string) => void }) {
  const [blocked, setBlocked] = useState(props.blockedByMe);
  const [busy, setBusy] = useState(false);
  useEffect(() => setBlocked(props.blockedByMe), [props.blockedByMe]);
  const toggle = async () => {
    if (!blocked && !window.confirm(blockConfirmText(props.name))) return;
    setBusy(true);
    const outcome = blocked ? await unblockPerson(props.jwt, props.personId) : await blockPerson(props.jwt, props.personId);
    setBusy(false);
    if (outcome.ok) setBlocked(!blocked);
    else props.onNotice(outcome.message);
  };
  return (
    <section className="mt-2 bg-surface px-6 py-2">
      <button type="button" data-testid="btn-bloquear-contacto" disabled={busy} onClick={() => void toggle()} className={`flex min-h-[48px] w-full items-center gap-3 text-left text-[15px] font-semibold ${blocked ? 'text-primary' : 'text-error'}`}>
        <Ban size={18} />
        {blockActionLabel(blocked, props.name)}
      </button>
    </section>
  );
}
