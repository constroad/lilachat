import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View, type ListRenderItemInfo } from 'react-native';
import { CalendarClock, Check, ChevronDown, ChevronRight, ChevronUp, FolderOpen, MessagesSquare } from 'lucide-react-native';
import { arrivedThisMonth, followUpsLineOf, followUpsOf, inboxRowsOf, inboxUnreadByView, nombreDeContacto, shownInboxOf, type FoldPlace, type InboxFold, type InboxRow, type InboxView, type ProspectInbox, type ProspectView } from '@lilachat/shared';
import type { ChatSummary } from '../../api/client';
import { FilaDeChat } from '../../chat/FilaDeChat';
import { agendaPorTelefono } from '../../contacts/agendaEnMemoria';
import { Rotulo } from '../../ui/Rotulo';
import { Segmentado } from '../../ui/Segmentado';
import { Sheet } from '../../ui/Sheet';
import { useColores } from '../../ui/tema';
import { EmptyNote, SkeletonRows, TextButton } from './daliParts';
import { ProspectRow } from './ProspectRow';
import type { ProspectList } from './prospectsApi';

type Props = {
  list: ProspectList | null;
  failed: boolean;
  onRetry: () => void;
  onRefresh: () => void;
  /** The space's chats: only used here for each prospect's unread count (the Chats tab shows the rest). */
  chats: ChatSummary[] | null;
  myUserId: string;
  openChatId: string | null;
  service?: string;
  onService: (key: string | undefined) => void;
  now: Date;
  onOpenProspect: (prospect: ProspectView) => void;
  onOpenChat: (chat: ChatSummary) => void;
  onFollowUps: () => void;
};
type Row = InboxRow<ChatSummary>;
type Service = { key: string; name: string; count: number };
type RowContext = { unreadOf: ReadonlyMap<string, number>; openChatId: string | null; now: Date; myUserId: string; onOpenProspect: (prospect: ProspectView) => void; onOpenChat: (chat: ChatSummary) => void; onRetry: () => void; onToggle: (fold: InboxFold) => void };

const SIDE_ROOM = 16;
const LIST_BOTTOM_ROOM = 24;
/** The pull's spinner never spins longer than this: `onRefresh` does not say when it is done. */
const REFRESH_LIMIT_MS = 8000;
/** Screens of rows kept mounted around the visible one: a low-end phone does not hold the whole month (as the emoji panel). */
const LIST_WINDOW = 7;
const ICON = 20;
const SMALL_ICON = 18;
const CLOSED: Readonly<Record<InboxFold, boolean>> = { consults: false, team: false };
const VIEWS: readonly { key: InboxView; etiqueta: string }[] = [
  { key: 'mine', etiqueta: 'Míos' },
  { key: 'unassigned', etiqueta: 'Sin asignar' },
  { key: 'all', etiqueta: 'Todos' },
];
const ALL_SERVICES = 'Todos los servicios';
const FOLD_TEST_ID: Record<InboxFold, string> = { consults: 'solo-consultas', team: 'chats-del-equipo' };
/** NativeWind only sees literal classes: a row inside an open fold continues its card, and the last one closes it. */
const PROSPECT_SLOT: Record<FoldPlace, string> = {
  none: 'mb-2.5',
  inside: 'border-x border-outline/15 bg-surface-variant/30 px-3 pb-2.5',
  last: 'mb-2.5 rounded-b-xl border-x border-b border-outline/15 bg-surface-variant/30 px-3 pb-3',
};
const CHAT_SLOT: Record<FoldPlace, string> = {
  none: 'mb-2.5',
  inside: 'border-x border-outline/15 bg-surface',
  last: 'mb-2.5 overflow-hidden rounded-b-xl border-x border-b border-outline/15 bg-surface',
};
/** The inbox has no selection mode: holding a team chat does nothing (the space's own list archives and mutes). */
const NO_SELECTION = (_chatId: string): void => undefined;
/** Bandeja never folds team chats any more (promoted to the Chats tab, José 20/11): the fold stays empty. */
const NO_TEAM_CHATS: readonly ChatSummary[] = [];
const keyOf = (row: Row): string => row.key;

