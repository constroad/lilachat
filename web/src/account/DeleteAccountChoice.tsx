import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ACCOUNT_DELETION_TEXTS } from '@lilachat/shared';
import { Overlay } from '../ui/Overlay';
import { DeleteAccountConfirm } from './DeleteAccountConfirm';
import { rememberDeletionDeadline } from './deletionCancelledNotice';

/**
 * «Borrar mi cuenta», the last row of the settings panel (José 19/11). The
 * session dies with the answer, so the web signs out and opens `/borrar-cuenta`
 * on «Tu cuenta se cerró…»: a 401 of the socket would otherwise beat the notice.
 */
export function DeleteAccountChoice(props: { jwt: string; onSignOut: () => void; goTo?: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const deleted = (deadline: Date) => {
    rememberDeletionDeadline(deadline);
    props.onSignOut();
    (props.goTo ?? ((path: string) => window.location.assign(path)))('/borrar-cuenta');
  };
  return (
    <>
      <button type="button" data-testid="btn-borrar-cuenta" onClick={() => setOpen(true)} className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-error hover:bg-error/5">
        <Trash2 size={16} />
        {ACCOUNT_DELETION_TEXTS.title}
      </button>
      {open ? (
        <Overlay title={ACCOUNT_DELETION_TEXTS.title} onClose={() => setOpen(false)}>
          <DeleteAccountConfirm jwt={props.jwt} onDeleted={deleted} />
        </Overlay>
      ) : null}
    </>
  );
}
