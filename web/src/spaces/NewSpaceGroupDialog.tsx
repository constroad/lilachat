import { useEffect, useState } from 'react';
import { CircleCheck, Circle, Search } from 'lucide-react';
import { filterMembers, type ClientWorkspace, type ClientWorkspaceMember } from '@lilachat/shared';
import { FieldError, Overlay, PrimaryButton } from '../ui/Overlay';
import { MemberAvatar, memberLine, memberName } from './memberWeb';
import { createSpaceChat, spaceMembers } from './spacesApi';

const NAME_MAX = 60;

/** A group INSIDE the space (the «+» of GRUPOS): its name and who is in, among its active people. */
export function NewSpaceGroupDialog(props: { space: ClientWorkspace; jwt: string; myUserId: string; onCreated: (chat: { id: string; name: string; memberIds: string[] }) => void; onClose: () => void }) {
  const [members, setMembers] = useState<ClientWorkspaceMember[] | null>(null);
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void spaceMembers(props.jwt, props.space.id).then((response) => (response.ok ? setMembers(response.data.members.filter((member) => member.userId && member.userId !== props.myUserId)) : setError(response.message)));
  }, [props.jwt, props.space.id, props.myUserId]);
  const clean = name.trim();
  const toggle = (userId: string) => setChosen((before) => (before.includes(userId) ? before.filter((id) => id !== userId) : [...before, userId]));
  const create = async () => {
    if (!clean || chosen.length === 0 || busy) return;
    setBusy(true);
    const response = await createSpaceChat(props.jwt, props.space.id, { kind: 'group', name: clean, memberIds: chosen });
    setBusy(false);
    if (!response.ok) return setError(response.message);
    props.onCreated({ id: response.data.chatId, name: clean, memberIds: [props.myUserId, ...chosen] });
  };
  return (
    <Overlay title={`Nuevo grupo en ${props.space.name}`} onClose={props.onClose} footer={<PrimaryButton testId="crear-grupo-espacio" disabled={!clean || chosen.length === 0 || busy} onClick={() => void create()}>{busy ? 'Creando…' : 'Crear grupo'}</PrimaryButton>}>
      <label htmlFor="nombre-grupo-espacio" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Nombre del grupo</label>
      <input id="nombre-grupo-espacio" data-testid="input-nombre-grupo-espacio" value={name} maxLength={NAME_MAX} autoFocus onChange={(event) => setName(event.target.value)} placeholder="Compras de obra" className="h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-sm outline-none focus:border-primary" />
      <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{`Personas (${chosen.length})`}</p>
      <label className="flex h-11 items-center gap-2 rounded-xl border border-outline/20 bg-background px-3"><Search size={16} className="text-on-surface-variant" /><input data-testid="buscar-grupo-espacio" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, cargo o área" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
      <FieldError>{error}</FieldError>
      {members !== null && members.length === 0 ? <p className="mt-6 text-center text-sm text-on-surface-variant">Todavía no hay nadie más en el espacio: invita a tu equipo.</p> : null}
      <div className="mt-2">
        {filterMembers(members ?? [], { query, area: null }).map((member) => {
          const on = chosen.includes(member.userId!);
          return (
            <button key={member.id} type="button" data-testid={`elegir-${member.phone}`} aria-pressed={on} onClick={() => toggle(member.userId!)} className="flex min-h-[56px] w-full items-center gap-3 border-b border-outline/10 text-left">
              <MemberAvatar member={member} size={36} online={false} />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{memberName(member)}</span>{memberLine(member) ? <span className="block truncate text-[12px] text-on-surface-variant">{memberLine(member)}</span> : null}</span>
              {on ? <CircleCheck size={20} className="text-primary" /> : <Circle size={20} className="text-outline" />}
            </button>
          );
        })}
      </div>
    </Overlay>
  );
}
