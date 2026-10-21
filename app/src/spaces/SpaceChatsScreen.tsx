import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronRight, Hash, Lock, Plus, Search, UserPlus } from 'lucide-react-native';
import { formatChatTimestamp, nombreDeContacto, spaceSections, type ClientWorkspace, type SpaceSectionKey } from '@lilachat/shared';
import type { ChatSummary } from '../api/client';
import { FilaDeChat } from '../chat/FilaDeChat';
import { getSocket } from '../chat/socketClient';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { useAlVolver } from '../ui/useAlVolver';
import { useColores } from '../ui/tema';
import { spaceChats } from './spacesApi';

/** Several messages in a row reload the list once. */
const RELOAD_DELAY_MS = 600;

/**
 * The chats of a company space by sections, like Slack (E1/E2; design
 * `s-03-lista-con-secciones`): CANALES as short rows with «+ Agregar canal»,
 * GRUPOS and MENSAJES DIRECTOS as in the personal list, each section folded
 * with its arrow. Every chat here opens in the Slack format. The design's
 * Hilos and Menciones chips come with the mentions tab.
 */
export function SpaceChatsScreen(props: { space: ClientWorkspace; jwt: string; myUserId: string; active: boolean; openChatId: string | null; onOpenChat: (chat: ChatSummary) => void; onChannels: () => void; onInvite: () => void }) {
  const colors = useColores();
  const { space, jwt } = props;
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [folded, setFolded] = useState<ReadonlySet<SpaceSectionKey>>(new Set());
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const response = await spaceChats(jwt, space.id);
    if (response.ok) {
      setChats(response.data.chats);
      setFailed(false);
    } else setFailed(true);
  }, [jwt, space.id]);
  useEffect(() => {
    setChats(null);
    void load();
  }, [load]);
  useAlVolver(props.active, () => void load());
  // A message in one of these chats moves it up: the list asks again, once for a burst.
  useEffect(() => {
    const socket = getSocket();
    const onMessage = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => void load(), RELOAD_DELAY_MS);
    };
    socket?.on('msg.new', onMessage);
    socket?.on('chat.changed', onMessage);
    return () => {
      socket?.off('msg.new', onMessage);
      socket?.off('chat.changed', onMessage);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [load]);

  const agenda = agendaPorTelefono();
  const title = useCallback((chat: ChatSummary) => nombreDeContacto({ delServidor: chat.name, telefono: chat.phone, agenda }) || 'Conversación', [agenda]);
  const sections = useMemo(() => {
    const visible = (chats ?? []).filter((chat) => !query.trim() || title(chat).toLowerCase().includes(query.trim().toLowerCase()));
    return spaceSections(visible.map((chat) => ({ ...chat, lastAt: chat.lastMessage?.at })));
  }, [chats, query, title]);
  const toggle = (key: SpaceSectionKey) => setFolded((before) => {
    const next = new Set(before);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const noop = useCallback(() => undefined, []);

  return (
    <ScrollView testID="lista-del-espacio" contentContainerStyle={{ paddingBottom: 96 }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} />}>
      <View className="mx-4 mb-2 min-h-[48px] flex-row items-center gap-2 rounded-xl border border-outline/20 bg-surface px-3">
        <Search size={18} color={colors['on-surface-variant']} />
        <TextInput testID="buscar-en-espacio" value={query} onChangeText={setQuery} placeholder={`Buscar en ${space.name}`} placeholderTextColor={colors['on-surface-variant']} className="flex-1 text-[15px] text-on-surface" />
      </View>
      {failed && chats === null ? (
        <Pressable onPress={() => void load()} className="mx-4 mt-3 rounded-xl bg-error/10 px-4 py-3"><Text className="text-[13px] text-error">No se pudo cargar el espacio. Toca para reintentar.</Text></Pressable>
      ) : null}
      {chats === null && !failed ? [0, 1, 2, 3].map((index) => <View key={index} className="mx-4 mb-2 h-12 rounded-xl bg-surface-variant" />) : null}
      {chats !== null && chats.length === 0 && !query ? (
        <View testID="espacio-vacio" className="mx-4 mt-2 rounded-2xl border border-outline/15 bg-surface p-4">
          <Text className="text-[16px] font-bold text-on-surface">{`Bienvenido a ${space.name}`}</Text>
          <Text className="mt-1 text-[14px] text-on-surface-variant">Únete a un canal o crea el primero, e invita a tu equipo.</Text>
          <View className="mt-3 flex-row gap-2">
            <Pressable testID="espacio-ver-canales" onPress={props.onChannels} className="min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-primary"><Hash size={16} color={colors['on-primary']} /><Text className="text-[14px] font-bold text-on-primary">Canales</Text></Pressable>
            <Pressable testID="espacio-invitar" onPress={props.onInvite} className="min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-outline/20"><UserPlus size={16} color={colors.primary} /><Text className="text-[14px] font-semibold text-on-surface">Invitar</Text></Pressable>
          </View>
        </View>
      ) : null}
      {chats !== null && (chats.length > 0 || query)
        ? sections.map((section) => (
            <View key={section.key} testID={`seccion-${section.key}`} className="border-t border-outline/10 pt-1">
              <Pressable testID={`plegar-${section.key}`} onPress={() => toggle(section.key)} className="min-h-[44px] flex-row items-center px-4">
                <Text className="flex-1 text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">{section.title}</Text>
                {folded.has(section.key) ? <ChevronRight size={18} color={colors['on-surface-variant']} /> : <ChevronDown size={18} color={colors['on-surface-variant']} />}
              </Pressable>
              {folded.has(section.key)
                ? null
                : section.chats.map((chat) =>
                    section.key === 'channels' ? (
                      <ChannelRow key={chat.id} chat={chat} open={chat.id === props.openChatId} onOpen={() => props.onOpenChat(chat)} />
                    ) : (
                      <FilaDeChat key={chat.id} chat={chat} titulo={title(chat)} miUserId={props.myUserId} marcado={false} enLinea={false} escribiendo={false} onTocar={props.onOpenChat} onMantener={noop} open={chat.id === props.openChatId} />
                    )
                  )}
              {section.key === 'channels' && !folded.has('channels') ? (
                <Pressable testID="agregar-canal" onPress={props.onChannels} className="min-h-[44px] flex-row items-center gap-3 px-4">
                  <Plus size={18} color={colors['on-surface-variant']} />
                  <Text className="text-[15px] text-on-surface-variant">Agregar canal</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        : null}
    </ScrollView>
  );
}

/** A channel as a short row (design `s-03`): «# name», bold with something new, and its time, count or dot. */
function ChannelRow(props: { chat: ChatSummary; open: boolean; onOpen: () => void }) {
  const colors = useColores();
  const { chat } = props;
  const unread = chat.unread > 0;
  const Icon = chat.channel?.visibility === 'private' ? Lock : Hash;
  return (
    <Pressable testID={`canal-fila-${chat.id}`} onPress={props.onOpen} android_ripple={{ color: colors.outline }} className={`min-h-[48px] flex-row items-center gap-3 px-4 ${props.open ? 'bg-surface' : ''}`}>
      <Icon size={18} color={unread ? colors.primary : colors['on-surface-variant']} />
      <Text numberOfLines={1} className={`flex-1 text-[16px] ${unread ? 'font-bold text-on-surface' : 'text-on-surface'}`}>{chat.name}</Text>
      {unread ? (
        <View className="h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-1.5"><Text className="text-[12px] font-bold text-on-primary">{chat.unread}</Text></View>
      ) : chat.lastMessage ? (
        <Text className="text-[13px] text-on-surface-variant">{formatChatTimestamp(chat.lastMessage.at)}</Text>
      ) : null}
    </Pressable>
  );
}
