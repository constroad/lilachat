import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowRight, ChevronRight, Hash, Users } from 'lucide-react-native';
import { formatPhoneDisplay, membersLabel, spaceInitials, type ClientChannel, type ClientWorkspace } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { Logo } from '../ui/Logo';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { SpaceLogo } from './SpaceSwitcherSheet';
import { spaceChannels } from './spacesApi';

/** How many channels the welcome shows. */
const CHANNELS_SHOWN = 3;

/**
 * «José Zamora te agregó a CONSTROAD» (design `e1-13-te-agregaron`), once
 * per space someone else added me to: what I will find (its channels and the
 * directory), who invited me, and «Entrar» or «Más tarde».
 */
export function AddedToSpaceScreen(props: { space: ClientWorkspace; jwt: string; onEnter: () => void; onDirectory: () => void; onLater: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const { space } = props;
  const [channels, setChannels] = useState<ClientChannel[]>([]);
  useEffect(() => {
    void spaceChannels(props.jwt, space.id).then((response) => response.ok && setChannels(response.data.channels.filter((channel) => channel.joined || channel.visibility === 'public').slice(0, CHANNELS_SHOWN)));
  }, [props.jwt, space.id]);
  const inviter = space.addedBy?.name?.trim() || (space.addedBy ? formatPhoneDisplay(space.addedBy.phone) : 'Alguien');

  return (
    <Modal visible animationType="fade" onRequestClose={props.onLater}>
      <View testID="pantalla-te-agregaron" className="flex-1 bg-background px-5" style={{ paddingTop: margins.cabecera + 8, paddingBottom: margins.pie + 12 }}>
        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 16 }}>
          <View className="flex-row items-center gap-2"><Logo tamano={28} /><Text className="text-[18px] font-bold text-on-surface">Lilachat</Text></View>
          <View className="mt-6"><SpaceLogo space={space} size={88} /></View>
          <Text className="mt-5 text-[12px] font-bold uppercase tracking-widest text-primary">Nuevo espacio</Text>
          <Text className="mt-1 text-center text-[26px] font-bold leading-[32px] text-on-surface">{`${inviter} te agregó a ${space.name}`}</Text>
          <Text className="mt-2 text-center text-[15px] leading-[22px] text-on-surface-variant">Aquí verás los canales y chats de tu empresa. Tus chats personales siguen aparte.</Text>
          <View className="mt-5 w-full rounded-2xl border border-outline/15 bg-surface p-4">
            <View className="flex-row items-center justify-between border-b border-outline/10 pb-3">
              <Text className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Lo que encontrarás</Text>
              <Text className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase text-primary">{membersLabel(space.members)}</Text>
            </View>
            {channels.map((channel) => (
              <View key={channel.id} className="min-h-[56px] flex-row items-center gap-3 border-b border-outline/10">
                <View className="h-10 w-10 items-center justify-center rounded-xl border border-outline/15"><Hash size={18} color={colors.primary} /></View>
                <View className="min-w-0 flex-1">
                  <Text className="text-[15px] font-bold text-on-surface">{channel.name}</Text>
                  {channel.descripcion ? <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">{channel.descripcion}</Text> : null}
                </View>
              </View>
            ))}
            <Pressable testID="te-agregaron-directorio" onPress={props.onDirectory} className="min-h-[56px] flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl border border-outline/15"><Users size={18} color={colors.primary} /></View>
              <View className="min-w-0 flex-1">
                <Text className="text-[15px] font-bold text-on-surface">Directorio de equipo</Text>
                <Text className="text-[13px] text-on-surface-variant">{`${membersLabel(space.members)} activos`}</Text>
              </View>
              <ChevronRight size={18} color={colors.outline} />
            </Pressable>
          </View>
          {space.addedBy ? (
            <View className="mt-3 w-full flex-row items-center gap-3 rounded-2xl border border-primary/20 bg-primary/[0.05] p-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10"><Text className="text-[13px] font-bold text-primary">{spaceInitials(inviter)}</Text></View>
              <View className="min-w-0 flex-1">
                <Text className="text-[14px] font-semibold text-on-surface">{`Invitado por ${inviter}`}</Text>
                <Text className="text-[13px] text-on-surface-variant">{formatPhoneDisplay(space.addedBy.phone)}</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
        <Pressable testID="te-agregaron-entrar" onPress={props.onEnter} className="min-h-[56px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary">
          <Text className="text-[17px] font-bold text-on-primary">{`Entrar a ${space.name}`}</Text>
          <ArrowRight size={18} color={colors['on-primary']} />
        </Pressable>
        <Pressable testID="te-agregaron-mas-tarde" onPress={props.onLater} className="mt-2 min-h-[48px] items-center justify-center">
          <Text className="text-[15px] font-semibold text-on-surface-variant">Más tarde</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
