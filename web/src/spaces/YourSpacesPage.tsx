import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, CirclePlus, RectangleEllipsis } from 'lucide-react';
import { invitedByLine, membersLabel, owesItsName, spacesToOpen, type ClientWorkspace, type MyProfile, type SpaceInvitation } from '@lilachat/shared';
import type { Credential } from '../api';
import { CreateUserPage } from '../profile/CreateUserPage';
import { Logo } from '../ui/Logo';
import { CreateSpaceDialog } from './CreateSpaceDialog';
import { setCurrentSpaceId } from './currentSpace';
import { JoinSpaceDialog } from './JoinSpaceDialog';
import { SpaceLogo } from './SpaceLogo';
import { acceptSpaceInvitation, mySpaces, spaceInvitations } from './spacesApi';
import { markWelcomeSeen } from './welcomeSeen';

type EnteredSpace = { name: string; logoUrl?: string };
type Lists = { spaces: ClientWorkspace[]; invitations: SpaceInvitation[] };
type Naming = { space: EnteredSpace; next: () => void };

const LOAD_ERROR = 'No se pudieron cargar tus espacios.';

/**
 * «Tus espacios de trabajo» on the web (design `i-03-tus-espacios`). A new account
 * writes its name BEFORE accepting, so the space hears «Ana se unió».
 */
export function YourSpacesPage(props: { credential: Credential; account: string; onEnter: (credential: Credential) => void }) {
  const { credential, onEnter } = props;
  const jwt = credential.jwt;
  const [lists, setLists] = useState<Lists | null>(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<'join' | 'create' | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [naming, setNaming] = useState<Naming | null>(null);
  const ownName = useRef(credential.name);

  const load = useCallback(async () => {
    setError('');
    const [spaces, invitations] = await Promise.all([mySpaces(jwt), spaceInvitations(jwt)]);
    if (spaces.ok && invitations.ok) setLists({ spaces: spacesToOpen(spaces.data.workspaces), invitations: invitations.data.invitations });
    else setError(LOAD_ERROR);
  }, [jwt]);
  useEffect(() => {
    void load();
  }, [load]);

  const leave = useCallback((spaceId: string | null) => {
    markWelcomeSeen();
    setCurrentSpaceId(spaceId);
    onEnter({ ...credential, name: ownName.current });
  }, [credential, onEnter]);

  const afterName = (space: EnteredSpace, next: () => void) => (owesItsName(credential) ? setNaming({ space, next }) : next());

  const accept = async (invitation: SpaceInvitation) => {
    setAccepting(invitation.id);
    setError('');
    const response = await acceptSpaceInvitation(jwt, invitation.id);
    setAccepting(null);
    if (response.ok) return leave(response.data.workspaceId);
    setError(response.message);
    void load();
  };

  if (naming) {
    const finish = (profile: MyProfile) => {
      ownName.current = profile.name ?? undefined;
      setNaming(null);
      naming.next();
    };
    return <CreateUserPage jwt={jwt} email={props.account} space={naming.space} onDone={finish} />;
  }

  return (
    <main className="grid min-h-full place-items-center px-4" data-testid="pantalla-tus-espacios">
      <div className="w-full max-w-md py-8">
        <div className="flex items-center gap-2"><Logo size={28} /><span className="text-[15px] font-bold">Lilachat</span></div>
        <h1 className="mt-6 text-[26px] font-bold leading-8 tracking-tight">Tus espacios de trabajo</h1>
        <p className="mt-1 text-[15px] text-on-surface-variant">{props.account}</p>
        {error ? <button type="button" data-testid="error-espacios" onClick={() => void load()} className="mt-4 block text-left text-sm text-error">{error}{error === LOAD_ERROR ? ' Reintentar' : ''}</button> : null}
        {lists ? <SpaceLists lists={lists} accepting={accepting} onOpen={(space) => afterName(space, () => leave(space.id))} onJoin={(invitation) => afterName(invitation.workspace, () => void accept(invitation))} /> : null}
        <div className="mt-6 border-t border-outline/20 pt-2">
          <LinkRow testId="btn-unirme-codigo" title="Unirme con un código" icon={<RectangleEllipsis size={22} />} onClick={() => setSheet('join')} />
          <LinkRow testId="btn-crear-espacio-ingreso" title="Crear un espacio" icon={<CirclePlus size={22} />} onClick={() => setSheet('create')} />
        </div>
        <button type="button" data-testid="btn-sin-espacio" onClick={() => leave(null)} className="mt-6 w-full py-2 text-sm text-on-surface-variant hover:underline">Usar sin espacio de trabajo</button>
      </div>
      {sheet === 'join' ? <JoinSpaceDialog jwt={jwt} onJoined={leave} onClose={() => setSheet(null)} /> : null}
      {sheet === 'create' ? <CreateSpaceDialog jwt={jwt} onCreated={(space) => afterName(space, () => leave(space.id))} onJoinInstead={() => setSheet('join')} onClose={() => setSheet(null)} /> : null}
    </main>
  );
}

function SpaceLists(props: { lists: Lists; accepting: string | null; onOpen: (space: ClientWorkspace) => void; onJoin: (invitation: SpaceInvitation) => void }) {
  const { spaces, invitations } = props.lists;
  return (
    <>
      {spaces.length ? (
        <Section title="Tus espacios">
          {spaces.map((space) => (
            <SpaceCard key={space.id} space={space} subtitle={membersLabel(space.members)}>
              <button type="button" data-testid={`abrir-espacio-${space.id}`} onClick={() => props.onOpen(space)} className="h-10 rounded-lg border border-outline/30 px-4 text-sm font-semibold hover:bg-surface-variant/50">Abrir</button>
            </SpaceCard>
          ))}
        </Section>
      ) : null}
      {invitations.length ? (
        <Section title="Invitaciones">
          {invitations.map((invitation) => (
            <SpaceCard key={invitation.id} space={invitation.workspace} subtitle={invitedByLine(invitation)}>
              <button type="button" data-testid={`unirme-espacio-${invitation.id}`} disabled={props.accepting !== null} onClick={() => props.onJoin(invitation)} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary disabled:opacity-50">Unirme</button>
            </SpaceCard>
          ))}
        </Section>
      ) : null}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 flex flex-col gap-3">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">{title}</h2>
      {children}
    </section>
  );
}

function SpaceCard({ space, subtitle, children }: { space: EnteredSpace; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-outline/20 bg-surface p-4">
      <SpaceLogo space={space} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold">{space.name}</p>
        <p className="truncate text-[13px] text-on-surface-variant">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function LinkRow(props: { testId: string; title: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" data-testid={props.testId} onClick={props.onClick} className="flex min-h-[52px] w-full items-center gap-3 text-left text-[15px] hover:text-primary">
      <span className="text-on-surface-variant">{props.icon}</span>
      <span className="min-w-0 flex-1">{props.title}</span>
      <ChevronRight size={18} className="text-outline" />
    </button>
  );
}
