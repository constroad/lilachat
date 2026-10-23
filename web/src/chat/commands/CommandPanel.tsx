import { SquareTerminal } from 'lucide-react';
import type { CommandGroup } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';

/**
 * «/ Comandos rápidos» over the field (design `e-20-comandos-barra-web`),
 * grouped by app. The active one (↑↓) shows its example and «Enter»; a click
 * or Tab writes «/command » for its text.
 */
export function CommandPanel(props: { groups: readonly CommandGroup[]; active: string | null; onPick: (command: string) => void }) {
  if (props.groups.length === 0) return null;
  return (
    <div data-testid="panel-comandos" role="listbox" aria-label="Comandos rápidos" className="mb-2 overflow-hidden rounded-xl border border-outline/15 bg-surface shadow-sm">
      <div className="flex items-center gap-2 border-b border-outline/10 px-4 py-2.5">
        <SquareTerminal size={16} className="text-primary" />
        <p className="flex-1 text-[12px] font-bold uppercase tracking-wider text-primary">/ Comandos rápidos</p>
        <p className="hidden text-[12px] text-on-surface-variant sm:block">Navega con ↑ ↓ · Tab o Enter para completar</p>
      </div>
      <div className="max-h-72 overflow-y-auto py-1">
        {props.groups.map((group) => (
          <div key={group.appId}>
            <div className="flex items-center gap-2 px-4 pb-1 pt-2">
              <Avatar name={group.appName} size={20} bot />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">{group.appName}</p>
            </div>
            {group.commands.map((entry) => {
              const active = entry.command === props.active;
              return (
                <button
                  key={entry.command}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-testid={`comando-${entry.command}`}
                  // mousedown keeps the field's focus: a click on the option must not close the keyboard flow.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => props.onPick(entry.command)}
                  className={`flex w-full items-start gap-3 px-4 py-2 text-left ${active ? 'bg-primary/[0.07]' : 'hover:bg-background'}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-on-surface">
                      <span className="font-mono font-semibold text-primary">/{entry.command}</span>
                      {entry.usageHint ? <span className="font-mono text-on-surface-variant"> {entry.usageHint}</span> : null}
                      <span className="text-on-surface-variant"> — {entry.description}</span>
                    </p>
                    {active && entry.usageHint ? (
                      <p className="mt-1 text-[12px] text-on-surface-variant">
                        Ejemplo de uso: <span className="rounded border border-primary/20 px-1.5 py-0.5 font-mono font-semibold text-primary">/{entry.command} {entry.usageHint}</span>
                      </p>
                    ) : null}
                  </div>
                  {active ? <span className="shrink-0 rounded-md border border-outline/20 px-2 py-0.5 text-[11px] font-semibold text-primary">Enter ↵</span> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
