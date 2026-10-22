import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Archive, AtSign, ChevronDown, ChevronRight, Hash, Inbox, Lock, MessagesSquare, Plus, Search, Settings2, UserCog, UserPlus, Users } from 'lucide-react-native';
import { canManageMembers, formatChatTimestamp, membersLabel, nombreDeContacto, spaceSections, splitArchived, type ActivityType, type ClientWorkspace, type SpaceSectionKey } from '@lilachat/shared';
import type { ChatSummary } from '../api/client';
import { BarraDeSeleccionDeChats } from '../chat/BarraDeSeleccionDeChats';
import { FilaDeChat } from '../chat/FilaDeChat';
import { useAccionesDeSeleccion } from '../chat/useAccionesDeSeleccion';
import { useChatSelection } from '../chat/useChatSelection';
import { getSocket } from '../chat/socketClient';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { useAlVolver } from '../ui/useAlVolver';
import { useColores } from '../ui/tema';
import { spaceActivity, spaceChats } from './spacesApi';

/** Several messages in a row reload the list once. */
const RELOAD_DELAY_MS = 600;

/**
 * The chats of a company space by sections, like Slack (E1/E2; design
 * `s-03-lista-con-secciones`): CANALES as short rows with «+ Agregar canal»,
 * GRUPOS and MENSAJES DIRECTOS as in the personal list, each section folded
 * with its arrow. Every chat here opens in the Slack format. The design's
 * Hilos and Menciones chips come with the mentions tab.
 */
export type WorkspaceLink = 'directory' | 'members' | 'requests' | 'settings';