/**
 * The inbox of a Dali space on the APK (dl-01 v3): how many arrived this month, Míos · Sin asignar · Todos, the
 * service filter (José 16/11), «Seguimientos de hoy», the three sections, and «Solo consultas» folded (the team's
 * own chats live in the Chats tab, promoted there 20/11). One virtualized list: a month can bring 150 prospects.
 */
export function DaliInbox(props: Props) {
  const colors = useColores();
  const { list, now } = props;
  const [chosen, setChosen] = useState<InboxView | null>(null);
  const [open, setOpen] = useState(CLOSED);
  const prospects = useMemo(() => list?.prospects ?? [], [list]);
  const me = list?.me ?? props.myUserId;
  const { view, inbox } = useMemo(() => shownInboxOf(prospects, { me, chosen, service: props.service }, now), [prospects, me, chosen, props.service, now]);
  const rows = useMemo(() => inboxRowsOf({ list, failed: props.failed, inbox, teamChats: NO_TEAM_CHATS, open }), [list, props.failed, inbox, open]);
  const onToggle = useCallback((fold: InboxFold) => setOpen((before) => ({ ...before, [fold]: !before[fold] })), []);
  const context = useRowContext(props, me, onToggle);
  const renderRow = useCallback(({ item: row }: ListRenderItemInfo<Row>) => <InboxRowView row={row} context={context} />, [context]);
  const refresh = usePullToRefresh(list, props.failed, props.onRefresh);
  const unreadByView = useMemo(() => inboxUnreadByView(prospects, (chatId) => context.unreadOf.get(chatId) ?? 0, { me, service: props.service }), [prospects, context.unreadOf, me, props.service]);
  const header = <InboxHeader list={list} prospects={prospects} me={me} now={now} view={view} inbox={inbox} unreadByView={unreadByView} onView={setChosen} service={props.service} onService={props.onService} onFollowUps={props.onFollowUps} />;
  return (
    <FlatList
      testID="bandeja-dali"
      data={rows}
      keyExtractor={keyOf}
      renderItem={renderRow}
      extraData={context}
      windowSize={LIST_WINDOW}
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingHorizontal: SIDE_ROOM, paddingBottom: LIST_BOTTOM_ROOM }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refresh.refreshing} onRefresh={refresh.start} colors={[colors.primary]} />}
    />
  );
}

/** What every row needs from the inbox, in one stable object: the list redraws its rows only when it changes. */
function useRowContext(props: Props, me: string, onToggle: (fold: InboxFold) => void): RowContext {
  const { chats, openChatId, now, onOpenProspect, onOpenChat, onRetry } = props;
  const unreadOf = useMemo(() => new Map((chats ?? []).map((chat) => [chat.id, chat.unread])), [chats]);
  return useMemo(() => ({ unreadOf, openChatId, now, myUserId: me, onOpenProspect, onOpenChat, onRetry, onToggle }), [unreadOf, openChatId, now, me, onOpenProspect, onOpenChat, onRetry, onToggle]);
}

/** The pull's spinner turns while the list is read again: it stops when the list (or its failure) arrives. */
function usePullToRefresh(list: ProspectList | null, failed: boolean, onRefresh: () => void) {
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    setRefreshing(false);
  }, [list, failed]);
  useEffect(() => {
    if (!refreshing) return;
    const timer = setTimeout(() => setRefreshing(false), REFRESH_LIMIT_MS);
    return () => clearTimeout(timer);
  }, [refreshing]);
  const start = useCallback(() => {
    setRefreshing(true);
    onRefresh();
  }, [onRefresh]);
  return { refreshing, start };
}

type HeaderProps = { list: ProspectList | null; prospects: readonly ProspectView[]; me: string; now: Date; view: InboxView; inbox: ProspectInbox; unreadByView: Record<InboxView, number>; onView: (view: InboxView) => void; service?: string; onService: (key: string | undefined) => void; onFollowUps: () => void };

