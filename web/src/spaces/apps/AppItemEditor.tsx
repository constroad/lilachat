import { useState } from 'react';
import { Building2, Clock, MessageSquare, Plus, X, Zap } from 'lucide-react';
import { hasOwnSpacePlace, spacePlaceOf, type AppItemRow, type ClientWorkspaceMember, type ItemChannels, type ItemWho } from '@lilachat/shared';
import type { AppItems } from '../spacesApi';

type EditorProps = {
  row: AppItemRow;
  channels: AppItems['channels'];
  members: ClientWorkspaceMember[];
  canEdit: boolean;
  changed: boolean;
  status: { busy: boolean; line?: string; error?: boolean } | null;
  onChange: (change: Partial<AppItemRow>) => void;
  onSave: () => void;
  onProgram: () => void;
};

type ChannelsMode = 'all' | 'some' | 'none';
const CHANNEL_MODES: readonly [ChannelsMode, string][] = [['all', 'Todos'], ['some', 'Algunos'], ['none', 'Ninguno']];
const WHO_MODES: readonly [ItemWho['kind'], string][] = [['admins', 'Solo admins'], ['everyone', 'Todos'], ['people', 'Algunas personas']];
const modeOf = (channels: ItemChannels): ChannelsMode => (Array.isArray(channels) ? 'some' : channels);
const peopleOf = (who: ItemWho) => (who.kind === 'people' ? who.userIds : []);

