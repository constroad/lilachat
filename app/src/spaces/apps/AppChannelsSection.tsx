import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { ChevronRight, Hash, Info, Lock, RefreshCw, Trash2 } from 'lucide-react-native';
import { activeChannelsLine, uninstallWarning, type AppChannel } from '@lilachat/shared';
import { addChatMember, removeChatMember } from '../../api/client';
import { Interruptor } from '../../ui/Interruptor';
import { useColores } from '../../ui/tema';
import { appChannels, type AppChannels } from '../spacesApi';

/**
 * «En qué canales está» (pending 99, design c-05): a switch per channel that
 * takes the app out or puts it back through the chat's members routes, so the
 * channel shows «José sacó a Inframaq» like any member. The list reads again
 * after each switch: who may change it depends on being that channel's admin.
 */
export function AppChannelsSection(props: { jwt: string; spaceId: string; appId: string; /** After a switch that worked: the hero's «Activa en N canales» reads again. */ onChanged?: () => void }) {
  const colors = useColores();
  const [state, setState] = useState<AppChannels | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const result = await appChannels(props.jwt, props.spaceId, props.appId);
    if (result.ok) setState(result.data);
    else setError(result.message ?? 'No se pudieron leer los canales.');
  }, [props.jwt, props.spaceId, props.appId]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!state) return error ? <Text className="mt-4 text-[14px] text-error">{error}</Text> : <View className="mt-4 h-40 rounded-2xl bg-surface-variant" />;
  const toggle = async (channel: AppChannel, on: boolean) => {
    setBusyId(channel.id);
    setError('');
    const result = on ? await addChatMember(props.jwt, channel.id, state.botUserId) : await removeChatMember(props.jwt, channel.id, state.botUserId);
    if (!result.ok) setError(result.message ?? 'No se pudo cambiar.');
    else props.onChanged?.();
    await load();
    setBusyId(null);
  };
  return (
    <View testID="canales-de-la-app" className="mt-4">
      <View className="mb-2 flex-row items-center justify-between px-1">
        <Text className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">En qué canales está</Text>
        <Text className="font-mono text-[12px] font-semibold uppercase text-primary">{activeChannelsLine(state.channels)}</Text>
      </View>
      <View className="overflow-hidden rounded-2xl border border-outline/15 bg-surface">
        {state.channels.map((channel, index) => (
          <View key={channel.id} testID={`canal-app-${channel.name}`} className={`min-h-[64px] flex-row items-center gap-3 px-4 py-2 ${index === 0 ? '' : 'border-t border-outline/10'}`}>
            <View className={`h-10 w-10 items-center justify-center rounded-xl ${channel.inChannel ? 'bg-primary/10' : 'bg-surface-variant'}`}>
              {channel.private ? <Lock size={16} color={channel.inChannel ? colors.primary : colors['on-surface-variant']} /> : <Hash size={16} color={channel.inChannel ? colors.primary : colors['on-surface-variant']} />}
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[16px] font-semibold text-on-surface" numberOfLines={1}>{channel.name}</Text>
              {channel.description ? <Text className="text-[13px] text-on-surface-variant" numberOfLines={1}>{channel.description}</Text> : null}
            </View>
            {busyId === channel.id ? <ActivityIndicator size="small" color={colors.primary} /> : <Interruptor testID={`interruptor-canal-${channel.name}`} value={channel.inChannel} disabled={!channel.canChange || busyId !== null} onValueChange={(on) => void toggle(channel, on)} />}
          </View>
        ))}
      </View>
      {error ? <Text className="mt-2 px-1 text-[13px] text-error">{error}</Text> : null}
      <View className="mt-2 flex-row items-center gap-1.5 px-1">
        <Info size={14} color={colors['on-surface-variant']} />
        <Text className="flex-1 text-[13px] text-on-surface-variant">{state.canEdit ? 'Puedes cambiarlo en los canales donde eres admin.' : 'Solo los admins cambian esto.'}</Text>
      </View>
    </View>
  );
}

/** «Reinstalar» and «Desinstalar» (design c-05), only for admins: the ⋮ of the old detail moved here. */
export function AppInstallSection(props: { appName: string; spaceName: string; uninstalling?: boolean; onReinstall?: () => void; onUninstall: () => void }) {
  const colors = useColores();
  const confirm = () =>
    Alert.alert(`¿Desinstalar ${props.appName} de ${props.spaceName}?`, uninstallWarning(props.spaceName), [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desinstalar', style: 'destructive', onPress: props.onUninstall },
    ]);
  return (
    <View testID="instalacion-de-la-app" className="mt-6">
      <Text className="mb-2 px-1 text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Solo admins</Text>
      <View className="overflow-hidden rounded-2xl border border-outline/15 bg-surface">
        {props.onReinstall ? (
          <Pressable testID="app-reinstalar" onPress={props.onReinstall} className="min-h-[64px] flex-row items-center gap-3 px-4 py-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><RefreshCw size={18} color={colors.primary} /></View>
            <View className="min-w-0 flex-1">
              <Text className="text-[16px] font-semibold text-primary">Reinstalar app</Text>
              <Text className="text-[13px] text-on-surface-variant">Vuelve a pedir los permisos de la app</Text>
            </View>
            <ChevronRight size={18} color={colors['on-surface-variant']} />
          </Pressable>
        ) : null}
        <Pressable testID="app-desinstalar" disabled={props.uninstalling} onPress={confirm} className={`min-h-[64px] flex-row items-center gap-3 px-4 py-3 ${props.onReinstall ? 'border-t border-outline/10' : ''} ${props.uninstalling ? 'opacity-50' : ''}`}>
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-error/10"><Trash2 size={18} color={colors.error} /></View>
          <View className="min-w-0 flex-1">
            <Text className="text-[16px] font-semibold text-error">{props.uninstalling ? 'Desinstalando…' : `Desinstalar de ${props.spaceName}`}</Text>
            <Text className="text-[13px] text-on-surface-variant">La app sale de todos los canales. Lo que ya publicó se queda.</Text>
          </View>
          <ChevronRight size={18} color={colors['on-surface-variant']} />
        </Pressable>
      </View>
    </View>
  );
}
