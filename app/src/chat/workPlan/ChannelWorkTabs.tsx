import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, ScrollView, Text, ToastAndroid, View } from 'react-native';
import { checklistMembers, stageFiles, type SpaceClient } from '@lilachat/shared';
import { useWorkPlan } from './useWorkPlan';
import { WorkPlanPanel } from './WorkPlanPanel';
import { PendingPanel, StageFilesPanel } from './WorkListsPanels';
import { TaskDetailSheet, type OpenTask } from './TaskDetailSheet';
import { useClientOfChat, useClientRecords } from '../../spaces/clients/useSpaceClients';
import { ArchivedClientBanner, ArchivedComposerNote, ClientServices } from '../../spaces/clients/ClientChannelParts';

type Tab = 'chat' | 'services' | 'checklist' | 'files' | 'pending';
const COVER = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, elevation: 10 } as const;

/**
 * «Chat · Checklist» of a channel (pending 21, design e2-17). The tabs go under
 * the header; the checklist covers the conversation in its own area, so the
 * chat keeps its place and its keyboard when you go back. Only in a space's
 * channels: elsewhere the pieces are `null`. A client's channel (pending 21,
 * design f-03) adds «Servicios N», and archived its banner and the note over
 * the composer.
 */
export function useChannelWork(params: { enabled: boolean; jwt: string; chatId: string; channelName: string; yo: string; names: ReadonlyMap<string, string>; spaceId?: string; onOpenRecord?: (seq: number) => void }): { tabs: ReactNode; panel: ReactNode; note: ReactNode; client: SpaceClient | null } {
  const [tab, setTab] = useState<Tab>('chat');
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
  // José 29/10: Checklist, Archivos and Pendientes belong to a client's channel only; any other channel is just its chat.
  if (!params.enabled || !client) return { tabs: null, panel: null, note: null, client: null };
  const counter = plan.summary && plan.summary.total ? `${plan.summary.done}/${plan.summary.total}` : null;
  const stages = plan.stages ?? [];
  const filesTotal = stageFiles(stages).total;
  const nameOf = (userId: string) => params.names.get(userId) ?? 'Alguien';
  const toMessage = (seq: number) => {
    setTab('chat');
    params.onOpenRecord?.(seq);
  };
  const tabs = (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-grow-0 border-b border-outline/10 bg-surface" contentContainerStyle={{ paddingHorizontal: 16 }}>
        <TabButton label="Chat" active={tab === 'chat'} onPress={() => setTab('chat')} testID="pestana-canal-chat" />
        <TabButton label="Servicios" badge={client.services.length ? String(client.services.length) : null} active={tab === 'services'} onPress={() => setTab('services')} testID="pestana-canal-services" />
        <TabButton label="Checklist" badge={counter} active={tab === 'checklist'} onPress={() => setTab('checklist')} testID="pestana-canal-checklist" />
        {stages.length ? <TabButton label="Archivos" badge={filesTotal ? String(filesTotal) : null} active={tab === 'files'} onPress={() => setTab('files')} testID="pestana-canal-files" /> : null}
        {stages.length ? <TabButton label="Pendientes" dot={Boolean(plan.summary?.overdue)} active={tab === 'pending'} onPress={() => setTab('pending')} testID="pestana-canal-pending" /> : null}
      </ScrollView>
      <ArchivedClientBanner client={client} />
    </>
  );
  const panel = (
    <>
      {tab === 'services' && client ? (
        <View className="bg-background" style={COVER}>
          <ClientServices client={client} records={records} onOpenRecord={toMessage} drive={params.spaceId ? { jwt: params.jwt, spaceId: params.spaceId } : undefined} />
        </View>
      ) : null}
      {tab === 'checklist' ? (
        <View className="bg-background" style={COVER}>
          <WorkPlanPanel plan={plan} jwt={params.jwt} yo={params.yo} nameOf={nameOf} members={checklistMembers(params.names, params.yo)} onStartFailed={(message) => ToastAndroid.show(message, ToastAndroid.SHORT)} onOpenTask={setOpenTask} />
        </View>
      ) : null}
      {tab === 'files' ? <View className="bg-background" style={COVER}><StageFilesPanel stages={stages} onOpenMessage={toMessage} /></View> : null}
      {tab === 'pending' ? <View className="bg-background" style={COVER}><PendingPanel stages={stages} nameOf={nameOf} onOpen={setOpenTask} /></View> : null}
      <TaskDetailSheet open={openTask} stages={stages} channelName={params.channelName} jwt={params.jwt} chatId={params.chatId} yo={params.yo} nameOf={nameOf} members={checklistMembers(params.names, params.yo)} onChanged={() => void plan.reload()} onOpenMessage={toMessage} onClose={() => setOpenTask(null)} />
    </>
  );
  return { tabs, panel, note: <ArchivedComposerNote client={client} />, client };
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
