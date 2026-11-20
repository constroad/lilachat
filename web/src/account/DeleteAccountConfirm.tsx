import { useState } from 'react';
import { ACCOUNT_DELETION_CONFIRM_WORD, ACCOUNT_DELETION_TEXTS, confirmsAccountDeletion } from '@lilachat/shared';
import { requestAccountDeletion } from './accountDeletionApi';

/**
 * What «Borrar mi cuenta» erases and keeps, and the word typed to confirm it
 * (José 19/11). The same in the settings panel and in `/borrar-cuenta`: the
 * session already proves who it is, the word proves it is meant.
 */
export function DeleteAccountConfirm(props: { jwt: string; onDeleted: (deadline: Date) => void }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = async () => {
    setBusy(true);
    setError('');
    const outcome = await requestAccountDeletion(props.jwt);
    setBusy(false);
    if (outcome.ok) props.onDeleted(outcome.deadline);
    else setError(outcome.message);
  };
  return (
    <div data-testid="confirmar-borrar-cuenta" className="flex flex-col gap-3 text-sm">
      <DeletionExplanation />
      <label className="mt-1 block font-semibold" htmlFor="confirmar-borrar">{ACCOUNT_DELETION_TEXTS.confirmPrompt}</label>
      <input
        id="confirmar-borrar"
        data-testid="input-confirmar-borrar-cuenta"
        autoComplete="off"
        placeholder={ACCOUNT_DELETION_CONFIRM_WORD}
        value={typed}
        onChange={(event) => { setTyped(event.target.value); setError(''); }}
        className="h-11 w-full rounded-lg border border-outline/25 bg-surface px-3 text-base outline-none placeholder:text-on-surface-variant focus:border-error"
      />
      {error ? <p data-testid="error-borrar-cuenta" role="alert" className="text-error">{error}</p> : null}
      <button type="button" data-testid="btn-confirmar-borrar-cuenta" disabled={busy || !confirmsAccountDeletion(typed)} onClick={() => void confirm()} className="h-11 w-full rounded-lg bg-error text-sm font-bold text-background disabled:opacity-40">
        {busy ? 'Borrando…' : ACCOUNT_DELETION_TEXTS.confirmAction}
      </button>
    </div>
  );
}

/** What goes, what stays and when: read before anything is asked. */
export function DeletionExplanation() {
  return (
    <>
      <p className="font-semibold">Se borra:</p>
      <ul className="-mt-1 list-disc space-y-1 pl-5 text-on-surface-variant">
        {ACCOUNT_DELETION_TEXTS.erased.map((line) => <li key={line}>{line}</li>)}
      </ul>
      <p className="font-semibold">Queda:</p>
      <p className="-mt-1 text-on-surface-variant">{ACCOUNT_DELETION_TEXTS.kept}</p>
      <p className="rounded-lg bg-error/5 p-3">{ACCOUNT_DELETION_TEXTS.grace}</p>
    </>
  );
}
