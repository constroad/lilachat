import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal, Zap } from 'lucide-react';
import { itemKey, type AppItemRow, type ItemChannels } from '@lilachat/shared';
import { appItems, saveAppItems, type AppItems } from '../spacesApi';

type Mode = 'all' | 'none' | 'some';
const modeOf = (channels: ItemChannels): Mode => (Array.isArray(channels) ? 'some' : channels);
const sameChannels = (a: ItemChannels, b: ItemChannels) => JSON.stringify(Array.isArray(a) ? [...a].sort() : a) === JSON.stringify(Array.isArray(b) ? [...b].sort() : b);

/**
 * «Comandos y acciones» (R160; José, 23/10: «solo algunos van a ser
 * globales»): for each command and action of the app, whether it is in the
 * space's ⚡ and in which channels. The admin changes it; the server applies it
 * to everyone at once. The rest see where each one works.
 */
export function AppItemsSection(props: { jwt: string; spaceId: string; appId: string }) {
  const [state, setState] = useState<AppItems | null>(null);
  const [edits, setEdits] = useState<Record<string, AppItemRow>>({});
  const [status, setStatus] = useState<{ busy: boolean; line?: string; error?: boolean }>({ busy: false });

  useEffect(() => {
    let alive = true;
    setState(null);
    setEdits({});
    void appItems(props.jwt, props.spaceId, props.appId).then((result) => {
      if (alive && result.ok) setState(result.data);
    });
    return () => {
      alive = false;
    };
  }, [props.jwt, props.spaceId, props.appId]);

  const rows = useMemo(() => (state?.items ?? []).map((item) => edits[itemKey(item.kind, item.key)] ?? item), [state, edits]);
  const changed = rows.filter((row) => {
    const before = state?.items.find((item) => item.kind === row.kind && item.key === row.key);
    return before && (before.global !== row.global || !sameChannels(before.channels, row.channels));
  });
  if (!state || state.items.length === 0) return null;

  const edit = (row: AppItemRow, change: Partial<AppItemRow>) => setEdits((before) => ({ ...before, [itemKey(row.kind, row.key)]: { ...row, ...change } }));
  const save = async () => {
    setStatus({ busy: true });
    const items = Object.fromEntries(changed.map((row) => [itemKey(row.kind, row.key), { global: row.global, channels: row.channels }]));
    const result = await saveAppItems(props.jwt, props.spaceId, props.appId, items);
    if (!result.ok) return setStatus({ busy: false, line: result.message, error: true });
    setState(result.data);
    setEdits({});
    setStatus({ busy: false, line: 'Guardado. Ya se ve así en el espacio.' });
  };
  return (
    <section data-testid="comandos-y-acciones" className="rounded-2xl border border-outline/15 bg-surface p-5">
      <p className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant"><SlidersHorizontal size={15} className="text-primary" /> Comandos y acciones</p>
      <p className="text-[14px] text-on-surface-variant">{state.canEdit ? 'Elige cuáles salen en el ⚡ del espacio y en qué canales funcionan.' : 'Dónde funciona cada uno. Solo los admins lo cambian.'}</p>
      <div className="mt-3 divide-y divide-outline/10 overflow-hidden rounded-xl border border-outline/15">
        {rows.map((row) => (
          <ItemRow key={itemKey(row.kind, row.key)} row={row} channels={state.channels} canEdit={state.canEdit} onChange={(change) => edit(row, change)} />
        ))}
      </div>
      {state.canEdit ? (
        <button type="button" data-testid="btn-guardar-items" disabled={status.busy || changed.length === 0} onClick={() => void save()} className="mt-4 h-11 w-full rounded-xl bg-primary text-[14px] font-semibold text-on-primary disabled:opacity-40">{status.busy ? 'Guardando…' : 'Guardar'}</button>
      ) : null}
      {status.line ? <p role={status.error ? 'alert' : 'status'} className={`mt-2 text-[13px] ${status.error ? 'text-error' : 'text-en-linea'}`}>{status.line}</p> : null}
    </section>
  );
}

function ItemRow(props: { row: AppItemRow; channels: AppItems['channels']; canEdit: boolean; onChange: (change: Partial<AppItemRow>) => void }) {
  const { row } = props;
  const mode = modeOf(row.channels);
  const picked = Array.isArray(row.channels) ? row.channels : [];
  const toggleChannel = (id: string) => props.onChange({ channels: picked.includes(id) ? picked.filter((one) => one !== id) : [...picked, id] });
  return (
    <div data-testid={`item-${row.kind}-${row.key}`} className="px-3 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold">{row.name}</span><span className="rounded-full border border-outline/20 px-2 text-[11px] text-on-surface-variant">{row.kind === 'command' ? 'Comando' : 'Acción'}</span></span>
          {row.description ? <span className="block truncate text-[13px] text-on-surface-variant">{row.description}</span> : null}
        </span>
        <label className="flex items-center gap-1.5 text-[13px]">
          <input type="checkbox" data-testid={`global-${row.key}`} disabled={!props.canEdit} checked={row.global} onChange={(event) => props.onChange({ global: event.target.checked })} className="h-4 w-4 accent-primary" />
          <Zap size={14} className="text-warning" fill="currentColor" /> En el ⚡
        </label>
        <select data-testid={`canales-${row.key}`} aria-label={`Canales de ${row.name}`} disabled={!props.canEdit} value={mode} onChange={(event) => props.onChange({ channels: event.target.value === 'some' ? [] : (event.target.value as 'all' | 'none') })} className="h-9 rounded-lg border border-outline/25 bg-background px-2 text-[13px]">
          <option value="all">En todos los canales</option>
          <option value="some">En algunos canales</option>
          <option value="none">En ningún canal</option>
        </select>
      </div>
      {mode === 'some' ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {props.channels.map((channel) => (
            <button key={channel.id} type="button" disabled={!props.canEdit} aria-pressed={picked.includes(channel.id)} data-testid={`canal-${row.key}-${channel.name}`} onClick={() => toggleChannel(channel.id)} className={`h-8 rounded-full border px-3 text-[13px] ${picked.includes(channel.id) ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-outline/25 text-on-surface-variant'}`}>
              # {channel.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
