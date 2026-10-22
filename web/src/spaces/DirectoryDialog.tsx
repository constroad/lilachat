import { useMemo, useState } from 'react';
import { MessageCircle, Search, UserPlus, Users } from 'lucide-react';
import { directoryAreas, filterMembers, formatPhoneDisplay, membersLabel, type ClientWorkspace, type ClientWorkspaceMember } from '@lilachat/shared';
import { Overlay } from '../ui/Overlay';
import { MemberAvatar, memberLine, memberName, OnlinePill } from './memberWeb';
import { fetchMembers, membersCache, useCached } from './spaceCache';

/**
 * «Directorio» of a space (design `e1-08-directorio`): its active people,
 * searched by name, title, area or phone, by area, each with a button to
 * write to them in the space. As a picker («Nuevo mensaje directo») a click
 * writes at once.
 */
export function DirectoryDialog(props: { space: ClientWorkspace; jwt: string; myUserId: string; online: ReadonlySet<string>; picking?: boolean; onOpenMember: (member: ClientWorkspaceMember) => void; onMessage: (member: ClientWorkspaceMember) => void; onInvite?: () => void; onClose: () => void }) {
  // What this space's directory already showed paints at once and refreshes behind (22/10).
  const directory = useCached(membersCache, `${props.space.id}:members`, fetchMembers(props.jwt, props.space.id));
  const members = directory.value ?? null;
  const error = members ? '' : (directory.error ?? '');
  const [query, setQuery] = useState('');
  const [area, setArea] = useState<string | null>(null);
  const people = useMemo(() => (members ?? []).filter((member) => !props.picking || member.userId !== props.myUserId), [members, props.picking, props.myUserId]);
  const chips = useMemo(() => directoryAreas(people), [people]);
  const shown = filterMembers(people, { query, area });

  return (
    <Overlay title={props.picking ? 'Nuevo mensaje directo' : `Directorio de ${props.space.name}`} onClose={props.onClose} wide>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{props.space.name}</p>
          <h3 className="text-2xl font-bold tracking-tight">{props.picking ? 'Nuevo mensaje directo' : 'Directorio'}</h3>
        </div>
        {props.onInvite ? <button type="button" data-testid="directorio-invitar" onClick={props.onInvite} className="flex h-10 items-center gap-1.5 rounded-xl border border-outline/25 px-3 text-sm font-semibold hover:bg-background"><UserPlus size={16} className="text-primary" /> Invitar</button> : null}
      </div>
      <label className="mt-4 flex h-11 items-center gap-2 rounded-xl border border-outline/20 bg-background px-3">
        <Search size={16} className="text-on-surface-variant" />
        <input data-testid="buscar-directorio" value={query} autoFocus onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, cargo o área" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
      {chips.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button key={chip.label} type="button" data-testid={`area-${chip.label}`} aria-pressed={area === chip.area} onClick={() => setArea(chip.area)} className={`h-9 rounded-lg border px-3 text-sm font-semibold ${area === chip.area ? 'border-primary bg-primary text-on-primary' : 'border-outline/20 hover:bg-background'}`}>
              {chip.label} <span className="font-normal opacity-75">{chip.count}</span>
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-3 text-[13px] text-error">{error}</p> : null}
      <div className="mt-3 divide-y divide-outline/10 overflow-hidden rounded-xl border border-outline/15">
        {members === null && !error ? [0, 1, 2].map((index) => <div key={index} className="h-16 animate-pulse bg-background" />) : null}
        {members !== null && shown.length === 0 ? <p className="p-6 text-center text-sm text-on-surface-variant">{query || area ? 'Nadie coincide con la búsqueda.' : 'Todavía no hay nadie más en el espacio.'}</p> : null}
        {shown.map((member) => {
          const isOnline = Boolean(member.userId && props.online.has(member.userId));
          const canWrite = Boolean(member.userId && member.userId !== props.myUserId);
          return (
            <div key={member.id} data-testid={`miembro-${member.phone}`} className="flex min-h-[64px] items-center gap-3 p-3">
              <button type="button" onClick={() => (props.picking && canWrite ? props.onMessage(member) : props.onOpenMember(member))} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <MemberAvatar member={member} size={40} online={isOnline} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5"><span className="truncate font-semibold">{memberName(member)}{member.userId === props.myUserId ? ' (Tú)' : ''}</span>{isOnline ? <OnlinePill /> : null}</span>
                  {memberLine(member) ? <span className="block truncate text-[13px] text-on-surface-variant">{memberLine(member)}</span> : null}
                </span>
              </button>
              <span className="hidden font-mono text-[13px] text-on-surface-variant sm:inline">{formatPhoneDisplay(member.phone)}</span>
              {canWrite ? <button type="button" data-testid={`escribir-${member.phone}`} aria-label={`Escribir a ${memberName(member)}`} title="Escribir" onClick={() => props.onMessage(member)} className="grid h-10 w-10 place-items-center rounded-full text-primary hover:bg-primary/10"><MessageCircle size={18} /></button> : null}
            </div>
          );
        })}
      </div>
      {props.picking ? null : (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-outline/15 p-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-variant text-on-surface-variant"><Users size={18} /></span>
          <span className="min-w-0 flex-1"><span className="block font-bold">{`Espacio ${props.space.name}`}</span><span className="block text-[13px] text-on-surface-variant">{`${membersLabel(props.space.members)} activos`}</span></span>
          {props.space.joinCode ? <span className="rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 font-mono text-[12px] font-bold text-primary">{props.space.joinCode}</span> : null}
        </div>
      )}
    </Overlay>
  );
}