/** Over the rows: the month's arrivals (the shell's header has no subtitle), the views, the filter and today's follow-ups. */
function InboxHeader(props: HeaderProps) {
  const { list, inbox, now } = props;
  const followUps = useMemo(() => followUpsOf(props.prospects, props.me, now), [props.prospects, props.me, now]);
  const views = VIEWS.map((one) => ({ ...one, testID: `vista-bandeja-${one.key}`, cuenta: inbox.counts[one.key], sinLeer: props.unreadByView[one.key] }));
  return (
    <View className="gap-3 pt-3">
      {list ? <Text testID="llegados-mes" className="text-[13px] text-on-surface-variant">{`${arrivedThisMonth(list.prospects, now)} este mes · Dali contesta primero y te pasa los listos`}</Text> : null}
      <Segmentado opciones={views} valor={props.view} onCambiar={props.onView} />
      <ServiceFilter testID="filtro-servicio" services={inbox.services} value={props.service} onChange={props.onService} />
      {followUps.items.length > 0 ? <FollowUpsCard followUps={followUps} onOpen={props.onFollowUps} /> : null}
    </View>
  );
}

/** One row of the inbox, by kind: what each kind draws is decided in `inboxRowsOf`. */
function InboxRowView({ row, context }: { row: Row; context: RowContext }) {
  switch (row.kind) {
    case 'loading':
      return (
        <View className="mt-4">
          <SkeletonRows />
        </View>
      );
    case 'failed':
      return (
        <View className="mt-4">
          <EmptyNote title="No se pudo cargar la bandeja." action={<TextButton testID="reintentar-bandeja" onPress={context.onRetry}>Reintentar</TextButton>} />
        </View>
      );
    case 'empty':
      return (
        <View className="mt-4">
          <EmptyNote title={row.title}>{row.hint}</EmptyNote>
        </View>
      );
    case 'kicker':
      return (
        <View testID={`seccion-${row.section}`}>
          <Rotulo>{row.label}</Rotulo>
        </View>
      );
    case 'fold':
      return <FoldHeader fold={row.fold} title={row.title} hint={row.hint} open={row.open} onToggle={context.onToggle} />;
    case 'prospect':
      return (
        <View className={PROSPECT_SLOT[row.place]}>
          <ProspectRow prospect={row.prospect} unread={context.unreadOf.get(row.prospect.chatId)} selected={row.prospect.chatId === context.openChatId} now={context.now} onOpen={context.onOpenProspect} />
        </View>
      );
    case 'chat':
      return (
        <View className={CHAT_SLOT[row.place]}>
          <TeamChatRow chat={row.chat} context={context} />
        </View>
      );
  }
}

/** A team chat as the space's list draws it, under the name the phone's contacts give it. */
function TeamChatRow({ chat, context }: { chat: ChatSummary; context: RowContext }) {
  const title = nombreDeContacto({ delServidor: chat.name, telefono: chat.phone, agenda: agendaPorTelefono() }) || 'Conversación';
  return <FilaDeChat chat={chat} titulo={title} miUserId={context.myUserId} marcado={false} enLinea={false} escribiendo={false} onTocar={context.onOpenChat} onMantener={NO_SELECTION} open={chat.id === context.openChatId} />;
}

/** «Solo consultas · 56» and «Chats del equipo · 3»: folded until tapped; open, the rows under it continue its card. */
function FoldHeader(props: { fold: InboxFold; title: string; hint: string; open: boolean; onToggle: (fold: InboxFold) => void }) {
  const colors = useColores();
  const Icon = props.fold === 'consults' ? FolderOpen : MessagesSquare;
  const Arrow = props.open ? ChevronUp : ChevronDown;
  return (
    <Pressable
      testID={FOLD_TEST_ID[props.fold]}
      accessibilityRole="button"
      accessibilityState={{ expanded: props.open }}
      onPress={() => props.onToggle(props.fold)}
      className={`mt-4 min-h-[56px] flex-row items-center gap-3 border-outline/15 bg-surface-variant/30 px-4 ${props.open ? 'rounded-t-xl border-x border-t pb-2 pt-3' : 'mb-2.5 rounded-xl border py-3'}`}
    >
      <Icon size={ICON} color={colors['on-surface-variant']} />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-[15px] font-bold text-on-surface">{props.title}</Text>
        <Text numberOfLines={2} className="text-[13px] text-on-surface-variant">{props.hint}</Text>
      </View>
      <Arrow size={SMALL_ICON} color={colors['on-surface-variant']} />
    </Pressable>
  );
}

