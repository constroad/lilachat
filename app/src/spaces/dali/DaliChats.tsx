import { FlatList, View } from 'react-native';
import { nombreDeContacto } from '@lilachat/shared';
import type { ChatSummary } from '../../api/client';
import { agendaPorTelefono } from '../../contacts/agendaEnMemoria';
import { FilaDeChat } from '../../chat/FilaDeChat';
import { EmptyNote } from './daliParts';

type Props = { chats: ChatSummary[]; myUserId: string; openChatId: string | null; onOpenChat: (chat: ChatSummary) => void };

const SIDE_ROOM = 16;
const LIST_BOTTOM_ROOM = 24;
const NO_SELECTION = (_chatId: string): void => undefined;
const keyOf = (chat: ChatSummary): string => chat.id;

/**
 * Chats tab (José 20/11, via Agentes): direct 1:1 conversations — the team's own chats and a prospect agentes
 * marked `listing: 'chat'` instead of a sales lead. Never counted by Bandeja/Embudo/Panel/Revisión.
 */
export function DaliChats(props: Props) {
  if (props.chats.length === 0) {
    return (
      <View className="p-4">
        <EmptyNote title="No hay chats directos.">Los canales y mensajes directos del espacio aparecen aquí.</EmptyNote>
      </View>
    );
  }
  return (
    <FlatList
      testID="chats-dali"
      data={props.chats}
      keyExtractor={keyOf}
      renderItem={({ item: chat }) => <ChatItem chat={chat} myUserId={props.myUserId} openChatId={props.openChatId} onOpenChat={props.onOpenChat} />}
      contentContainerStyle={{ paddingHorizontal: SIDE_ROOM, paddingBottom: LIST_BOTTOM_ROOM, paddingTop: 12 }}
    />
  );
}

function ChatItem({ chat, myUserId, openChatId, onOpenChat }: { chat: ChatSummary; myUserId: string; openChatId: string | null; onOpenChat: (chat: ChatSummary) => void }) {
  const title = nombreDeContacto({ delServidor: chat.name, telefono: chat.phone, agenda: agendaPorTelefono() }) || 'Conversación';
  return (
    <View className="mb-2.5 overflow-hidden rounded-xl border border-outline/15 bg-surface">
      <FilaDeChat chat={chat} titulo={title} miUserId={myUserId} marcado={false} enLinea={false} escribiendo={false} onTocar={onOpenChat} onMantener={NO_SELECTION} open={chat.id === openChatId} />
    </View>
  );
}
