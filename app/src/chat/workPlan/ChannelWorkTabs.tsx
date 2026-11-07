import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, ScrollView, Text, ToastAndroid, View } from 'react-native';
import { CHANNEL_TAB_LABELS, channelLinksOf, channelTabs, checklistMembers, withoutApps, type ChannelLinks, type ChannelTab, type ShortcutRow, type ShortcutValues, type SpaceClient, type WorkStage } from '@lilachat/shared';
import { useWorkPlan } from './useWorkPlan';
import { WorkPlanPanel } from './WorkPlanPanel';
import { PendingPanel } from './WorkListsPanels';
import { TaskDetailSheet, type OpenTask } from './TaskDetailSheet';
import { useClientOfChat, useClientRecords } from '../../spaces/clients/useSpaceClients';
import { ArchivedClientBanner, ArchivedComposerNote, ClientServices } from '../../spaces/clients/ClientChannelParts';
import { ClientAccountPanel } from '../../spaces/clients/ClientAccountPanel';
import type { ServiceAskTarget } from '../../spaces/clients/useServiceAsk';

type Tab = ChannelTab;
const COVER = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, elevation: 10 } as const;

/**
 * «Chat · Checklist» of a channel (pending 21, design e2-17). The tabs go under
 * the header; the checklist covers the conversation in its own area, so the
 * chat keeps its place and its keyboard when you go back. Only in a space's
 * channels: elsewhere the pieces are `null`. A client's channel (pending 21,
 * design f-03) adds «Servicios N», and archived its banner and the note over
 * the composer. An open service takes the whole chat, header included (José
 * 06/11), and its Drive lives there; the channel's files are in its media.
 */
