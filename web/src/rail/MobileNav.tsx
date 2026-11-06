import { AtSign, BarChart3, ListTodo, MessageCircle, Settings, Users, type LucideIcon } from 'lucide-react';
import { mobileTabsFor, type MobileTab } from './mobileTabs';

/** Each tab's word and icon, the APK's (`app/src/ui/BottomNav.tsx`). */
const TAB_INFO: Record<MobileTab, { label: string; Icon: LucideIcon }> = {
  chats: { label: 'Chats', Icon: MessageCircle },
  agenda: { label: 'Pendientes', Icon: ListTodo },
  encuestas: { label: 'Encuestas', Icon: BarChart3 },
  ajustes: { label: 'Ajustes', Icon: Settings },
  directory: { label: 'Directorio', Icon: Users },
  mentions: { label: 'Menciones', Icon: AtSign },
};
const COUNT_MAX = 99;

/**
 * The bar under the list on a phone, instead of the rail (José 06/11: the rail
 * took a fifth of the screen). The spaces switch from the list's own header.
 */
export function MobileNav(props: { inSpace: boolean; active: MobileTab; counts?: Partial<Record<MobileTab, number>>; onPick: (tab: MobileTab) => void }) {
  return (
    <nav data-testid="barra-de-pestanas" aria-label="Secciones" className="flex shrink-0 items-stretch border-t border-outline/15 bg-surface pb-[env(safe-area-inset-bottom)]">
      {mobileTabsFor(props.inSpace).map((tab) => {
        const { label, Icon } = TAB_INFO[tab];
        const selected = tab === props.active;
        const count = props.counts?.[tab] ?? 0;
        return (
          <button key={tab} type="button" data-testid={`tab-${tab}`} aria-label={label} aria-current={selected || undefined} onClick={() => props.onPick(tab)} className={`relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${selected ? 'text-primary' : 'text-on-surface-variant'}`}>
            <span className={`grid h-8 w-16 place-items-center rounded-full ${selected ? 'bg-primary/15' : ''}`}><Icon size={21} /></span>
            {count > 0 ? <span data-testid={`contador-${tab}`} className="absolute left-1/2 top-1.5 ml-2 min-w-[18px] rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-[18px] text-on-primary">{count > COUNT_MAX ? `${COUNT_MAX}+` : count}</span> : null}
            {label}
          </button>
        );
      })}
    </nav>
  );
}
