import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { accessSummary, clientAccessPath, DEFAULT_RESTRICTED, memberAccessIn, MONEY_HINT, RESTRICTABLE_TAB_HINTS, RESTRICTABLE_TABS, CHANNEL_TAB_LABELS, toggleInAccess, type ClientAccessList, type MemberAccess, type MemberAccessEntry } from '@lilachat/shared';
import { api } from '../../api';
import { Avatar } from '../../ui/Avatar';
import { Overlay } from '../../ui/Overlay';
import type { ServiceAskTarget } from './useServiceAsk';

export type StageOption = { id: string; title: string };
type Person = { id: string; name: string; photo?: string };
type SaveBody = { money?: boolean; restricted?: MemberAccess | null };

/** The channel's access list; `null` while loading or for a non-admin (the server says 403). */
function useClientAccess(target: ServiceAskTarget) {
  const { jwt, spaceId, clientId } = target;
  const [list, setList] = useState<ClientAccessList | null>(null);
  useEffect(() => {
    let alive = true;
    void api<ClientAccessList>(clientAccessPath(spaceId, clientId), { jwt }).then((response) => {
      if (alive && response.ok) setList(response.data);
    });
    return () => {
      alive = false;
    };
  }, [jwt, spaceId, clientId]);
  const save = useCallback(async (userId: string, body: SaveBody): Promise<string | null> => {
    const response = await api<ClientAccessList>(clientAccessPath(spaceId, clientId, userId), { jwt, method: 'PUT', body });
    if (!response.ok) return response.message;
    setList(response.data);
    return null;
  }, [jwt, spaceId, clientId]);
  return { list, save };
}

/** The checklist's stages of the channel, for picking which ones a member sees. */
export function useChannelStages(jwt: string, chatId: string, enabled: boolean): StageOption[] {
  const [stages, setStages] = useState<StageOption[]>([]);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    void api<{ stages: { _id: string; title: string }[] }>(`/agenda/checklists/stages?chatId=${chatId}`, { jwt }).then((response) => {
      if (alive && response.ok) setStages(response.data.stages.map((stage) => ({ id: stage._id, title: stage.title })));
    });
    return () => {
      alive = false;
    };
  }, [jwt, chatId, enabled]);
  return stages;
}

const Check = (props: { testId: string; checked: boolean; label: string; hint?: string; onChange: () => void }) => (
  <label className="flex min-h-[48px] cursor-pointer items-center gap-3 px-1 py-1.5">
    <input type="checkbox" data-testid={props.testId} checked={props.checked} onChange={props.onChange} className="h-4 w-4 accent-[currentColor] text-primary" />
    <span className="min-w-0 flex-1">
      <span className="block text-[14px] font-semibold">{props.label}</span>
      {props.hint ? <span className="block text-[12px] text-on-surface-variant">{props.hint}</span> : null}
    </span>
  </label>
);

/**
 * «Todo el canal» or «Solo lo que elijas» (José 30/10 night: topographers and
 * engineers see some tabs, and in the checklist only some stages plus the
 * tasks assigned to them). `null` = the whole channel.
 */
