import { SectionList, Text, View } from 'react-native';
import { nombreDeContacto } from '@lilachat/shared';
import type { ChatSummary } from '../../api/client';
import { agendaPorTelefono } from '../../contacts/agendaEnMemoria';
import { FilaDeChat } from '../../chat/FilaDeChat';
import { EmptyNote } from './daliParts';

type Props = { directs: ChatSummary[]; whatsappGroups: ChatSummary[]; myUserId: string; openChatId: string | null; onOpenChat: (chat: ChatSummary) => void };
type Section = { title?: string; data: ChatSummary[] };

const SIDE_ROOM = 16;
const LIST_BOTTOM_ROOM = 24;
const NO_SELECTION = (_chatId: string): void => undefined;
const keyOf = (chat: ChatSummary): string => chat.id;

/**
 * Chats tab (José 20/11, via Agentes): direct 1:1 conversations — the team's own chats and a prospect agentes
 * marked `listing: 'chat'` instead of a sales lead. Never counted by Bandeja/Embudo/Panel/Revisión.
 *
 * WhatsApp groups (fase 1, agentes 20/11): a section apart, shown only once the space has one — a company
 * with none sees exactly today's flat list, no empty header.
 */
export function DaliChats(props: Props) {
  if (props.directs.length === 0 && props.whatsappGroups.length === 0) {
    return (
      <View className="p-4">
        <EmptyNote title="No hay chats directos.">Los canales y mensajes directos del espacio aparecen aquí.</EmptyNote>
      </View>
    );
  }
  const sections: Section[] =
    props.whatsappGroups.length > 0
      ? [
          { title: 'Mensajes directos', data: props.directs },
          { title: 'Grupos de WhatsApp', data: props.whatsappGroups },
        ].filter((section) => section.data.length > 0)
      : [{ data: props.directs }];
  return (
    <SectionList
      testID="chats-dali"
      sections={sections}
      keyExtractor={keyOf}
      renderSectionHeader={({ section }) => (section.title ? <SectionHeader title={section.title} /> : null)}
      renderItem={({ item: chat }) => <ChatItem chat={chat} myUserId={props.myUserId} openChatId={props.openChatId} onOpenChat={props.onOpenChat} />}
      contentContainerStyle={{ paddingHorizontal: SIDE_ROOM, paddingBottom: LIST_BOTTOM_ROOM, paddingTop: 12 }}
    />
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View className="bg-background pb-2 pt-3">
      <Text className="text-[13px] font-semibold uppercase text-on-surface-variant">{title}</Text>
    </View>
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
