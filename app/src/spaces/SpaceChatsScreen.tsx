import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Archive, AtSign, ChevronDown, ChevronRight, Hash, Inbox, Lock, MessagesSquare, Plus, Search, UserPlus } from 'lucide-react-native';
import { aplicarMensajeALista, canManageMembers, clientChatIds, formatChatTimestamp, marcarLeido, nombreDeContacto, spaceSections, splitArchived, splitClients, type ActivityType, type ClientWorkspace, type SpaceSectionKey } from '@lilachat/shared';
import type { MensajeEnVivo as LiveMessage } from '@lilachat/shared';
import type { ChatSummary } from '../api/client';
import { BarraDeSeleccionDeChats } from '../chat/BarraDeSeleccionDeChats';
import { FilaDeChat, PendingMarker } from '../chat/FilaDeChat';
import { useAccionesDeSeleccion } from '../chat/useAccionesDeSeleccion';
import { useChatSelection } from '../chat/useChatSelection';
import { getSocket } from '../chat/socketClient';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { useAlVolver } from '../ui/useAlVolver';
import { useColores } from '../ui/tema';
import { fetchSpaceChats, isSpaceChat, rememberMyRead, spaceChatsCache, useCached } from './spaceCache';
import { chatsEnMemoria } from '../chat/chatsGuardados';
import { AppsSection } from './apps/AppsSection';
import type { SpaceApps } from './apps/useSpaceApps';
import { useSpaceClients } from './clients/useSpaceClients';
import { ClientsSection } from './clients/ClientsSection';
import { ArchivedClientsScreen } from './clients/ArchivedClientsScreen';

/** Several messages in a row reload the list once. */
const RELOAD_DELAY_MS = 600;
const NO_ACTIVITY = { mentions: 0, threads: 0 };
/** A chat of the personal list: its events are not this space's. */
const isInMyChatList = (chatId: string) => Boolean(chatsEnMemoria()?.some((chat) => chat.id === chatId));

/**
 * The chats of a company space by sections, like Slack (E1/E2; design
 * `s-03-lista-con-secciones`): CANALES as short rows with «+ Agregar canal»,
 * GRUPOS and MENSAJES DIRECTOS as in the personal list, each section folded
 * with its arrow. Every chat here opens in the Slack format. The design's
 * Hilos and Menciones chips come with the mentions tab.
 */
export type WorkspaceLink = 'directory' | 'members' | 'requests' | 'settings';

