import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, ToastAndroid, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ArrowLeft, Briefcase, Calendar, Copy, Hash, MessageCircle, Smartphone } from 'lucide-react-native';
import { formatPhoneDisplay, joinedLabel, type ClientWorkspace, type ClientWorkspaceMember } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { useOnlineIds } from '../chat/presenceStore';
import { SpaceLogo } from './SpaceSwitcherSheet';
import { MemberAvatar, memberLine, memberName, OnlinePill, RolePill } from './memberUi';

/**
 * «Perfil de colaborador» (design `e1-09-perfil-miembro`): who they are in
 * the space, «Mensaje» to write to them there, their phone to copy, when they
 * joined, their area and the channels we share. The design's «Llamar» and
 * «Video» come from inside the chat, where the call already lives.
 */
export function MemberProfileScreen(props: { space: ClientWorkspace; member: ClientWorkspaceMember; isMe: boolean; commonChannels: string[]; onMessage: () => void; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const online = useOnlineIds();
  const { member } = props;
  const isOnline = Boolean(member.userId && online.has(member.userId));
  const copyPhone = async () => {
    await Clipboard.setStringAsync(member.phone);
    ToastAndroid.show('Teléfono copiado', ToastAndroid.SHORT);
  };
  const row = (Icon: typeof Smartphone, label: string, value: string, action?: ReactNode) => (
    <View className="min-h-[56px] flex-row items-center gap-3 border-t border-outline/10">
      <View className="h-10 w-10 items-center justify-center rounded-xl border border-outline/15"><Icon size={18} color={colors['on-surface-variant']} /></View>
      <Text className="flex-1 text-[15px] text-on-surface-variant">{label}</Text>
      <Text className="text-[15px] font-semibold text-on-surface">{value}</Text>
      {action}
    </View>
  );

  return (
    <Modal visible animationType="slide" onRequestClose={props.onClose}>
      <View testID="pantalla-perfil-miembro" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera }}>
        <View className="flex-row items-center gap-2 border-b border-outline/10 px-3 pb-2">
          <Pressable testID="perfil-volver" onPress={props.onClose} accessibilityLabel="Volver" className="h-11 w-11 items-center justify-center">
            <ArrowLeft size={22} color={colors['on-surface']} />
          </Pressable>
          <SpaceLogo space={props.space} size={34} />
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-[11px] font-bold uppercase tracking-widest text-primary">{props.space.name}</Text>
            <Text className="text-[18px] font-bold text-on-surface">Perfil de colaborador</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: margins.pie + 24 }}>
          <View className="items-center rounded-2xl border border-outline/15 bg-surface p-5">
            <MemberAvatar member={member} size={96} online={isOnline} />
            <Text className="mt-3 text-center text-[24px] font-bold text-on-surface">{memberName(member)}</Text>
            {memberLine(member) ? <Text className="mt-0.5 text-center text-[15px] text-on-surface-variant">{memberLine(member)}</Text> : null}
            <View className="mt-2 flex-row gap-2">
              <RolePill role={member.role} />
              {isOnline ? <OnlinePill /> : null}
            </View>
            {props.isMe || !member.userId ? null : (
              <Pressable testID="perfil-mensaje" onPress={props.onMessage} className="mt-4 min-h-[52px] w-full flex-row items-center justify-center gap-2 rounded-2xl bg-primary">
                <MessageCircle size={20} color={colors['on-primary']} />
                <Text className="text-[16px] font-bold text-on-primary">Mensaje</Text>
              </Pressable>
            )}
          </View>
          <View className="mt-4 rounded-2xl border border-outline/15 bg-surface px-4 pb-1 pt-4">
            <Text className="text-[11px] font-bold uppercase tracking-widest text-primary">Datos</Text>
            <Text className="mb-2 text-[17px] font-bold text-on-surface">Información laboral</Text>
            {row(Smartphone, 'Teléfono', formatPhoneDisplay(member.phone), (
              <Pressable testID="perfil-copiar-telefono" onPress={() => void copyPhone()} accessibilityLabel="Copiar teléfono" className="h-11 w-11 items-center justify-center"><Copy size={18} color={colors.primary} /></Pressable>
            ))}
            {member.joinedAt ? row(Calendar, 'Se unió', joinedLabel(member.joinedAt)) : null}
            {member.area ? row(Briefcase, 'Área', member.area) : null}
          </View>
          {props.commonChannels.length ? (
            <View className="mt-4 rounded-2xl border border-outline/15 bg-surface p-4">
              <Text className="text-[11px] font-bold uppercase tracking-widest text-primary">Canales en común</Text>
              {props.commonChannels.map((name) => (
                <View key={name} className="mt-2 flex-row items-center gap-2"><Hash size={16} color={colors.primary} /><Text className="text-[15px] text-on-surface">{name}</Text></View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
