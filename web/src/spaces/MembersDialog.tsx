import { useRef, useState } from 'react';
import { useDismiss } from '../ui/useDismiss';
import { MoreVertical, Search, UserPlus, X } from 'lucide-react';
import { changeForAction, filterMembers, formatPhoneDisplay, memberActions, type ClientWorkspace, type ClientWorkspaceMember, type MemberAction } from '@lilachat/shared';
import { FieldError, Overlay } from '../ui/Overlay';
import { MemberAvatar, memberLine, memberName, OnlinePill, RolePill } from './memberWeb';
import { RequestCard } from './RequestCard';
import { changeMember, rejectRequest, revokeSpaceInvite, spaceMembers } from './spacesApi';
import { dataOf, memberListsCache, useCached } from './spaceCache';

export type MembersTab = 'active' | 'pending' | 'invited' | 'deactivated';
const TABS: { key: MembersTab; label: string; testId: string }[] = [
  { key: 'active', label: 'Activos', testId: 'tab-activos' },
  { key: 'pending', label: 'Pendientes', testId: 'tab-pendientes' },
  { key: 'invited', label: 'Invitados', testId: 'tab-invitados' },
  { key: 'deactivated', label: 'Desactivados', testId: 'tab-desactivados' },
];
const ACTION_LABELS: Record<MemberAction, string> = { 'make-admin': 'Hacer admin', 'make-member': 'Cambiar a miembro', 'make-guest': 'Cambiar a invitado', deactivate: 'Desactivar', reactivate: 'Reactivar' };

/**
 * «Miembros y roles» (design `e1-10-miembros-roles`), for admins: Activos ·
 * Pendientes · Desactivados with their counts; each person with their role and
 * a ⋮ to change it, deactivate or reactivate; the pending ones as request
 * cards to approve with an area and title (design `e1-11-solicitudes`).
 */