export function SpaceChatsScreen(props: { space: ClientWorkspace; jwt: string; myUserId: string; active: boolean; openChatId: string | null; reloadKey?: number; onOpenChat: (chat: ChatSummary) => void; onChannels: () => void; onInvite: () => void; onWorkspace: (link: WorkspaceLink) => void; onNewDirect: () => void; onChats?: (chats: ChatSummary[]) => void; onRefresh?: () => void; onActivity: (tab: ActivityType) => void; apps?: SpaceApps; onExploreApps?: () => void }) {
  const colors = useColores();
  const { space, jwt, myUserId, onOpenChat } = props;
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [folded, setFolded] = useState<ReadonlySet<SpaceSectionKey>>(new Set());
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The space's list (and its chips) paints at once from what was seen and refreshes behind (22/10).
  const key = `${space.id}:chats`;
  const page = useCached(spaceChatsCache, key, fetchSpaceChats(jwt, space.id));
  const chats = page.value?.chats ?? null;
  const activity = page.value?.activity ?? NO_ACTIVITY;
  const failed = !page.value && Boolean(page.error);
  const { refresh } = page;
  const load = useCallback(async () => {
    await spaceChatsCache.revalidate(key, fetchSpaceChats(jwt, space.id), { force: true });
  }, [key, jwt, space.id]);
  useEffect(() => {
    if (props.reloadKey) refresh();
  }, [props.reloadKey, refresh]);
  const { onChats } = props;
  useEffect(() => {
    if (chats) onChats?.(chats);
  }, [chats, onChats]);
  useAlVolver(props.active, () => refresh());
  /**
   * Socket events applied in place (22/10): a message in one of these chats
   * changes its row, reading one lowers its count; only an unknown chat, a
   * changed one or a possible mention or thread asks the server, once per burst.
   * Before, ANY message, also of personal chats, reloaded the list and the chips.
   */
  const openChat = useRef(props.openChatId);
  openChat.current = props.openChatId;
  useEffect(() => {
    const socket = getSocket();
    const reloadSoon = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => void load(), RELOAD_DELAY_MS);
    };
    const inList = (chatId?: string) => Boolean(chatId && spaceChatsCache.get(key).value?.chats.some((chat) => chat.id === chatId));
    const patchChats = (change: (current: ChatSummary[]) => ChatSummary[] | null) =>
      spaceChatsCache.patch(key, (current) => {
        const next = change(current.chats);
        return next && next !== current.chats ? { ...current, chats: next } : current;
      });
    const onMessage = (message: LiveMessage) => {
      if (!inList(message.chatId)) {
        // A new chat of this space (not a personal one, not another space's) is asked for.
        if (!isSpaceChat(message.chatId) && !isInMyChatList(message.chatId)) reloadSoon();
        return;
      }
      patchChats((current) => aplicarMensajeALista(current, message, myUserId, openChat.current));
      if (message.hiloDe !== undefined || message.body?.includes('@')) reloadSoon();
    };
    const onChanged = (frame: { chatId?: string }) => {
      if (!frame.chatId || inList(frame.chatId) || !isInMyChatList(frame.chatId)) reloadSoon();
    };
    // I read one of these chats (here or on another device): its count goes down.
    const onReceipt = (frame: { chatId?: string; userId?: string; readSeq?: number }) => {
      if (frame.userId !== myUserId || !frame.chatId) return;
      rememberMyRead(frame.chatId, frame.readSeq);
      if (inList(frame.chatId)) patchChats((current) => marcarLeido(current, frame.chatId!));
    };
    socket?.on('msg.new', onMessage);
    socket?.on('chat.changed', onChanged);
    socket?.on('receipt', onReceipt);
    return () => {
      socket?.off('msg.new', onMessage);
      socket?.off('chat.changed', onChanged);
      socket?.off('receipt', onReceipt);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [key, load, myUserId]);

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
  // Pending 21: the client channels leave «Canales» for «Clientes» and its «Archivados» (designs f-01, f-02).
  const clients = useSpaceClients(jwt, space.id, useMemo(() => (chats ?? []).filter((chat) => chat.kind === 'group').map((chat) => chat.id).join(','), [chats]));
  const [foldedClients, setFoldedClients] = useState(false);
  const [openArchivedClients, setOpenArchivedClients] = useState(false);
  const clientIds = useMemo(() => clientChatIds(clients ?? []), [clients]);
  const sections = useMemo(() => {
    const visible = split.shown.filter((chat) => !clientIds.has(chat.id) && (!query.trim() || title(chat).toLowerCase().includes(query.trim().toLowerCase())));
    return spaceSections(visible.map((chat) => ({ ...chat, lastAt: chat.lastMessage?.at })));
  }, [split, query, title, clientIds]);
  // The list's search reaches the clients too; ClientsSection pages them (José 29/10).
  const clientSplit = useMemo(() => splitClients(clients ?? [], (chats ?? []).map((chat) => ({ ...chat, lastAt: chat.lastMessage?.at }))), [clients, chats]);
  const toggle = (key: SpaceSectionKey) => setFolded((before) => {
    const next = new Set(before);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const tapRow = useCallback((chat: ChatSummary) => (selection.selecting ? selection.toggle(chat.id) : onOpenChat(chat)), [selection.selecting, selection.toggle, onOpenChat]);
  // «Apps» (design e-23) also under the welcome: someone just added, in no channel yet, already has the space's apps.
  const appsSection = (appChats: ChatSummary[]) =>
    props.apps ? (
      <AppsSection
        key="apps"
        chats={appChats}
        apps={props.apps}
        folded={folded.has('apps')}
        openChatId={props.openChatId}
        onToggle={() => toggle('apps')}
        onExplore={() => props.onExploreApps?.()}
        renderChat={(chat, app) => <FilaDeChat key={chat.id} chat={chat} titulo={app?.name ?? title(chat)} miUserId={props.myUserId} marcado={selection.selected.has(chat.id)} enLinea={false} escribiendo={false} onTocar={tapRow} onMantener={selection.toggle} open={chat.id === props.openChatId} app={{ avatarUrl: app?.avatarUrl }} />}
      />
    ) : null;

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
      <PendingRequestsRow space={space} onOpen={props.onWorkspace} />
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
      {chats !== null && chats.length === 0 && !query ? appsSection([]) : null}
      {chats !== null ? <ClientsSection jwt={props.jwt} spaceId={space.id} live={clientSplit.live} query={query} archived={clientSplit.archived.length} archivedUnread={clientSplit.archivedUnread} folded={foldedClients} onToggle={() => setFoldedClients((before) => !before)} openChatId={props.openChatId} onOpen={onOpenChat} onArchived={() => setOpenArchivedClients(true)} /> : null}
      {openArchivedClients ? <ArchivedClientsScreen archived={clientSplit.archived} onClose={() => setOpenArchivedClients(false)} onOpen={(chat) => { setOpenArchivedClients(false); onOpenChat(chat); }} /> : null}
      {chats !== null && (chats.length > 0 || query)
        ? sections.map((section) => section.key === 'apps' ? (
            appsSection(section.chats)
          ) : (
            <View key={section.key} testID={`seccion-${section.key}`} className="border-t border-outline/10 pt-1">
              <Pressable testID={`plegar-${section.key}`} onPress={() => toggle(section.key)} className="min-h-[44px] flex-row items-center px-4">
                <Text className="flex-1 text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">{section.title}</Text>
                {/* A space creates channels, not groups (pending 109, José 28/10): only direct messages have a «+» here. */}
                {section.key === 'directs' ? (
                  <Pressable testID="nuevo-directs" onPress={props.onNewDirect} accessibilityLabel="Nuevo mensaje directo" hitSlop={8} className="mr-2 h-9 w-9 items-center justify-center">
                    <Plus size={18} color={colors['on-surface-variant']} />
                  </Pressable>
                ) : null}
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
      <PendingMarker chatId={chat.id} />
      {unread ? (
        <View className="h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-1.5"><Text className="text-[12px] font-bold text-on-primary">{chat.unread}</Text></View>
      ) : chat.lastMessage ? (
        <Text className="text-[13px] text-on-surface-variant">{formatChatTimestamp(chat.lastMessage.at)}</Text>
      ) : null}
    </Pressable>
  );
}

/**
 * Only the waiting requests stay on top of the list, for the admins (José
 * 30/10: the «Espacio de trabajo» section only took room). The directory,
 * members and settings already live in the Directorio and Ajustes tabs.
 */
function PendingRequestsRow(props: { space: ClientWorkspace; onOpen: (link: WorkspaceLink) => void }) {
  const colors = useColores();
  const pending = canManageMembers(props.space.role) ? props.space.pendingRequests ?? 0 : 0;
  if (pending === 0) return null;
  return (
    <Pressable testID="espacio-requests" onPress={() => props.onOpen('requests')} className="mx-4 mb-2 min-h-[44px] flex-row items-center gap-3 rounded-xl bg-primary/10 px-4">
      <Inbox size={18} color={colors.primary} />
      <Text className="flex-1 text-[15px] font-bold text-on-surface">Solicitudes</Text>
      <Text className="h-6 min-w-[24px] rounded-full bg-primary px-1.5 text-center text-[12px] font-bold leading-6 text-on-primary">{String(pending)}</Text>
    </Pressable>
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
