import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Banknote, Bell, Check, ChevronDown, CloudSun, Database, FileText, Package, TriangleAlert, Truck, UserCheck, type LucideIcon } from 'lucide-react-native';
import type { NoticeIcon, TopicRoute } from '@lilachat/shared';
import { topicPrivacyHint } from '@lilachat/shared';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { appTopics, saveAppTopics, testAppTopics, type AppItems, type AppTopics } from '../spacesApi';

const ICONS: Record<NoticeIcon, LucideIcon> = { attendance: UserCheck, tank: Database, material: Package, truck: Truck, weather: CloudSun, cash: Banknote, document: FileText, alert: TriangleAlert };
type Channel = AppItems['channels'][number];
export type Status = { busy: boolean; line?: string; error?: boolean };

export function Card(props: { testID: string; Icon: LucideIcon; kicker: string; title?: string; lead: string; children: React.ReactNode }) {
  const colors = useColores();
  return (
    <View testID={props.testID} className="mt-4 rounded-2xl border border-outline/15 bg-surface p-4">
      <View className="flex-row items-center gap-2"><props.Icon size={16} color={colors.primary} /><Text className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">{props.kicker}</Text></View>
      {props.title ? <Text className="mt-1 text-[20px] font-bold text-on-surface">{props.title}</Text> : null}
      <Text className="mt-1 text-[14px] text-on-surface-variant">{props.lead}</Text>
      {props.children}
    </View>
  );
}

export function StatusLine(props: { status: Status }) {
  return props.status.line ? <Text className={`mt-2 text-[13px] ${props.status.error ? 'text-error' : 'text-en-linea'}`}>{props.status.line}</Text> : null;
}

export function SaveButton(props: { testID: string; disabled: boolean; busy: boolean; onPress: () => void; label?: string; secondary?: boolean }) {
  const colors = useColores();
  return (
    <Pressable testID={props.testID} disabled={props.disabled || props.busy} onPress={props.onPress} className={`min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-xl ${props.secondary ? 'border border-outline/25' : 'bg-primary'} ${props.disabled || props.busy ? 'opacity-40' : ''}`}>
      {props.busy && !props.secondary ? <ActivityIndicator size="small" color={colors['on-primary']} /> : null}
      <Text className={`text-[15px] font-semibold ${props.secondary ? 'text-on-surface' : 'text-on-primary'}`}>{props.label ?? 'Guardar'}</Text>
    </Pressable>
  );
}

