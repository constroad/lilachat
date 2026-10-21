import { PanelLeftOpen } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Logo } from '../ui/Logo';
import type { ChatSummary } from './types';

/** How many chats the folded list shows. */
const RAIL_CHATS = 12;

/**
 * The chat list folded away (design `n-02-web-lista-plegada`; José, 21/10:
 * «o esconderse, ser tipo collapse»): a 72 px rail with the logo, the latest
 * chats as avatars with a dot when unread, and «Desplegar» at the bottom.
 */
export function ChatRail(props: { chats: readonly ChatSummary[]; selectedChatId: string | null; onSelect: (chat: ChatSummary) => void; onExpand: () => void }) {
  return (
    <nav data-testid="riel-de-chats" aria-label="Chats" className="flex h-full w-[72px] shrink-0 flex-col items-center gap-2 border-r border-outline/15 bg-surface py-3">
      <Logo size={32} />
      <div className="my-1 h-px w-8 bg-outline/15" />
      <ul className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto">
        {props.chats.slice(0, RAIL_CHATS).map((chat) => {
          const name = chat.name ?? chat.phone ?? 'Conversación';
          const unread = chat.unread > 0 || Boolean(chat.markedUnread);
          return (
            <li key={chat.id}>
              <button
                type="button"
                data-testid={`riel-chat-${chat.id}`}
                title={name}
                aria-label={unread ? `${name}, sin leer` : name}
                onClick={() => props.onSelect(chat)}
                className={`relative grid h-12 w-12 place-items-center rounded-full ${props.selectedChatId === chat.id ? 'ring-2 ring-primary' : ''}`}
              >
                <Avatar name={name} kind={chat.propio ? 'direct' : chat.kind} foto={chat.avatarUrl} size={44} />
                {unread ? <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-surface bg-primary" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" data-testid="btn-desplegar-lista" onClick={props.onExpand} aria-label="Desplegar la lista" title="Desplegar la lista" className="flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-on-surface-variant hover:bg-background">
        <PanelLeftOpen size={20} />
        <span className="text-[10px] font-bold uppercase tracking-wide">Desplegar</span>
      </button>
    </nav>
  );
}
