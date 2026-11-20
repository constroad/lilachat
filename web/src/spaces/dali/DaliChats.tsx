import { ChatRow } from '../../chat/FilaDeChat';
import type { ChatAction } from '../../chat/menuDelChat';
import type { ChatSummary } from '../../chat/types';
import { EmptyNote } from './daliParts';

type Props = {
  chats: ChatSummary[];
  yo: string;
  selectedChatId: string | null;
  onOpenChat: (chat: ChatSummary) => void;
  onChatAction: (chat: ChatSummary, action: ChatAction) => void;
};

/**
 * Chats tab (José 20/11, via Agentes): direct 1:1 conversations — the team's own chats and a prospect agentes
 * marked `listing: 'chat'` instead of a sales lead. Never counted by Bandeja/Embudo/Panel/Revisión.
 */
export function DaliChats(props: Props) {
  if (props.chats.length === 0) {
    return <EmptyNote title="No hay chats directos.">Los canales y mensajes directos del espacio aparecen aquí.</EmptyNote>;
  }
  return (
    <div data-testid="chats-dali" className="mx-4 my-4 overflow-hidden rounded-lg bg-list">
      {props.chats.map((chat) => (
        <ChatRow key={chat.id} chat={chat} yo={props.yo} seleccionado={chat.id === props.selectedChatId} onSelect={() => props.onOpenChat(chat)} onAccion={props.onChatAction} />
      ))}
    </div>
  );
}
