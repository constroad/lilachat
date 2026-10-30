import { useState } from 'react';
import { Ban } from 'lucide-react';
import { blockedListEmptyText } from '@lilachat/shared';
import { listBlockedPeople, unblockPerson, type BlockedPerson } from './blockedApi';

/** «Contactos bloqueados» in the settings panel (pending 9): opens in place, read when opened. */
export function BlockedContactsChoice(props: { jwt: string; onNotice: (text: string) => void }) {
  const [people, setPeople] = useState<BlockedPerson[] | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const toggle = async () => {
    if (open) return setOpen(false);
    setOpen(true);
    setPeople(undefined);
    setPeople(await listBlockedPeople(props.jwt));
  };
  const unblock = async (person: BlockedPerson) => {
    const outcome = await unblockPerson(props.jwt, person.id);
    if (outcome.ok) setPeople((current) => current?.filter((one) => one.id !== person.id));
    else props.onNotice(outcome.message);
  };
  return (
    <div>
      <button type="button" data-testid="btn-contactos-bloqueados" aria-expanded={open} onClick={() => void toggle()} className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-background">
        <Ban size={16} />
        <span className="min-w-0 flex-1">Contactos bloqueados</span>
      </button>
      {open ? (
        <div data-testid="lista-bloqueados" className="mb-1 ml-9 mr-2">
          {people === undefined ? <p className="py-2 text-xs text-on-surface-variant">Cargando…</p> : null}
          {people === null ? <p className="py-2 text-xs text-error">No se pudo cargar.</p> : null}
          {people?.length === 0 ? <p className="py-2 text-xs text-on-surface-variant">{blockedListEmptyText}</p> : null}
          {people?.map((person) => (
            <div key={person.id} className="flex min-h-[40px] items-center gap-2 border-t border-outline/10 py-1">
              <span className="min-w-0 flex-1 truncate text-sm">{person.name ?? person.phone}</span>
              <button type="button" data-testid={`btn-desbloquear-${person.id}`} onClick={() => void unblock(person)} className="rounded-full px-2 py-1 text-xs font-semibold text-primary hover:bg-background">
                Desbloquear
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
