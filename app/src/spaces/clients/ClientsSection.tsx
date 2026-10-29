import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Archive, Building2, ChevronDown, ChevronRight, Search } from 'lucide-react-native';
import { CLIENTS_PAGE, CLIENTS_PREVIEW, clientRowSubtitle, formatChatTimestamp, pageLiveClients, type ClientEntry } from '@lilachat/shared';
import type { ChatSummary } from '../../api/client';
import { useColores } from '../../ui/tema';

type Entry = ClientEntry<ChatSummary>;

/**
 * «CLIENTES · N» in the space list (design f-01): one row per live client
 * with its open services and last order, and the row «Archivados · N
 * clientes · X sin leer». Hidden for someone in no client channel. It starts
 * with the newest four (José 29/10), «Ver más» opens ten more, and past four a
 * field filters by client name or RUC.
 */
export function ClientsSection(props: { live: Entry[]; query: string; archived: number; archivedUnread: number; folded: boolean; onToggle: () => void; openChatId: string | null; onOpen: (chat: ChatSummary) => void; onArchived: () => void }) {
  const colors = useColores();
  const [shown, setShown] = useState(CLIENTS_PREVIEW);
  const [filter, setFilter] = useState('');
  if (props.live.length === 0 && props.archived === 0) return null;
  const now = new Date();
  const page = pageLiveClients(props.live, { query: props.query || filter, shown });
  return (
    <View testID="seccion-clientes" className="border-t border-outline/10 pt-1">
      <Pressable testID="plegar-clientes" onPress={props.onToggle} className="min-h-[44px] flex-row items-center px-4">
        <Text className="flex-1 text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">{`Clientes · ${props.live.length}`}</Text>
        {props.folded ? <ChevronRight size={18} color={colors['on-surface-variant']} /> : <ChevronDown size={18} color={colors['on-surface-variant']} />}
      </Pressable>
      {props.folded ? null : (
        <>
          {props.live.length > CLIENTS_PREVIEW && !props.query ? (
            <View className="mx-4 mb-1 h-10 flex-row items-center gap-2 rounded-xl bg-surface px-3">
              <Search size={16} color={colors['on-surface-variant']} />
              <TextInput testID="filtro-clientes" value={filter} onChangeText={setFilter} placeholder="Filtrar por cliente o RUC" placeholderTextColor={colors['on-surface-variant']} className="flex-1 text-[14px] text-on-surface" />
            </View>
          ) : null}
          {page.entries.map((entry) => <ClientRow key={entry.client.id} entry={entry} now={now} open={entry.client.chat_id === props.openChatId} onOpen={props.onOpen} />)}
          {(props.query || filter) && page.entries.length === 0 ? <Text className="px-4 py-2 text-[13px] text-on-surface-variant">Ningún cliente con ese nombre.</Text> : null}
          {page.hidden > 0 ? (
            <Pressable testID="clientes-ver-mas" onPress={() => setShown((before) => before + CLIENTS_PAGE)} className="min-h-[44px] justify-center px-4">
              <Text className="text-[14px] font-semibold text-primary">{`Ver más · ${page.hidden}`}</Text>
            </Pressable>
          ) : null}
          {props.archived > 0 ? (
            <Pressable testID="clientes-archivados" onPress={props.onArchived} android_ripple={{ color: colors.outline }} className="min-h-[52px] flex-row items-center gap-3 px-4">
              <Archive size={20} color={colors['on-surface-variant']} />
              <Text numberOfLines={1} className="flex-1 text-[15px] text-on-surface">{`Archivados · ${props.archived} ${props.archived === 1 ? 'cliente' : 'clientes'}`}</Text>
              {props.archivedUnread > 0 ? <Text className="text-[14px] font-semibold text-primary">{`${props.archivedUnread} sin leer`}</Text> : null}
              <ChevronRight size={18} color={colors['on-surface-variant']} />
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

export function ClientRow(props: { entry: Entry; now: Date; open: boolean; onOpen: (chat: ChatSummary) => void }) {
  const colors = useColores();
  const { client, chat } = props.entry;
  const unread = (chat?.unread ?? 0) > 0;
  return (
    <Pressable testID={`cliente-fila-${client.id}`} disabled={!chat} onPress={() => chat && props.onOpen(chat)} android_ripple={{ color: colors.outline }} className={`min-h-[64px] flex-row items-center gap-3 px-4 py-2 ${props.open ? 'bg-surface' : ''}`}>
      <View className="h-11 w-11 items-center justify-center rounded-xl border border-outline/15 bg-surface">
        <Building2 size={20} color={unread ? colors.primary : colors['on-surface-variant']} />
      </View>
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className={`text-[16px] text-on-surface ${unread ? 'font-bold' : 'font-semibold'}`}>{client.name}</Text>
        <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">{clientRowSubtitle(client, props.now)}</Text>
      </View>
      <View className="items-end gap-1">
        {chat?.lastMessage ? <Text className={`text-[12px] ${unread ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}>{formatChatTimestamp(chat.lastMessage.at)}</Text> : null}
        {unread ? <View className="h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-1.5"><Text className="text-[12px] font-bold text-on-primary">{chat?.unread}</Text></View> : null}
      </View>
    </Pressable>
  );
}
