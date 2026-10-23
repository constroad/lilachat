import { Check, Plus } from 'lucide-react';
import type { ChatList } from '@lilachat/shared';
import { Overlay } from '../../ui/Overlay';

/**
 * «Agregar a lista» from a chat's menu (pending 45): each list with a tick
 * when the chat is in it; tapping puts it in or takes it out. «Nueva lista»
 * starts one with this chat.
 */
export function AddToListDialog(props: { chatId: string; chatTitle: string; lists: readonly ChatList[]; onToggle: (list: ChatList, putIn: boolean) => void; onNewList: () => void; onClose: () => void }) {
  return (
    <Overlay title={`Agregar «${props.chatTitle}» a una lista`} onClose={props.onClose}>
      {props.lists.length === 0 ? <p className="mb-2 text-sm text-on-surface-variant">Todavía no tienes listas.</p> : null}
      {props.lists.map((list) => {
        const inside = list.chatIds.includes(props.chatId);
        return (
          <button key={list.id} type="button" role="checkbox" aria-checked={inside} data-testid={`lista-destino-${list.id}`} onClick={() => props.onToggle(list, !inside)} className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-1 text-left hover:bg-background">
            <span className="min-w-0 flex-1 truncate text-sm">{list.name}</span>
            <span className="text-xs tabular-nums text-on-surface-variant">{list.chatIds.length}</span>
            <span className={`grid h-5 w-5 place-items-center rounded border-2 ${inside ? 'border-primary bg-primary text-on-primary' : 'border-outline/50'}`}>{inside ? <Check size={12} /> : null}</span>
          </button>
        );
      })}
      <button type="button" data-testid="btn-nueva-lista-desde-chat" onClick={props.onNewList} className="mt-1 flex min-h-[48px] w-full items-center gap-3 rounded-lg px-1 text-left text-sm font-semibold text-primary hover:bg-primary/5">
        <Plus size={18} /> Nueva lista
      </button>
    </Overlay>
  );
}
