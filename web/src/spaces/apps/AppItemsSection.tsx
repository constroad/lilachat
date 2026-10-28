import { useState } from 'react';
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { itemIsOn, itemKey, sameItemSetting, type AppItemRow, type AppItemSetting, type ClientWorkspaceMember } from '@lilachat/shared';
import { saveAppItems, type AppItems } from '../spacesApi';
import { AppItemEditor } from './AppItemEditor';

type SectionProps = {
  jwt: string;
  spaceId: string;
  appId: string;
  state: AppItems;
  members: ClientWorkspaceMember[];
  onSaved: (state: AppItems) => void;
  onProgram: (row: AppItemRow) => void;
};

const settingOf = (row: AppItemRow): AppItemSetting => ({ global: row.global, channels: row.channels, direct: row.direct, who: row.who });

/**
 * «Comandos y acciones» (design d-01; José, 23/10 and 28/10): everything starts
 * off; each command or action opens to turn it on in the ⚡, the channels or
 * the 1:1 with the app, and to pick who uses it. The admin saves one at a time;
 * the server applies it to everyone at once. The rest see what is on.
 */
export function AppItemsSection(props: SectionProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, AppItemRow>>({});
  const [status, setStatus] = useState<{ key: string; busy: boolean; line?: string; error?: boolean } | null>(null);

  const save = async (row: AppItemRow) => {
    const key = itemKey(row.kind, row.key);
    setStatus({ key, busy: true });
    const result = await saveAppItems(props.jwt, props.spaceId, props.appId, { [key]: settingOf(row) });
    if (!result.ok) return setStatus({ key, busy: false, line: result.message, error: true });
    props.onSaved(result.data);
    setEdits(({ [key]: _saved, ...rest }) => rest);
    setStatus({ key, busy: false, line: 'Guardado. Ya se ve así en el espacio.' });
  };
  return (
    <section data-testid="comandos-y-acciones" className="rounded-2xl border border-outline/15 bg-surface">
      <div className="px-5 pt-5">
        <p className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant"><SlidersHorizontal size={15} className="text-primary" /> Comandos y acciones</p>
        <p className="text-[14px] text-on-surface-variant">{props.state.canEdit ? 'Todo empieza apagado. Enciende lo que quieras y elige quién lo usa.' : 'Lo que está encendido y quién lo usa. Solo los admins lo cambian.'}</p>
      </div>
      <div className="mt-3 divide-y divide-outline/10 border-t border-outline/10">
        {props.state.items.map((saved) => {
          const key = itemKey(saved.kind, saved.key);
          const row = edits[key] ?? saved;
          return (
            <div key={key}>
              <ItemHeader row={row} open={open === key} onToggle={() => setOpen(open === key ? null : key)} />
              {open === key ? (
                <AppItemEditor
                  row={row}
                  channels={props.state.channels}
                  members={props.members}
                  canEdit={props.state.canEdit}
                  changed={!sameItemSetting(settingOf(saved), settingOf(row))}
                  status={status?.key === key ? status : null}
                  onChange={(change) => setEdits((before) => ({ ...before, [key]: { ...row, ...change } }))}
                  onSave={() => void save(row)}
                  onProgram={() => props.onProgram(row)}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ItemHeader(props: { row: AppItemRow; open: boolean; onToggle: () => void }) {
  const { row } = props;
  const on = itemIsOn(row);
  const Chevron = props.open ? ChevronUp : ChevronDown;
  return (
    <button type="button" data-testid={`item-${row.key}`} aria-expanded={props.open} onClick={props.onToggle} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-background/60">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-bold">{row.name}</span>
        <span className="block truncate text-[13px] text-on-surface-variant">{row.kind === 'command' ? 'Comando' : 'Acción'}{row.description ? ` · ${row.description}` : ''}</span>
      </span>
      <span data-testid={`estado-${row.key}`} className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${on ? 'border-en-linea/30 bg-en-linea/10 text-en-linea' : 'border-outline/25 bg-background text-on-surface-variant'}`}>
        {on ? 'Encendido' : 'Apagado'}
      </span>
      <Chevron size={18} className="shrink-0 text-on-surface-variant" />
    </button>
  );
}
