import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Hash, Lock, Plus, Search } from 'lucide-react-native';
import { filterChannels, membersLabel, type ChannelFilter, type ClientChannel, type ClientWorkspace } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { SpaceLogo } from './SpaceSwitcherSheet';
import { CreateChannelSheet } from './CreateChannelSheet';
import { joinChannel, spaceChannels } from './spacesApi';

const TABS: { key: ChannelFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'public', label: 'Públicos' },
  { key: 'private', label: 'Privados' },
];

/**
 * «Canales» of a space (E2; design `e2-15-explorar-canales`): the public ones
 * and my private ones, searched by name or description, Todos · Públicos ·
 * Privados; «Unirme» to a public one opens it, a joined one opens with a tap,
 * and «Crear canal» (design `e2-16`). A private channel is joined by
 * invitation only.
 */
export function ChannelsScreen(props: { space: ClientWorkspace | null; jwt: string; onOpenChannel: (channel: ClientChannel) => void; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const { space, jwt } = props;
  const [channels, setChannels] = useState<ClientChannel[] | null>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<ChannelFilter>('all');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!space) return;
    const response = await spaceChannels(jwt, space.id);
    if (response.ok) setChannels(response.data.channels);
    else setError(response.message ?? 'No se pudieron cargar los canales.');
  }, [jwt, space]);
  useEffect(() => {
    setChannels(null);
    setQuery('');
    setTab('all');
    void load();
  }, [load]);

  if (!space) return null;
  const shown = filterChannels(channels ?? [], { query, visibility: tab });
  const join = async (channel: ClientChannel) => {
    const response = await joinChannel(jwt, space.id, channel.id);
    if (!response.ok) return setError(response.message ?? 'No se pudo entrar al canal.');
    props.onOpenChannel(response.data.channel);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={props.onClose}>
      <View testID="pantalla-canales" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera }}>
        <View className="flex-row items-center gap-2 border-b border-outline/10 px-3 pb-2">
          <Pressable testID="canales-volver" onPress={props.onClose} accessibilityLabel="Volver" className="h-11 w-11 items-center justify-center">
            <ArrowLeft size={22} color={colors['on-surface']} />
          </Pressable>
          <View className="flex-row items-center gap-2 rounded-xl border border-outline/15 px-2 py-1.5">
            <SpaceLogo space={space} size={26} />
            <Text className="text-[15px] font-bold text-on-surface">{space.name}</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: margins.pie + 24 }} keyboardShouldPersistTaps="handled">
          <View className="flex-row items-end gap-3">
            <View className="min-w-0 flex-1">
              <Text className="text-[12px] font-bold uppercase tracking-widest text-primary">{space.name}</Text>
              <Text className="text-[28px] font-bold text-on-surface">Canales</Text>
            </View>
            <Pressable testID="btn-crear-canal" onPress={() => setCreating(true)} className="min-h-[44px] flex-row items-center gap-1.5 rounded-xl bg-primary px-4">
              <Plus size={18} color={colors['on-primary']} />
              <Text className="text-[15px] font-bold text-on-primary">Crear canal</Text>
            </Pressable>
          </View>
          <Text className="mt-2 text-[15px] text-on-surface-variant">Temas y obras para coordinar frentes, cuadrillas y despachos.</Text>
          <View className="mt-4 min-h-[48px] flex-row items-center gap-2 rounded-xl border border-outline/20 bg-surface px-3">
            <Search size={18} color={colors['on-surface-variant']} />
            <TextInput testID="buscar-canales" value={query} onChangeText={setQuery} placeholder="Buscar canales…" placeholderTextColor={colors['on-surface-variant']} className="flex-1 text-[15px] text-on-surface" />
          </View>
          <View className="mt-3 flex-row gap-2">
            {TABS.map(({ key, label }) => (
              <Pressable key={key} testID={`canales-${key}`} onPress={() => setTab(key)} accessibilityState={{ selected: tab === key }} className={`min-h-[40px] justify-center rounded-xl border px-3.5 ${tab === key ? 'border-primary bg-primary' : 'border-outline/20 bg-surface'}`}>
                <Text className={`text-[14px] font-semibold ${tab === key ? 'text-on-primary' : 'text-on-surface'}`}>{`${label} (${shown.counts[key]})`}</Text>
              </Pressable>
            ))}
          </View>
          {error ? <Text className="mt-3 text-[13px] text-error">{error}</Text> : null}
          {channels === null ? [0, 1, 2].map((index) => <View key={index} className="mt-3 h-20 rounded-2xl bg-surface-variant" />) : null}
          {channels !== null && shown.channels.length === 0 ? <Text className="mt-6 text-center text-[14px] text-on-surface-variant">{query ? 'Ningún canal coincide con la búsqueda.' : 'Todavía no hay canales: crea el primero.'}</Text> : null}
          {shown.channels.map((channel) => (
            <Pressable key={channel.id} testID={`canal-${channel.name}`} disabled={!channel.joined} onPress={() => props.onOpenChannel(channel)} className="mt-3 min-h-[80px] flex-row items-center gap-3 rounded-2xl border border-outline/15 bg-surface p-3">
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                {channel.visibility === 'private' ? <Lock size={20} color={colors.primary} /> : <Hash size={20} color={colors.primary} />}
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-2">
                  <Text numberOfLines={1} className="shrink text-[16px] font-bold text-on-surface">{channel.name}</Text>
                  {channel.visibility === 'private' ? <Text className="rounded border border-outline/25 px-1.5 text-[10px] font-bold text-on-surface-variant">PRIVADO</Text> : null}
                </View>
                {channel.descripcion ? <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">{channel.descripcion}</Text> : null}
                <Text className="text-[12px] text-on-surface-variant">{membersLabel(channel.members)}</Text>
              </View>
              {channel.joined ? (
                <Text className="rounded-full border border-en-linea/40 bg-en-linea/10 px-2 py-0.5 text-[11px] font-bold text-en-linea">UNIDO</Text>
              ) : channel.visibility === 'public' ? (
                <Pressable testID={`unirme-${channel.name}`} onPress={() => void join(channel)} className="min-h-[40px] justify-center rounded-xl border border-primary px-3.5">
                  <Text className="text-[15px] font-bold text-primary">Unirme</Text>
                </Pressable>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
        <CreateChannelSheet
          visible={creating}
          jwt={jwt}
          space={space}
          onCreated={(channel) => {
            setCreating(false);
            void load();
            props.onOpenChannel(channel);
          }}
          onClose={() => setCreating(false)}
        />
      </View>
    </Modal>
  );
}