export function SpaceChatsScreen(props: { space: ClientWorkspace; jwt: string; myUserId: string; active: boolean; openChatId: string | null; reloadKey?: number; onOpenChat: (chat: ChatSummary) => void; onChannels: () => void; onInvite: () => void; onWorkspace: (link: WorkspaceLink) => void; onNewDirect: () => void; onNewGroup: () => void; onChats?: (chats: ChatSummary[]) => void; onRefresh?: () => void; onActivity: (tab: ActivityType) => void }) {
  const colors = useColores();
  const { space, jwt, myUserId, onOpenChat } = props;
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [folded, setFolded] = useState<ReadonlySet<SpaceSectionKey>>(new Set());
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** This space's chats, for the socket events that only concern them. */
  const chatIds = useRef<ReadonlySet<string>>(new Set());

  const [activity, setActivity] = useState({ mentions: 0, threads: 0 });
  const load = useCallback(async () => {
    const [response, counts] = await Promise.all([spaceChats(jwt, space.id), spaceActivity(jwt, space.id, { countsOnly: true })]);
    if (counts.ok) setActivity(counts.data.unread);
    if (response.ok) {
      chatIds.current = new Set(response.data.chats.map((chat) => chat.id));
      setChats(response.data.chats);
      setFailed(false);
    } else setFailed(true);
  }, [jwt, space.id]);
  useEffect(() => {
    void load();
  }, [load, props.reloadKey]);
  const { onChats } = props;
  useEffect(() => {
    if (chats) onChats?.(chats);
  }, [chats, onChats]);
  useAlVolver(props.active, () => void load());
  // A message in one of these chats moves it up: the list asks again, once for a burst.
  useEffect(() => {
    const socket = getSocket();
    const onMessage = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => void load(), RELOAD_DELAY_MS);
    };
    // I read one of these chats (here or on another device): its count and the chips go down.
    const onReceipt = (frame: { chatId?: string; userId?: string }) => {
      if (frame.userId === myUserId && frame.chatId && chatIds.current.has(frame.chatId)) onMessage();
    };
    socket?.on('msg.new', onMessage);
    socket?.on('chat.changed', onMessage);
    socket?.on('receipt', onReceipt);
    return () => {
      socket?.off('msg.new', onMessage);
      socket?.off('chat.changed', onMessage);
      socket?.off('receipt', onReceipt);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [load, myUserId]);

  // Holding a group or a 1:1 selects it, like the personal list: archive, pin, mute, read, leave.
  const selection = useChatSelection(chats);
  const batch = useAccionesDeSeleccion({ jwt, seleccionados: selection.selectedChats, limpiarSeleccion: selection.clear, recargar: load });
  useEffect(() => {
    if (!selection.selecting) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      selection.clear();
      return true;
    });
    return () => subscription.remove();
  }, [selection.selecting, selection.clear]);

  const agenda = agendaPorTelefono();
  const title = useCallback((chat: ChatSummary) => nombreDeContacto({ delServidor: chat.name, telefono: chat.phone, agenda }) || 'Conversación', [agenda]);
  const [openArchived, setOpenArchived] = useState(false);
  // An archived chat leaves the sections, like in the personal list; «Archivados» shows them.
  const split = useMemo(() => splitArchived(chats ?? [], openArchived), [chats, openArchived]);
  const sections = useMemo(() => {
    const visible = split.shown.filter((chat) => !query.trim() || title(chat).toLowerCase().includes(query.trim().toLowerCase()));
    return spaceSections(visible.map((chat) => ({ ...chat, lastAt: chat.lastMessage?.at })));
  }, [split, query, title]);
  const toggle = (key: SpaceSectionKey) => setFolded((before) => {
    const next = new Set(before);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const tapRow = useCallback((chat: ChatSummary) => (selection.selecting ? selection.toggle(chat.id) : onOpenChat(chat)), [selection.selecting, selection.toggle, onOpenChat]);

  return (
    <ScrollView testID="lista-del-espacio" contentContainerStyle={{ paddingBottom: 96 }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); props.onRefresh?.(); void load().finally(() => setRefreshing(false)); }} />}>
      {selection.selecting ? (
        <BarraDeSeleccionDeChats
          cantidad={selection.selected.size}
          acciones={selection.actions}
          onCancelar={selection.clear}
          onLectura={(read) => void batch.cambiarLectura(read)}
          onFijar={(pinned) => void batch.aplicarAjuste({ pinned })}
          onSilenciar={(muted) => void batch.aplicarAjuste({ muted })}
          onArchivar={(archived) => void batch.aplicarAjuste({ archived })}
          onSalir={() => void batch.salirDeGrupos()}
          onEliminar={batch.eliminarChats}
        />
      ) : (
        <View className="mx-4 mb-2 min-h-[48px] flex-row items-center gap-2 rounded-xl border border-outline/20 bg-surface px-3">
          <Search size={18} color={colors['on-surface-variant']} />
          <TextInput testID="buscar-en-espacio" value={query} onChangeText={setQuery} placeholder={`Buscar en ${space.name}`} placeholderTextColor={colors['on-surface-variant']} className="flex-1 text-[15px] text-on-surface" />
        </View>
      )}
      {/* «Hilos» and «Menciones» (design s-03), with what is new: they open «Menciones y actividad» (e-19). */}
      <View className="mx-4 mb-2 flex-row gap-2">
        <ActivityChip testID="chip-hilos" Icon={MessagesSquare} label="Hilos" count={activity.threads} onPress={() => props.onActivity('threads')} />
        <ActivityChip testID="chip-menciones" Icon={AtSign} label="Menciones" count={activity.mentions} onPress={() => props.onActivity('mentions')} />
      </View>
      <WorkspaceLinks space={space} onOpen={props.onWorkspace} />
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
                {section.key === 'channels' ? null : (
                  <Pressable testID={`nuevo-${section.key}`} onPress={section.key === 'groups' ? props.onNewGroup : props.onNewDirect} accessibilityLabel={section.key === 'groups' ? 'Nuevo grupo' : 'Nuevo mensaje directo'} hitSlop={8} className="mr-2 h-9 w-9 items-center justify-center">
                    <Plus size={18} color={colors['on-surface-variant']} />
                  </Pressable>
                )}
                {folded.has(section.key) ? <ChevronRight size={18} color={colors['on-surface-variant']} /> : <ChevronDown size={18} color={colors['on-surface-variant']} />}
              </Pressable>
              {folded.has(section.key)
                ? null
                : section.chats.map((chat) =>
                    section.key === 'channels' ? (
                      <ChannelRow key={chat.id} chat={chat} open={chat.id === props.openChatId} onOpen={() => props.onOpenChat(chat)} />
                    ) : (
                      <FilaDeChat key={chat.id} chat={chat} titulo={title(chat)} miUserId={props.myUserId} marcado={selection.selected.has(chat.id)} enLinea={false} escribiendo={false} onTocar={tapRow} onMantener={selection.toggle} open={chat.id === props.openChatId} />
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
      {split.archived > 0 ? (
        <Pressable testID="espacio-archivados" onPress={() => setOpenArchived((open) => !open)} className="min-h-[48px] flex-row items-center gap-3 border-t border-outline/10 px-4">
          <Archive size={18} color={colors['on-surface-variant']} />
          <Text className="flex-1 text-[15px] text-on-surface-variant">{openArchived ? 'Volver a los chats del espacio' : `Archivados (${split.archived})`}</Text>
        </Pressable>
      ) : null}
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

/**
 * «Espacio de trabajo» on top of the list (the desktop designs `e1-05` and
 * `e1-06`): the directory for everyone; members and roles, requests (with how
 * many wait) and the settings for those who manage the space.
 */
function WorkspaceLinks(props: { space: ClientWorkspace; onOpen: (link: WorkspaceLink) => void }) {
  const colors = useColores();
  const admin = canManageMembers(props.space.role);
  const pending = props.space.pendingRequests ?? 0;
  const row = (link: WorkspaceLink, Icon: typeof Users, label: string, trailing?: string, highlight?: boolean) => (
    <Pressable key={link} testID={`espacio-${link}`} onPress={() => props.onOpen(link)} className="min-h-[44px] flex-row items-center gap-3 px-4">
      <Icon size={18} color={highlight ? colors.primary : colors['on-surface-variant']} />
      <Text className={`flex-1 text-[15px] ${highlight ? 'font-bold text-on-surface' : 'text-on-surface'}`}>{label}</Text>
      {trailing ? (
        <Text className={highlight ? 'h-6 min-w-[24px] rounded-full bg-primary px-1.5 text-center text-[12px] font-bold leading-6 text-on-primary' : 'text-[13px] text-on-surface-variant'}>{trailing}</Text>
      ) : null}
    </Pressable>
  );
  return (
    <View testID="seccion-espacio-de-trabajo" className="mb-1">
      <Text className="px-4 pb-1 pt-1 text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Espacio de trabajo</Text>
      {row('directory', Users, 'Directorio de equipo', membersLabel(props.space.members))}
      {admin ? row('members', UserCog, 'Miembros y roles') : null}
      {admin && pending > 0 ? row('requests', Inbox, 'Solicitudes', String(pending), true) : null}
      {admin ? row('settings', Settings2, 'Ajustes del espacio') : null}
    </View>
  );
}

function ActivityChip(props: { testID: string; Icon: typeof AtSign; label: string; count: number; onPress: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID={props.testID} onPress={props.onPress} className="min-h-[44px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-outline/20 bg-surface">
      <props.Icon size={17} color={colors.primary} />
      <Text className="text-[15px] font-semibold text-on-surface">{props.label}</Text>
      {props.count > 0 ? <Text className="h-6 min-w-[24px] rounded-full bg-primary px-1.5 text-center text-[12px] font-bold leading-6 text-on-primary">{props.count}</Text> : null}
    </Pressable>
  );
}