/** «¿Dónde llega cada aviso?» (design e-31): each topic of the app, with the channel where it lands. */
export function NoticeTopicsSection(props: { jwt: string; spaceId: string; appId: string; appName: string; /** Said when the app declares no topics (its own tab, pending 99). */ emptyText?: string }) {
  const colors = useColores();
  const [state, setState] = useState<AppTopics | null>(null);
  const [picked, setPicked] = useState<Record<string, string | null>>({});
  const [choosing, setChoosing] = useState<TopicRoute | null>(null);
  const [status, setStatus] = useState<Status>({ busy: false });
  useEffect(() => {
    let alive = true;
    void appTopics(props.jwt, props.spaceId, props.appId).then((result) => alive && result.ok && setState(result.data));
    return () => {
      alive = false;
    };
  }, [props.jwt, props.spaceId, props.appId]);
  if (!state) return null;
  if (state.topics.length === 0) return props.emptyText ? <Text testID="avisos-app-vacio" className="mt-6 text-center text-[14px] text-on-surface-variant">{props.emptyText}</Text> : null;
  const channelOf = (topic: TopicRoute) => (topic.key in picked ? picked[topic.key]! : (topic.channel?.id ?? null));
  const changed = state.topics.filter((topic) => topic.key in picked && picked[topic.key] !== (topic.channel?.id ?? null));
  const nameOf = (id: string | null) => state.channels.find((channel) => channel.id === id)?.name;
  const save = async () => {
    setStatus({ busy: true });
    const result = await saveAppTopics(props.jwt, props.spaceId, props.appId, Object.fromEntries(changed.map((topic) => [topic.key, picked[topic.key] ?? null])));
    if (!result.ok) return setStatus({ busy: false, line: result.message ?? 'No se pudo guardar.', error: true });
    setState(result.data);
    setPicked({});
    setStatus({ busy: false, line: 'Guardado. Los próximos avisos llegan a esos canales.' });
  };
  const tryIt = async () => {
    setStatus({ busy: true });
    const result = await testAppTopics(props.jwt, props.spaceId, props.appId);
    setStatus(result.ok ? { busy: false, line: `Se mandó una prueba a ${result.data.channels === 1 ? '1 canal' : `${result.data.channels} canales`}.` } : { busy: false, line: result.message ?? 'No se pudo probar.', error: true });
  };
  return (
    <Card testID="avisos-de-la-app" Icon={Bell} kicker={`Avisos de ${props.appName}`} title="¿Dónde llega cada aviso?" lead={state.canEdit ? 'Elige un canal del espacio para cada tema.' : 'Solo los admins lo cambian.'}>
      {state.topics.map((topic) => {
        const Icon = topic.icon ? ICONS[topic.icon] : Bell;
        const name = nameOf(channelOf(topic));
        const chosenChannel = state.channels.find((channel) => channel.id === channelOf(topic)) ?? null;
        const hint = topicPrivacyHint(topic, chosenChannel);
        return (
          <View key={topic.key} testID={`tema-${topic.key}`} className="mt-3 flex-row items-center gap-3 border-t border-outline/10 pt-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl border border-outline/15 bg-background"><Icon size={18} color={colors['on-surface-variant']} /></View>
            <View className="min-w-0 flex-1">
              <Text className="text-[16px] font-semibold text-on-surface" numberOfLines={1}>{topic.name}</Text>
              {topic.description ? <Text className="text-[13px] text-on-surface-variant" numberOfLines={1}>{topic.description}</Text> : null}
              {hint ? <Text testID={`aviso-privado-${topic.key}`} className="text-[13px] font-semibold text-warning">{hint}</Text> : null}
            </View>
            <Pressable testID={`canal-tema-${topic.key}`} disabled={!state.canEdit} onPress={() => setChoosing(topic)} className={`min-h-[40px] max-w-[45%] flex-row items-center gap-1 rounded-xl border px-2.5 ${name ? 'border-outline/25' : 'border-dashed border-outline/40'}`}>
              <Text className={`text-[14px] ${name ? 'text-on-surface' : 'italic text-on-surface-variant'}`} numberOfLines={1}>{name ? `# ${name}` : 'Sin canal'}</Text>
              {state.canEdit ? <ChevronDown size={15} color={colors['on-surface-variant']} /> : null}
            </Pressable>
          </View>
        );
      })}
      <Text className="mt-3 text-[13px] text-on-surface-variant">Los avisos de un tema sin canal no se publican.</Text>
      {state.canEdit ? (
        <View className="mt-3 flex-row gap-2">
          <SaveButton testID="btn-probar-avisos" secondary label="Probar envío" disabled={false} busy={status.busy} onPress={() => void tryIt()} />
          <SaveButton testID="btn-guardar-avisos" disabled={changed.length === 0} busy={status.busy} onPress={() => void save()} />
        </View>
      ) : null}
      <StatusLine status={status} />
      {choosing ? <ChannelPicker topic={choosing} channels={state.channels} current={channelOf(choosing)} onPick={(id) => { setPicked((before) => ({ ...before, [choosing.key]: id })); setChoosing(null); }} onClose={() => setChoosing(null)} /> : null}
    </Card>
  );
}

function ChannelPicker(props: { topic: TopicRoute; channels: Channel[]; current: string | null; onPick: (id: string | null) => void; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const options = [...props.channels.map((channel) => ({ id: channel.id as string | null, label: `# ${channel.name}${channel.private ? ' (privado)' : ''}` })), { id: null, label: 'Sin canal' }];
  return (
    <Modal visible transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cerrar" />
      <View testID="selector-canal" className="max-h-[70%] rounded-t-3xl bg-surface pt-3" style={{ paddingBottom: margins.pie + 8 }}>
        <View className="mb-2 h-1.5 w-11 self-center rounded-full bg-outline/30" />
        <Text className="px-4 pb-2 text-[16px] font-bold text-on-surface">{`¿Dónde llega «${props.topic.name}»?`}</Text>
        <ScrollView>
          {options.map((option) => (
            <Pressable key={option.id ?? 'none'} testID={`opcion-canal-${option.id ?? 'ninguno'}`} onPress={() => props.onPick(option.id)} className="min-h-[52px] flex-row items-center gap-3 border-t border-outline/10 px-4">
              <Text className={`flex-1 text-[16px] ${option.id ? 'text-on-surface' : 'italic text-on-surface-variant'}`}>{option.label}</Text>
              {props.current === option.id ? <Check size={18} color={colors.primary} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
