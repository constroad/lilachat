import { Loader2, MessageCircle } from 'lucide-react';
import { formatPhoneDisplay, type CardPerson } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { Overlay } from '../../ui/Overlay';

const AVATAR_SIZE = 88;

/**
 * A person's card (José, 25/10/2026): their photo and name from a chat, a group or the
 * member list, and «Enviar mensaje» when there is a 1:1 to open. Nothing is offered
 * when there is nobody to write to (an app with no 1:1 in this space).
 */
export function PersonCardDialog(props: { person: CardPerson; canWrite: boolean; checking: boolean; busy: boolean; error: string | null; onWrite: () => void; onClose: () => void }) {
  const { person } = props;
  return (
    <Overlay title={person.isApp ? 'App' : 'Contacto'} onClose={props.onClose}>
      <div className="flex flex-col items-center text-center">
        <Avatar name={person.name} foto={person.avatarUrl ?? undefined} size={AVATAR_SIZE} bot={person.isApp} />
        <h3 data-testid="persona-nombre" className="mt-3 text-xl font-bold tracking-tight">{person.name}</h3>
        {person.badge ? <span data-testid="persona-insignia" className="mt-1.5 rounded-full border border-primary/30 bg-primary/[0.08] px-3 py-0.5 text-[12px] font-semibold text-primary">{person.badge}</span> : null}
        {person.phone ? <p data-testid="persona-telefono" className="mt-2 text-sm text-on-surface-variant">{formatPhoneDisplay(person.phone) || person.phone}</p> : null}
        {props.error ? <p data-testid="persona-error" role="alert" className="mt-3 text-[13px] text-error">{props.error}</p> : null}
        {props.checking ? (
          <Loader2 data-testid="persona-verificando" size={20} className="mt-5 animate-spin text-primary" aria-label="Comprobando" />
        ) : props.canWrite ? (
          <button type="button" data-testid="persona-enviar-mensaje" disabled={props.busy} onClick={props.onWrite} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-on-primary disabled:opacity-60">
            {props.busy ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
            Enviar mensaje
          </button>
        ) : null}
      </div>
    </Overlay>
  );
}
