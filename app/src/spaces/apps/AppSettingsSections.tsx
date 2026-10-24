import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Banknote, Bell, Check, ChevronDown, CloudSun, Database, FileText, Package, SlidersHorizontal, TriangleAlert, Truck, UserCheck, Zap, type LucideIcon } from 'lucide-react-native';
import { itemKey, type AppItemRow, type ItemChannels, type NoticeIcon, type TopicRoute } from '@lilachat/shared';
import { topicPrivacyHint } from '@lilachat/shared';
import { Interruptor } from '../../ui/Interruptor';
import { Modal } from '../../ui/Modal';
import { Segmentado } from '../../ui/Segmentado';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { appItems, appTopics, saveAppItems, saveAppTopics, testAppTopics, type AppItems, type AppTopics } from '../spacesApi';

const ICONS: Record<NoticeIcon, LucideIcon> = { attendance: UserCheck, tank: Database, material: Package, truck: Truck, weather: CloudSun, cash: Banknote, document: FileText, alert: TriangleAlert };
type Mode = 'all' | 'some' | 'none';
type Channel = AppItems['channels'][number];
type Status = { busy: boolean; line?: string; error?: boolean };
const modeOf = (channels: ItemChannels): Mode => (Array.isArray(channels) ? 'some' : channels);
const sameChannels = (a: ItemChannels, b: ItemChannels) => JSON.stringify(Array.isArray(a) ? [...a].sort() : a) === JSON.stringify(Array.isArray(b) ? [...b].sort() : b);