/** «Seguimientos de hoy» (dl-01 → dl-05), only when there is one: how many, and the late ones in red. */
function FollowUpsCard({ followUps, onOpen }: { followUps: ReturnType<typeof followUpsOf>; onOpen: () => void }) {
  const colors = useColores();
  const line = followUpsLineOf(followUps);
  return (
    <Pressable testID="seguimientos-de-hoy" accessibilityRole="button" onPress={onOpen} android_ripple={{ color: colors.outline }} className="min-h-[64px] flex-row items-center gap-3 overflow-hidden rounded-xl border border-outline/15 bg-surface px-4 py-3">
      <View className="absolute left-0 right-0 top-0 h-[3px] bg-primary" />
      <View className="h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <CalendarClock size={ICON} color={colors.primary} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-bold text-on-surface">Seguimientos de hoy</Text>
        <Text className="text-[13px] text-on-surface-variant">
          {line.today}
          {line.late ? <Text className="font-semibold text-error">{line.late}</Text> : null}
        </Text>
      </View>
      <ChevronRight size={SMALL_ICON} color={colors['on-surface-variant']} />
    </Pressable>
  );
}

const serviceLabelOf = (service: Service): string => `${service.name} · ${service.count}`;

/**
 * The service filter (José 16/11), only once the space has two services: the chosen one in a field that opens a
 * sheet with «Todos los servicios» and each service with its count. The funnel uses the same with its own testID.
 */
export function ServiceFilter(props: { testID: string; services: readonly Service[]; value?: string; onChange: (key: string | undefined) => void }) {
  const colors = useColores();
  const [open, setOpen] = useState(false);
  if (props.services.length < 2 && !props.value) return null;
  const current = props.services.find((service) => service.key === props.value);
  const shown = current ? serviceLabelOf(current) : (props.value ?? ALL_SERVICES);
  const pick = (key: string | undefined) => {
    setOpen(false);
    props.onChange(key);
  };
  return (
    <>
      <Pressable testID={props.testID} accessibilityRole="button" accessibilityLabel={`Servicio: ${shown}`} onPress={() => setOpen(true)} className="min-h-[44px] flex-row items-center gap-2 rounded-xl border border-outline/30 bg-surface px-3">
        <Text className="text-[13px] text-on-surface-variant">Servicio</Text>
        <Text numberOfLines={1} className="min-w-0 flex-1 text-[14px] font-semibold text-on-surface">{shown}</Text>
        <ChevronDown size={SMALL_ICON} color={colors['on-surface-variant']} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} testID={`hoja-${props.testID}`} dragArea="handle" maxHeight="70%">
        <Text className="px-5 pb-2 text-[17px] font-bold text-on-surface">Servicio</Text>
        <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
          <ServiceOption testID={`${props.testID}-todos`} chosen={!props.value} onPress={() => pick(undefined)}>{ALL_SERVICES}</ServiceOption>
          {props.services.map((service) => (
            <ServiceOption key={service.key} testID={`${props.testID}-${service.key}`} chosen={service.key === props.value} onPress={() => pick(service.key)}>
              {serviceLabelOf(service)}
            </ServiceOption>
          ))}
        </ScrollView>
      </Sheet>
    </>
  );
}

function ServiceOption(props: { testID: string; chosen: boolean; onPress: () => void; children: ReactNode }) {
  const colors = useColores();
  return (
    <Pressable testID={props.testID} accessibilityRole="button" accessibilityState={{ selected: props.chosen }} onPress={props.onPress} android_ripple={{ color: colors.outline }} className="min-h-[52px] flex-row items-center gap-3 px-5">
      <Text numberOfLines={1} className={`min-w-0 flex-1 text-[15px] ${props.chosen ? 'font-semibold text-primary' : 'text-on-surface'}`}>{props.children}</Text>
      {props.chosen ? <Check size={SMALL_ICON} color={colors.primary} /> : null}
    </Pressable>
  );
}
