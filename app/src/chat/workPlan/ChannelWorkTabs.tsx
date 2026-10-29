import { useState, type ReactNode } from 'react';
import { Pressable, Text, ToastAndroid, View } from 'react-native';
import { checklistMembers } from '@lilachat/shared';
import { useWorkPlan } from './useWorkPlan';
import { WorkPlanPanel } from './WorkPlanPanel';

type Tab = 'chat' | 'checklist';

/**
 * «Chat · Checklist» of a channel (pending 21, design e2-17). The tabs go under
 * the header; the checklist covers the conversation in its own area, so the
 * chat keeps its place and its keyboard when you go back. Only in a space's
 * channels: elsewhere both pieces are `null`.
 */
export function useChannelWork(params: { enabled: boolean; jwt: string; chatId: string; yo: string; names: ReadonlyMap<string, string> }): { tabs: ReactNode; panel: ReactNode } {
  const [tab, setTab] = useState<Tab>('chat');
  const plan = useWorkPlan(params.jwt, params.chatId, params.enabled);
  if (!params.enabled) return { tabs: null, panel: null };
  const counter = plan.summary && plan.summary.total ? `${plan.summary.done}/${plan.summary.total}` : null;
  const tabs = (
    <View className="flex-row border-b border-outline/10 bg-surface px-4">
      <TabButton label="Chat" active={tab === 'chat'} onPress={() => setTab('chat')} testID="pestana-canal-chat" />
      <TabButton label="Checklist" badge={counter} active={tab === 'checklist'} onPress={() => setTab('checklist')} testID="pestana-canal-checklist" />
    </View>
  );
  const panel =
    tab === 'checklist' ? (
      <View className="bg-background" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, elevation: 10 }}>
        <WorkPlanPanel plan={plan} jwt={params.jwt} yo={params.yo} nameOf={(userId) => params.names.get(userId) ?? 'Alguien'} members={checklistMembers(params.names, params.yo)} onStartFailed={(message) => ToastAndroid.show(message, ToastAndroid.SHORT)} />
      </View>
    ) : null;
  return { tabs, panel };
}

function TabButton(props: { label: string; badge?: string | null; active: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={props.testID} onPress={props.onPress} accessibilityRole="tab" accessibilityState={{ selected: props.active }} className={`mr-6 min-h-[44px] flex-row items-center gap-1.5 border-b-2 ${props.active ? 'border-primary' : 'border-transparent'}`}>
      <Text className={`text-[15px] ${props.active ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}>{props.label}</Text>
      {props.badge ? <Text className="rounded-full bg-primary/10 px-1.5 text-[11px] font-bold text-primary">{props.badge}</Text> : null}
    </Pressable>
  );
}