export function useChannelWork(params: { enabled: boolean; jwt: string; chatId: string; channelName: string; yo: string; names: ReadonlyMap<string, string>; apps: ReadonlySet<string>; spaceId?: string; onOpenRecord?: (seq: number) => void; /** The client channel's buttons: a link is made with its action, in the chat (José 31/10). */ actions?: readonly ShortcutRow[]; runAction?: (row: ShortcutRow, values: ShortcutValues) => unknown }): { tabs: ReactNode; panel: ReactNode; note: ReactNode; client: SpaceClient | null; /** An open service: the chat's header steps aside. */ fullScreen: boolean; openOrderCard?: (seq: number) => void } {
  const [tab, setTab] = useState<Tab>('chat');
  const [serviceOpen, setServiceOpen] = useState(false);
  // An order's card sends to «Servicios» with its message; the panel clears it once it opened the order.
  const [focusSeq, setFocusSeq] = useState<number | null>(null);
  const clearFocus = useCallback(() => setFocusSeq(null), []);
  const openOrderCard = useCallback((seq: number) => {
    setFocusSeq(seq);
    setTab('services');
  }, []);
  const client = useClientOfChat(params.chatId);
  const records = useClientRecords(params.jwt, params.spaceId, client?.id, tab === 'services');
  const plan = useWorkPlan(params.jwt, params.chatId, params.enabled && Boolean(client));
  const [openTask, setOpenTask] = useState<OpenTask | null>(null);
  // Android's BACK on the checklist goes back to the chat first; the last listener added runs first.
  useEffect(() => {
    if (tab === 'chat') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setTab('chat');
      return true;
    });
    return () => subscription.remove();
  }, [tab]);
  // José 29/10: Checklist and Pendientes belong to a client's channel only; José 06/11: the Checklist, to its admins.
  if (!params.enabled || !client) return { tabs: null, panel: null, note: null, client: null, openOrderCard: undefined, fullScreen: false };
  const counter = plan.summary && plan.summary.total ? `${plan.summary.done}/${plan.summary.total}` : null;
  const stages = plan.stages ?? [];
  const nameOf = (userId: string) => params.names.get(userId) ?? 'Alguien';
  const people = withoutApps(params.names, params.apps);
  const target = params.spaceId ? { jwt: params.jwt, spaceId: params.spaceId, clientId: client.id } : null;
  const toMessage = (seq: number) => {
    setTab('chat');
    params.onOpenRecord?.(seq);
  };
  // Its form opens over the chat, where «Enviar al canal» can post the link.
  const links = channelLinksOf(params.actions ?? [], (row, values) => {
    setTab('chat');
    void params.runAction?.(row, values);
  });
  const allowed = channelTabs(client.access, stages.length > 0);
  // A tab the access no longer gives (an admin just restricted me) falls back to the chat.
  const shown = allowed.includes(tab) ? tab : 'chat';
  const badges: Partial<Record<Tab, string | null>> = { services: client.services.length ? String(client.services.length) : null, checklist: counter };
  const tabs = (
    <>
      {/* José 06/11: Chat · Cuenta · Servicios · Checklist · Pendientes; Cuenta only with money. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-grow-0 border-b border-outline/10 bg-surface" contentContainerStyle={{ paddingHorizontal: 16 }}>
        {allowed.map((key) => <TabButton key={key} label={CHANNEL_TAB_LABELS[key]} badge={badges[key]} dot={key === 'pending' && Boolean(plan.summary?.overdue)} active={shown === key} onPress={() => setTab(key)} testID={`pestana-canal-${key}`} />)}
      </ScrollView>
      <ArchivedClientBanner client={client} />
    </>
  );
  const fullScreen = shown === 'services' && serviceOpen;
  const panel = <ChannelPanels fullScreen={fullScreen} onServiceOpen={setServiceOpen} onToChat={() => setTab('chat')} shown={shown} focusSeq={focusSeq} clearFocus={clearFocus} client={client} records={records} plan={plan} stages={stages} target={target} people={people} params={params} nameOf={nameOf} toMessage={toMessage} openTask={openTask} setOpenTask={setOpenTask} links={links} />;
  return { tabs, panel, note: <ArchivedComposerNote client={client} />, client, openOrderCard: allowed.includes('services') ? openOrderCard : undefined, fullScreen };
}

type ChannelWorkParams = Parameters<typeof useChannelWork>[0];

/** The open tab's panel of a client's channel, and the task sheet over it. */
function ChannelPanels(props: { fullScreen: boolean; onServiceOpen: (open: boolean) => void; onToChat: () => void; shown: Tab; focusSeq: number | null; clearFocus: () => void; client: SpaceClient; records: ReturnType<typeof useClientRecords>; plan: ReturnType<typeof useWorkPlan>; stages: WorkStage[]; target: ServiceAskTarget | null; people: ReadonlyMap<string, string>; params: ChannelWorkParams; nameOf: (userId: string) => string; toMessage: (seq: number) => void; openTask: OpenTask | null; setOpenTask: (task: OpenTask | null) => void; links: ChannelLinks }) {
  const { shown, client, plan, stages, target, params, nameOf, toMessage, setOpenTask } = props;
  const members = checklistMembers(props.people, params.yo);
  // José 06/11: «Publicar informe» went under the three Android buttons; every panel ends above them.
  const insets = useSafeAreaInsets();
  const cover = { ...COVER, paddingBottom: insets.bottom, paddingTop: props.fullScreen ? insets.top : 0 };
  return (
    <>
      {shown === 'services' ? (
        <View className="bg-background" style={cover}>
          <ClientServices onServiceOpen={props.onServiceOpen} onToChat={props.onToChat} client={client} records={props.records} onOpenRecord={toMessage} target={target} members={props.people} me={params.yo} links={props.links} focusSeq={props.focusSeq} onFocused={props.clearFocus} />
        </View>
      ) : null}
      {shown === 'account' && target ? <View className="bg-background" style={cover}><ClientAccountPanel target={target} services={client.services} /></View> : null}
      {shown === 'checklist' ? (
        <View className="bg-background" style={cover}>
          <WorkPlanPanel plan={plan} jwt={params.jwt} yo={params.yo} nameOf={nameOf} members={members} onStartFailed={(message) => ToastAndroid.show(message, ToastAndroid.SHORT)} onOpenTask={setOpenTask} />
        </View>
      ) : null}
      {shown === 'pending' ? <View className="bg-background" style={cover}><PendingPanel stages={stages} nameOf={nameOf} onOpen={setOpenTask} /></View> : null}
      <TaskDetailSheet open={props.openTask} admin={Boolean(client.access?.admin)} stages={stages} channelName={params.channelName} jwt={params.jwt} chatId={params.chatId} yo={params.yo} nameOf={nameOf} members={members} onChanged={() => void plan.reload()} onOpenMessage={toMessage} onClose={() => setOpenTask(null)} />
    </>
  );
}

function TabButton(props: { label: string; badge?: string | null; dot?: boolean; active: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={props.testID} onPress={props.onPress} accessibilityRole="tab" accessibilityState={{ selected: props.active }} className={`mr-6 min-h-[44px] flex-row items-center gap-1.5 border-b-2 ${props.active ? 'border-primary' : 'border-transparent'}`}>
      <Text className={`text-[15px] ${props.active ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}>{props.label}</Text>
      {props.badge ? <Text className="rounded-full bg-primary/10 px-1.5 text-[11px] font-bold text-primary">{props.badge}</Text> : null}
      {props.dot ? <View testID={`${props.testID}-vencidos`} className="h-2 w-2 rounded-full bg-error" /> : null}
    </Pressable>
  );
}