function Card(props: { testID: string; Icon: LucideIcon; kicker: string; title?: string; lead: string; children: React.ReactNode }) {
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

function StatusLine(props: { status: Status }) {
  return props.status.line ? <Text className={`mt-2 text-[13px] ${props.status.error ? 'text-error' : 'text-en-linea'}`}>{props.status.line}</Text> : null;
}

function SaveButton(props: { testID: string; disabled: boolean; busy: boolean; onPress: () => void; label?: string; secondary?: boolean }) {
  const colors = useColores();
  return (
    <Pressable testID={props.testID} disabled={props.disabled || props.busy} onPress={props.onPress} className={`min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-xl ${props.secondary ? 'border border-outline/25' : 'bg-primary'} ${props.disabled || props.busy ? 'opacity-40' : ''}`}>
      {props.busy && !props.secondary ? <ActivityIndicator size="small" color={colors['on-primary']} /> : null}
      <Text className={`text-[15px] font-semibold ${props.secondary ? 'text-on-surface' : 'text-on-primary'}`}>{props.label ?? 'Guardar'}</Text>
    </Pressable>
  );
}

/** «Comandos y acciones» (José, 23/10: «solo algunos van a ser globales»): in the ⚡ or not, and in which channels. */
export function AppItemsSection(props: { jwt: string; spaceId: string; appId: string }) {
  const [state, setState] = useState<AppItems | null>(null);
  const [edits, setEdits] = useState<Record<string, AppItemRow>>({});
  const [status, setStatus] = useState<Status>({ busy: false });
  useEffect(() => {
    let alive = true;
    void appItems(props.jwt, props.spaceId, props.appId).then((result) => alive && result.ok && setState(result.data));
    return () => {
      alive = false;
    };
  }, [props.jwt, props.spaceId, props.appId]);
  const rows = useMemo(() => (state?.items ?? []).map((item) => edits[itemKey(item.kind, item.key)] ?? item), [state, edits]);
  const changed = rows.filter((row) => {
    const before = state?.items.find((item) => item.kind === row.kind && item.key === row.key);
    return before && (before.global !== row.global || !sameChannels(before.channels, row.channels));
  });
  if (!state || state.items.length === 0) return null;
  const edit = (row: AppItemRow, change: Partial<AppItemRow>) => setEdits((before) => ({ ...before, [itemKey(row.kind, row.key)]: { ...row, ...change } }));
  const save = async () => {
    setStatus({ busy: true });
    const result = await saveAppItems(props.jwt, props.spaceId, props.appId, Object.fromEntries(changed.map((row) => [itemKey(row.kind, row.key), { global: row.global, channels: row.channels }])));
    if (!result.ok) return setStatus({ busy: false, line: result.message ?? 'No se pudo guardar.', error: true });
    setState(result.data);
    setEdits({});
    setStatus({ busy: false, line: 'Guardado. Ya se ve así en el espacio.' });
  };
  return (
    <Card testID="comandos-y-acciones" Icon={SlidersHorizontal} kicker="Comandos y acciones" lead={state.canEdit ? 'Elige cuáles salen en el ⚡ del espacio y en qué canales funcionan.' : 'Dónde funciona cada uno. Solo los admins lo cambian.'}>
      {rows.map((row) => <ItemRow key={itemKey(row.kind, row.key)} row={row} channels={state.channels} canEdit={state.canEdit} onChange={(change) => edit(row, change)} />)}
      {state.canEdit ? <View className="mt-3 flex-row"><SaveButton testID="btn-guardar-items" disabled={changed.length === 0} busy={status.busy} onPress={() => void save()} /></View> : null}
      <StatusLine status={status} />
    </Card>
  );
}

function ItemRow(props: { row: AppItemRow; channels: Channel[]; canEdit: boolean; onChange: (change: Partial<AppItemRow>) => void }) {
  const colors = useColores();
  const { row } = props;
  const mode = modeOf(row.channels);
  const picked = Array.isArray(row.channels) ? row.channels : [];
  return (
    <View testID={`item-${row.kind}-${row.key}`} className="mt-3 border-t border-outline/10 pt-3">
      <View className="flex-row items-center gap-2">
        <View className="min-w-0 flex-1">
          <Text className="text-[16px] font-semibold text-on-surface" numberOfLines={1}>{row.name}</Text>
          <Text className="text-[13px] text-on-surface-variant" numberOfLines={1}>{row.kind === 'command' ? 'Comando' : 'Acción'}{row.description ? ` · ${row.description}` : ''}</Text>
        </View>
        <Zap size={15} color={colors.warning} fill={colors.warning} />
        <Interruptor testID={`global-${row.key}`} value={row.global} disabled={!props.canEdit} onValueChange={(global) => props.onChange({ global })} />
      </View>
      {props.canEdit ? (
        <View className="mt-2">
          <Segmentado opciones={[{ key: 'all', etiqueta: 'Todos', testID: `canales-${row.key}-all` }, { key: 'some', etiqueta: 'Algunos', testID: `canales-${row.key}-some` }, { key: 'none', etiqueta: 'Ninguno', testID: `canales-${row.key}-none` }]} valor={mode} onCambiar={(next) => props.onChange({ channels: next === 'some' ? [] : next })} />
        </View>
      ) : <Text className="mt-1 text-[13px] text-on-surface-variant">{mode === 'all' ? 'En todos los canales' : mode === 'none' ? 'En ningún canal' : `En ${picked.length} canales`}</Text>}
      {mode === 'some' && props.canEdit ? (
        <View className="mt-2 flex-row flex-wrap gap-1.5">
          {props.channels.map((channel) => {
            const on = picked.includes(channel.id);
            return (
              <Pressable key={channel.id} testID={`canal-${row.key}-${channel.name}`} accessibilityState={{ selected: on }} onPress={() => props.onChange({ channels: on ? picked.filter((id) => id !== channel.id) : [...picked, channel.id] })} className={`min-h-[36px] justify-center rounded-full border px-3 ${on ? 'border-primary bg-primary/10' : 'border-outline/25'}`}>
                <Text className={`text-[14px] ${on ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}># {channel.name}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/** «¿Dónde llega cada aviso?» (design e-31): each topic of the app, with the channel where it lands. */
export function NoticeTopicsSection(props: { jwt: string; spaceId: string; appId: string; appName: string }) {
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
  if (!state || state.topics.length === 0) return null;
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
