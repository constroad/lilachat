import { useCallback, useEffect, useState } from 'react';
import { EyeOff, UsersRound } from 'lucide-react';
import { memberCountLabel, workspacesOf, type ClientWorkspace } from '@lilachat/shared';
import { incognitoSpaces } from './spacesApi';

const ROW = 'flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-background';

type Listing = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; spaces: ClientWorkspace[] };

/** The spaces where he is hidden, read each time the row opens (the list is short and rarely read). */
function useIncognitoList(jwt: string, open: boolean): { listing: Listing; retry: () => void } {
  const [listing, setListing] = useState<Listing>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setListing({ state: 'loading' });
    void incognitoSpaces(jwt).then((response) => {
      if (!alive) return;
      const spaces = response.ok ? workspacesOf(response.data) : null;
      setListing(spaces ? { state: 'ready', spaces } : { state: 'failed' });
    });
    return () => {
      alive = false;
    };
  }, [jwt, open, attempt]);
  return { listing, retry: useCallback(() => setAttempt((count) => count + 1), []) };
}

function IncognitoList(props: { listing: Listing; onRetry: () => void; onEnter: (spaceId: string) => void }) {
  const { listing } = props;
  if (listing.state === 'loading') return <div data-testid="incognitos-cargando" className="mx-3 mb-2 h-11 animate-pulse rounded-lg bg-background" />;
  if (listing.state === 'failed') {
    return (
      <div role="alert" className="mx-3 mb-2 flex items-center gap-2 text-xs text-error">
        <span className="min-w-0 flex-1">No se pudo cargar la lista.</span>
        <button type="button" data-testid="incognitos-reintentar" onClick={props.onRetry} className="rounded-full border border-error/30 px-3 py-1 font-semibold">Reintentar</button>
      </div>
    );
  }
  if (listing.spaces.length === 0) return <p data-testid="incognitos-vacio" className="mx-3 mb-2 text-xs text-on-surface-variant">No estás oculto en ningún espacio.</p>;
  return (
    <ul data-testid="lista-incognitos" className="mb-1 ml-5 border-l border-outline/15 pl-3">
      {listing.spaces.map((space) => (
        <li key={space.id} className="flex min-h-[44px] items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{space.name}</p>
            <p className="text-[11px] text-on-surface-variant">{memberCountLabel(space.members)} · solo lees</p>
          </div>
          <button type="button" data-testid={`entrar-incognito-${space.id}`} onClick={() => props.onEnter(space.id)} className="rounded-full border border-outline/20 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-background">Entrar</button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Ajustes → Superadmin (José 13/11): the users panel, and «Ver incógnitos», the spaces where he is
 * hidden. The space switcher does not list those: he enters them from here, and only reads there.
 */
export function SuperadminSettings(props: { jwt: string; onEnter: (spaceId: string) => void }) {
  const [open, setOpen] = useState(false);
  const { listing, retry } = useIncognitoList(props.jwt, open);
  return (
    <div data-testid="ajustes-superadmin" className="mt-1 border-t border-outline/10 pt-1">
      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Superadmin</p>
      <a href="/admin" data-testid="btn-usuarios-lilachat" className={ROW}>
        <UsersRound size={16} />
        Usuarios de Lilachat
      </a>
      <button type="button" data-testid="btn-incognitos" aria-expanded={open} onClick={() => setOpen((was) => !was)} className={ROW}>
        <EyeOff size={16} />
        <span className="min-w-0 flex-1">Ver incógnitos</span>
      </button>
      {open ? <IncognitoList listing={listing} onRetry={retry} onEnter={props.onEnter} /> : null}
    </div>
  );
}