/** The open row of «Comandos y acciones» (design d-01): where it works, who uses it, «Programar» and its own «Guardar». */
export function AppItemEditor(props: EditorProps) {
  const { row } = props;
  const picked = Array.isArray(row.channels) ? row.channels : [];
  const toggleChannel = (id: string) => props.onChange({ channels: picked.includes(id) ? picked.filter((one) => one !== id) : [...picked, id] });
  return (
    <div className="mx-5 mb-4 space-y-4 rounded-xl border border-outline/15 bg-background/50 p-4">
      <SwitchRow testId={`global-${row.key}`} Icon={hasOwnSpacePlace(row.kind, row.key) ? Building2 : Zap} label={spacePlaceOf(row.kind, row.key).label} on={row.global} disabled={!props.canEdit} onChange={(on) => props.onChange({ global: on })} />
      <SwitchRow testId={`directo-${row.key}`} Icon={MessageSquare} label="En el chat con la app" on={row.direct} disabled={!props.canEdit} onChange={(on) => props.onChange({ direct: on })} />
      <div className="border-t border-outline/10 pt-3">
        <p className="mb-2 text-[13px] font-semibold">Canales donde funciona</p>
        <Segmented testId={`canales-${row.key}`} options={CHANNEL_MODES} value={modeOf(row.channels)} disabled={!props.canEdit} onChange={(mode) => props.onChange({ channels: mode === 'some' ? [] : mode })} />
        {modeOf(row.channels) === 'some' ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {props.channels.map((channel) => (
              <button key={channel.id} type="button" disabled={!props.canEdit} aria-pressed={picked.includes(channel.id)} data-testid={`canal-${row.key}-${channel.name}`} onClick={() => toggleChannel(channel.id)} className={`h-8 rounded-lg border px-3 text-[13px] ${picked.includes(channel.id) ? 'border-primary/40 bg-primary/10 font-semibold text-primary' : 'border-outline/25 text-on-surface-variant'}`}>
                # {channel.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <WhoPicker {...props} />
      {props.canEdit && row.schedulable ? (
        <button type="button" data-testid={`programar-${row.key}`} onClick={props.onProgram} className="flex items-center gap-2 text-[14px] font-semibold text-primary">
          <Clock size={16} /> Programar {row.name} automáticamente
        </button>
      ) : null}
      {props.canEdit ? (
        <button type="button" data-testid={`guardar-${row.key}`} disabled={!props.changed || props.status?.busy} onClick={props.onSave} className="h-11 w-full rounded-xl bg-primary text-[14px] font-semibold text-on-primary disabled:opacity-40">
          {props.status?.busy ? 'Guardando…' : `Guardar cambios de ${row.name}`}
        </button>
      ) : null}
      {props.status?.line ? <p role={props.status.error ? 'alert' : 'status'} className={`text-[13px] ${props.status.error ? 'text-error' : 'text-en-linea'}`}>{props.status.line}</p> : null}
    </div>
  );
}

/** «Quién puede usarlo»: admins always; everyone; or some members of the space, picked from its list. */
function WhoPicker(props: EditorProps) {
  const { row } = props;
  const [adding, setAdding] = useState(false);
  const people = peopleOf(row.who);
  const nameOf = (userId: string) => props.members.find((member) => member.userId === userId);
  const setPeople = (userIds: string[]) => props.onChange({ who: { kind: 'people', userIds } });
  const candidates = props.members.filter((member) => member.userId && !people.includes(member.userId));
  return (
    <div className="border-t border-outline/10 pt-3">
      <p className="mb-2 text-[13px] font-semibold">Quién puede usarlo</p>
      <Segmented testId={`quien-${row.key}`} options={WHO_MODES} value={row.who.kind} disabled={!props.canEdit} onChange={(kind) => props.onChange({ who: kind === 'people' ? { kind, userIds: people } : { kind } })} />
      {row.who.kind === 'people' ? (
        <div className="mt-2 space-y-1.5">
          {people.map((userId) => (
            <div key={userId} data-testid={`persona-${row.key}-${userId}`} className="flex items-center gap-2 rounded-lg border border-outline/15 bg-surface px-3 py-2 text-[14px]">
              <span className="min-w-0 flex-1 truncate font-semibold">{nameOf(userId)?.name ?? 'Miembro del espacio'}<span className="font-normal text-on-surface-variant">{nameOf(userId)?.phone ? ` · ${nameOf(userId)?.phone}` : ''}</span></span>
              {props.canEdit ? <button type="button" aria-label="Quitar" data-testid={`quitar-persona-${row.key}-${userId}`} onClick={() => setPeople(people.filter((one) => one !== userId))} className="grid h-8 w-8 place-items-center rounded-full text-on-surface-variant hover:bg-background"><X size={16} /></button> : null}
            </div>
          ))}
          {props.canEdit ? (
            <button type="button" data-testid={`agregar-persona-${row.key}`} onClick={() => setAdding(!adding)} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-primary/40 text-[14px] font-semibold text-primary">
              <Plus size={16} /> Agregar persona
            </button>
          ) : null}
          {adding ? (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-outline/15 bg-surface">
              {candidates.length ? candidates.map((member) => (
                <button key={member.id} type="button" data-testid={`elegir-persona-${member.userId}`} onClick={() => { setPeople([...people, member.userId!]); setAdding(false); }} className="block w-full truncate px-3 py-2 text-left text-[14px] hover:bg-background">
                  {member.name ?? member.phone}
                </button>
              )) : <p className="px-3 py-2 text-[13px] text-on-surface-variant">Ya están todos los miembros.</p>}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SwitchRow(props: { testId: string; Icon: typeof Zap; label: string; on: boolean; disabled: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex min-h-[44px] items-center gap-3 text-[14px]">
      <props.Icon size={18} className="shrink-0 text-primary" />
      <span className="min-w-0 flex-1">{props.label}</span>
      <input type="checkbox" role="switch" data-testid={props.testId} checked={props.on} disabled={props.disabled} onChange={(event) => props.onChange(event.target.checked)} className="h-5 w-5 accent-primary" />
    </label>
  );
}

function Segmented<T extends string>(props: { testId: string; options: readonly [T, string][]; value: T; disabled: boolean; onChange: (value: T) => void }) {
  return (
    <div role="radiogroup" className="grid grid-cols-3 gap-1 rounded-lg bg-primary/5 p-1">
      {props.options.map(([value, label]) => (
        <button key={value} type="button" role="radio" aria-checked={props.value === value} data-testid={`${props.testId}-${value}`} disabled={props.disabled} onClick={() => props.onChange(value)} className={`min-h-[36px] rounded-md px-2 text-[13px] ${props.value === value ? 'bg-surface font-semibold text-primary shadow-sm' : 'text-on-surface-variant'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
