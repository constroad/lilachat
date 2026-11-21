import { ChatRow } from '../../chat/FilaDeChat';
import type { ChatAction } from '../../chat/menuDelChat';
import type { ChatSummary } from '../../chat/types';
import { EmptyNote } from './daliParts';

type Props = {
  directs: ChatSummary[];
  whatsappGroups: ChatSummary[];
  yo: string;
  selectedChatId: string | null;
  onOpenChat: (chat: ChatSummary) => void;
  onChatAction: (chat: ChatSummary, action: ChatAction) => void;
};

/**
 * Chats tab (José 20/11, via Agentes): direct 1:1 conversations — the team's own chats and a prospect agentes
 * marked `listing: 'chat'` instead of a sales lead. Never counted by Bandeja/Embudo/Panel/Revisión.
 *
 * WhatsApp groups (fase 1, agentes 20/11): a section apart, shown only once the space has one — a company
 * with none sees exactly today's list, no empty header.
 */
export function DaliChats(props: Props) {
  if (props.directs.length === 0 && props.whatsappGroups.length === 0) {
    return <EmptyNote title="No hay chats directos.">Los canales y mensajes directos del espacio aparecen aquí.</EmptyNote>;
  }
  return (
    <div data-testid="chats-dali" className="mx-4 my-4">
      <ChatGroup chats={props.directs} title={props.whatsappGroups.length > 0 ? 'Mensajes directos' : undefined} {...props} />
      <ChatGroup chats={props.whatsappGroups} title="Grupos de WhatsApp" {...props} />
    </div>
  );
}

function ChatGroup({ chats, title, yo, selectedChatId, onOpenChat, onChatAction }: Props & { chats: ChatSummary[]; title?: string }) {
  if (chats.length === 0) return null;
  return (
    <div className="mb-4">
      {title ? <div className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div> : null}
      <div className="overflow-hidden rounded-lg bg-list">
        {chats.map((chat) => (
          <ChatRow key={chat.id} chat={chat} yo={yo} seleccionado={chat.id === selectedChatId} onSelect={() => onOpenChat(chat)} onAccion={onChatAction} />
        ))}
      </div>
    </div>
  );
}
