import { CHAT_DETAIL_TAB_LABEL, type ChatDetailTab } from '@lilachat/shared';

/** The tabs under the chat's identity (pending 69, design `r151-detalle-grupo`): the active one underlined in the brand color. */
export function DetailTabBar(props: { tabs: readonly ChatDetailTab[]; active: ChatDetailTab; onChange: (tab: ChatDetailTab) => void }) {
  return (
    <div role="tablist" data-testid="pestanas-detalle" className="mt-2 flex border-y border-outline/15 bg-surface">
      {props.tabs.map((tab) => {
        const active = tab === props.active;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`pestana-detalle-${tab}`}
            onClick={() => props.onChange(tab)}
            className={`min-h-[48px] flex-1 border-b-2 text-[15px] transition-colors ${active ? 'border-primary font-semibold text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
          >
            {CHAT_DETAIL_TAB_LABEL[tab]}
          </button>
        );
      })}
    </div>
  );
}
