import { ChevronRight } from 'lucide-react';
import type { ShortcutRow } from '@lilachat/shared';
import { AppLogo } from '../../spaces/apps/AppLogo';

const LOGO = 40;

/** The apps' actions as rows (designs e-29 and e-30): the space's ⚡ and a chat's draw the same. */
export function AppActionList(props: { rows: readonly ShortcutRow[]; testPrefix: string; onPick: (row: ShortcutRow) => void }) {
  return (
    <div className="divide-y divide-outline/10 overflow-hidden rounded-2xl border border-outline/15">
      {props.rows.map((row) => (
        <button key={`${row.appId}:${row.key}`} type="button" data-testid={`${props.testPrefix}-${row.key}`} onClick={() => props.onPick(row)} className="flex min-h-16 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-background">
          <AppLogo avatarUrl={row.avatarUrl} size={LOGO} rounded="rounded-xl" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{row.name}</span>
            <span className="block truncate text-[13px] text-on-surface-variant">{row.appName}</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-on-surface-variant" />
        </button>
      ))}
    </div>
  );
}