export function AccessFields(props: { value: MemberAccess | null; stages: readonly StageOption[]; onChange: (value: MemberAccess | null) => void }) {
  const restricted = props.value;
  const option = (key: 'all' | 'some', label: string, hint: string) => (
    <button type="button" data-testid={`acceso-${key}`} aria-pressed={(key === 'some') === Boolean(restricted)} onClick={() => props.onChange(key === 'all' ? null : (restricted ?? DEFAULT_RESTRICTED))} className={`flex-1 rounded-xl border px-3 py-2 text-left ${(key === 'some') === Boolean(restricted) ? 'border-primary bg-primary/[0.06]' : 'border-outline/20 hover:bg-background'}`}>
      <span className="block text-[14px] font-semibold">{label}</span>
      <span className="block text-[12px] text-on-surface-variant">{hint}</span>
    </button>
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {option('all', 'Todo el canal', 'Todas las pestañas, sin montos')}
        {option('some', 'Solo lo que elijas', 'El chat y las pestañas que marques')}
      </div>
      {restricted ? (
        <div className="rounded-xl border border-outline/15 px-3 py-1">
          {RESTRICTABLE_TABS.map((tab) => <Check key={tab} testId={`acceso-pestana-${tab}`} checked={restricted.tabs.includes(tab)} label={CHANNEL_TAB_LABELS[tab]} hint={RESTRICTABLE_TAB_HINTS[tab]} onChange={() => props.onChange(toggleInAccess(restricted, { tab }))} />)}
          {restricted.tabs.includes('checklist') ? (
            <div className="border-t border-outline/10 py-1 pl-7">
              <p className="pt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Etapas que ve enteras</p>
              {props.stages.length ? props.stages.map((stage) => <Check key={stage.id} testId={`acceso-etapa-${stage.id}`} checked={restricted.stages.includes(stage.id)} label={stage.title} onChange={() => props.onChange(toggleInAccess(restricted, { stage: stage.id }))} />) : <p className="py-2 text-[12px] text-on-surface-variant">El checklist todavía no tiene etapas.</p>}
              <p className="pb-1 text-[12px] text-on-surface-variant">En las demás solo ve las tareas que le asignes.</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MemberAccessDialog(props: { person: Person; entry: MemberAccessEntry; stages: readonly StageOption[]; onSave: (body: SaveBody) => Promise<string | null>; onClose: () => void }) {
  const [money, setMoney] = useState(props.entry.money);
  const [restricted, setRestricted] = useState<MemberAccess | null>(props.entry.restricted ?? null);
  const [failure, setFailure] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const message = await props.onSave({ money, restricted });
    setSaving(false);
    if (message) setFailure(message);
    else props.onClose();
  };
  return (
    <Overlay title={`Acceso de ${props.person.name}`} onClose={props.onClose} footer={<button type="button" data-testid="guardar-acceso" disabled={saving} onClick={() => void save()} className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-on-primary disabled:opacity-60">{saving ? 'Guardando…' : 'Guardar'}</button>}>
      <div className="flex flex-col gap-3">
        <AccessFields value={restricted} stages={props.stages} onChange={setRestricted} />
        <Check testId="acceso-montos" checked={money} label="Ve montos" hint={MONEY_HINT} onChange={() => setMoney(!money)} />
        {failure ? <p role="alert" className="text-sm text-error">{failure}</p> : null}
      </div>
    </Overlay>
  );
}

/**
 * «Accesos del canal» of a client's channel, for the space's admins (José 30/10
 * night): each member with what they see; tapping one edits it. Replaces
 * «Quién ve la cobranza», which is now its «Ve montos».
 */
export function ClientAccessSection(props: { target: ServiceAskTarget; people: readonly Person[]; stages: readonly StageOption[] }) {
  const { list, save } = useClientAccess(props.target);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  if (!list) return null;
  const titles = new Map(props.stages.map((stage) => [stage.id, stage.title]));
  const restrictedCount = list.restricted.length;
  return (
    <>
      <button type="button" data-testid="accesos-del-canal" onClick={() => setOpen(true)} className="mt-2 flex min-h-[56px] w-full items-center gap-4 bg-surface px-6 text-left hover:bg-background">
        <ShieldCheck size={18} className="text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Accesos del canal</span>
          <span className="block text-[12px] text-on-surface-variant">{restrictedCount ? `${restrictedCount} con acceso restringido` : 'Todos ven el canal entero; los montos, solo los admins'}</span>
        </span>
        <ChevronRight size={16} className="text-on-surface-variant" />
      </button>
      {open && !editing ? (
        <Overlay title="Accesos del canal" onClose={() => setOpen(false)}>
          <p className="mb-2 text-sm text-on-surface-variant">Los admins del espacio ven todo. Elige qué ve cada uno de los demás.</p>
          <ul className="divide-y divide-outline/10">
            {props.people.map((person) => {
              const entry = memberAccessIn(list, person.id);
              return (
                <li key={person.id}>
                  <button type="button" data-testid={`acceso-de-${person.id}`} disabled={entry.admin} onClick={() => setEditing(person)} className="flex min-h-[60px] w-full items-center gap-3 py-2 text-left enabled:hover:bg-background">
                    <Avatar name={person.name} foto={person.photo} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">{person.name}</span>
                      <span className="block truncate text-[12px] text-on-surface-variant">{entry.admin ? 'Admin del espacio · ve todo' : accessSummary(entry, titles)}</span>
                    </span>
                    {entry.admin ? null : <ChevronRight size={16} className="text-on-surface-variant" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </Overlay>
      ) : null}
      {editing ? <MemberAccessDialog person={editing} entry={memberAccessIn(list, editing.id)} stages={props.stages} onSave={(body) => save(editing.id, body)} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

/**
 * Adding someone to a client's channel (José 30/10 night: «con accesos
 * restringidos»): whether they read the history and what they see, in one step.
 */
export function JoinClientChannelDialog(props: { name: string; askHistory: boolean; stages: readonly StageOption[]; onConfirm: (history: boolean | undefined, access: MemberAccess | null) => void; onClose: () => void }) {
  const [history, setHistory] = useState(true);
  const [access, setAccess] = useState<MemberAccess | null>(null);
  const choice = (value: boolean, label: string) => (
    <button type="button" data-testid={value ? 'historial-todo' : 'historial-desde-ahora'} aria-pressed={history === value} onClick={() => setHistory(value)} className={`h-10 flex-1 rounded-xl border text-sm ${history === value ? 'border-primary bg-primary/[0.06] font-semibold' : 'border-outline/20 hover:bg-background'}`}>{label}</button>
  );
  return (
    <Overlay title={`Agregar a ${props.name}`} onClose={props.onClose} footer={<button type="button" data-testid="confirmar-agregar" onClick={() => props.onConfirm(props.askHistory ? history : undefined, access)} className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-on-primary">Agregar</button>}>
      <div className="flex flex-col gap-4">
        {props.askHistory ? (
          <section>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">¿Ve el historial?</p>
            <div className="flex gap-2">{choice(true, 'Sí, todo')}{choice(false, 'Solo desde ahora')}</div>
          </section>
        ) : null}
        <section>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">¿Qué ve?</p>
          <AccessFields value={access} stages={props.stages} onChange={setAccess} />
        </section>
      </div>
    </Overlay>
  );
}