export function MembersDialog(props: { space: ClientWorkspace; jwt: string; myUserId: string; online: ReadonlySet<string>; initialTab: MembersTab; onInvite: () => void; onChanged: () => void; onClose: () => void }) {
  const { space, jwt } = props;
  const [tab, setTab] = useState<MembersTab>(props.initialTab);
  const [query, setQuery] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  // The ⋮ menu of a member closes with a click beside it or Escape (José, 21/10).
  const memberMenu = useRef<HTMLDivElement>(null);
  useDismiss(menuFor !== null, memberMenu, () => setMenuFor(null), { ignore: '[data-testid^="acciones-"]' });
  const [busy, setBusy] = useState(false);
  const [actionError, setError] = useState('');
  // The four lists paint at once from what was seen and refresh behind (22/10).
  const cached = useCached(memberListsCache, `${space.id}:member-lists`, async (): Promise<Record<MembersTab, ClientWorkspaceMember[]>> => {
    const [active, pending, invited, deactivated] = await Promise.all([spaceMembers(jwt, space.id, 'active'), spaceMembers(jwt, space.id, 'pending'), spaceMembers(jwt, space.id, 'invited'), spaceMembers(jwt, space.id, 'deactivated')]);
    return { active: dataOf(active).members, pending: dataOf(pending).members, invited: dataOf(invited).members, deactivated: dataOf(deactivated).members };
  });
  const lists = cached.value ?? null;
  const error = actionError || (lists ? '' : (cached.error ?? ''));
  const after = async (work: Promise<{ ok: boolean; message?: string }>) => {
    setBusy(true);
    const response = await work;
    setBusy(false);
    if (!response.ok) return setError(response.message ?? 'No se pudo guardar.');
    setError('');
    props.onChanged();
    cached.refresh();
  };
  const runAction = (member: ClientWorkspaceMember, action: MemberAction) => {
    setMenuFor(null);
    if (action === 'deactivate' && !window.confirm(`¿Desactivar a ${memberName(member)}? Deja de ver los canales y chats del espacio. Sus chats personales siguen igual.`)) return;
    void after(changeMember(jwt, space.id, member.id, changeForAction(action)));
  };
  const me = lists?.active.find((member) => member.userId === props.myUserId);
  const shown = filterMembers(lists?.[tab] ?? [], { query, area: null });

  return (
    <Overlay title={`Miembros de ${space.name}`} onClose={props.onClose} wide>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Gestión de accesos</p>
          <h3 className="text-2xl font-bold tracking-tight">{tab === 'pending' ? 'Solicitudes para entrar' : 'Miembros y roles'}</h3>
        </div>
        <button type="button" data-testid="miembros-invitar" onClick={props.onInvite} className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-on-primary"><UserPlus size={16} /> Invitar</button>
      </div>
      <div role="tablist" className="mt-4 flex rounded-xl border border-outline/20 p-1">
        {TABS.map(({ key, label, testId }) => (
          <button key={key} type="button" role="tab" data-testid={testId} aria-selected={tab === key} onClick={() => setTab(key)} className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold ${tab === key ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-background'}`}>
            {label}<span className="rounded-full bg-surface-variant px-1.5 text-[11px]">{lists?.[key].length ?? '·'}</span>
          </button>
        ))}
      </div>
      {tab === 'pending' ? (
        <p className="mt-3 text-sm text-on-surface-variant">{`Quienes entraron con el código de ${space.name} y esperan tu aprobación para ver los canales.`}</p>
      ) : (
        <label className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-outline/20 bg-background px-3">
          <Search size={16} className="text-on-surface-variant" />
          <input data-testid="buscar-miembros" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, cargo o teléfono" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
      )}
      <FieldError>{error}</FieldError>
      {lists === null && !error ? [0, 1, 2].map((index) => <div key={index} className="mt-3 h-16 animate-pulse rounded-xl bg-background" />) : null}
      {lists !== null && shown.length === 0 ? <p className="mt-6 text-center text-sm text-on-surface-variant">{tab === 'pending' ? 'No hay solicitudes por aprobar.' : tab === 'deactivated' ? 'Nadie está desactivado.' : tab === 'invited' ? 'No hay invitaciones esperando.' : 'Nadie coincide con la búsqueda.'}</p> : null}
      {tab === 'pending'
        ? shown.map((request) => <RequestCard key={request.id} request={request} spaceName={space.name} code={space.joinCode} busy={busy} onApprove={(area, title) => void after(changeMember(jwt, space.id, request.id, { status: 'active', area, title }))} onReject={() => void after(rejectRequest(jwt, space.id, request.id))} />)
        : shown.map((member) => {
            // An email invitation (22/10) is not a member yet: it can only be withdrawn.
            const byEmail = !member.phone && Boolean(member.email);
            const actions = me && !byEmail && member.userId !== props.myUserId ? memberActions({ actor: me.role, target: member }) : [];
            const isOnline = Boolean(member.userId && props.online.has(member.userId));
            return (
              <div key={member.id} data-testid={`fila-miembro-${member.phone ?? member.email}`} className="relative mt-3 flex items-center gap-3 rounded-xl border border-outline/15 p-3">
                <MemberAvatar member={member} size={44} online={isOnline} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{memberName(member)}{member.userId === props.myUserId ? ' (Tú)' : ''}</p>
                  {memberLine(member) ? <p className="truncate text-[13px] text-on-surface-variant">{memberLine(member)}</p> : null}
                  <p className="font-mono text-[13px]">{byEmail ? 'Invitado por correo' : formatPhoneDisplay(member.phone)}</p>
                </div>
                <div className="flex flex-col items-end gap-1"><RolePill role={member.role} />{isOnline ? <OnlinePill /> : null}</div>
                {byEmail ? (
                  <button type="button" data-testid={`retirar-${member.email}`} aria-label={`Retirar la invitación de ${member.email}`} title="Retirar invitación" onClick={() => void after(revokeSpaceInvite(jwt, space.id, member.id))} className="grid h-10 w-10 place-items-center rounded-lg text-on-surface-variant hover:bg-background"><X size={18} /></button>
                ) : null}
                {actions.length ? (
                  <button type="button" data-testid={`acciones-${member.phone}`} aria-label={`Cambiar rol o acceso de ${memberName(member)}`} aria-expanded={menuFor === member.id} onClick={() => setMenuFor(menuFor === member.id ? null : member.id)} className="grid h-10 w-8 place-items-center rounded-lg text-on-surface-variant hover:bg-background"><MoreVertical size={18} /></button>
                ) : null}
                {menuFor === member.id ? (
                  <div ref={memberMenu} data-testid="menu-acciones-miembro" role="menu" className="absolute right-3 top-14 z-10 w-56 rounded-xl border border-outline/15 bg-surface p-1.5 shadow-lg">
                    <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Cambiar rol o acceso</p>
                    {actions.map((action) => (
                      <button key={action} type="button" role="menuitem" onClick={() => runAction(member, action)} className={`flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-background ${action === 'deactivate' ? 'text-error' : ''}`}>{ACTION_LABELS[action]}</button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
    </Overlay>
  );
}
