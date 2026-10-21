import { Pressable, Text, View } from 'react-native';
import { ArrowRight, Check, Lock, MessageCircle } from 'lucide-react-native';
import { formatPhoneDisplay, spaceInitials, spaceSubtitle, type ClientWorkspace } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { Logo } from '../ui/Logo';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { SpaceLogo } from './SpaceSwitcherSheet';

/**
 * «Ya no tienes acceso a este espacio» (design `e1-14-acceso-desactivado`):
 * an admin deactivated me. My personal chats stay as they are; I can go back
 * to them or write to one of the space's admins in my personal account.
 */
export function AccessRemovedScreen(props: { space: ClientWorkspace; onPersonal: () => void; onTalkTo: (admin: { userId: string; name?: string; phone: string }) => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const { space } = props;
  const admins = space.admins ?? [];
  return (
    <Modal visible animationType="fade" onRequestClose={props.onPersonal}>
      <View testID="pantalla-sin-acceso" className="flex-1 bg-background px-5" style={{ paddingTop: margins.cabecera + 8, paddingBottom: margins.pie + 12 }}>
        <View className="flex-1 items-center">
          <View className="flex-row items-center gap-2"><Logo tamano={28} /><Text className="text-[18px] font-bold text-on-surface">Lilachat</Text></View>
          <View className="mt-8 h-24 w-24 items-center justify-center rounded-full bg-error/10"><Lock size={40} color={colors.error} /></View>
          <Text className="mt-5 text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">{space.name}</Text>
          <Text className="mt-1 text-center text-[26px] font-bold leading-[32px] text-on-surface">Ya no tienes acceso a este espacio</Text>
          <Text className="mt-2 text-center text-[15px] leading-[22px] text-on-surface-variant">{`Un admin desactivó tu cuenta en ${space.name}. Tus chats personales siguen igual.`}</Text>
          <Text className="mt-3 rounded-full border border-error/30 bg-error/10 px-3 py-1 text-[12px] font-bold text-error">DESACTIVADO</Text>
          <View className="mt-5 w-full rounded-2xl border border-outline/15 bg-surface p-4">
            <View className="flex-row items-center gap-3">
              <SpaceLogo space={space} size={52} />
              <View className="min-w-0 flex-1">
                <Text className="text-[17px] font-bold text-on-surface">{space.name}</Text>
                <Text className="text-[13px] text-on-surface-variant">{spaceSubtitle(space)}</Text>
              </View>
            </View>
            <View className="mt-3 flex-row gap-2 border-t border-outline/10 pt-3">
              <Check size={16} color={colors['en-linea']} />
              <Text className="flex-1 text-[14px] text-on-surface">{`Tus mensajes, llamadas y contactos fuera de ${space.name} siguen intactos.`}</Text>
            </View>
            {admins.length ? (
              <View className="mt-3 border-t border-outline/10 pt-3">
                <Text className="mb-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Administradores del espacio</Text>
                <View className="flex-row flex-wrap gap-2">
                  {admins.map((admin) => (
                    <View key={admin.userId} className="flex-row items-center gap-1.5 rounded-xl border border-outline/20 px-2.5 py-1.5">
                      <Text className="text-[11px] font-bold text-primary">{spaceInitials(admin.name || admin.phone)}</Text>
                      <Text className="text-[14px] text-on-surface">{admin.name || formatPhoneDisplay(admin.phone)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </View>
        <Pressable testID="sin-acceso-personal" onPress={props.onPersonal} className="min-h-[56px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary">
          <Text className="text-[17px] font-bold text-on-primary">Ir a mis chats personales</Text>
          <ArrowRight size={18} color={colors['on-primary']} />
        </Pressable>
        {admins[0] ? (
          <Pressable testID="sin-acceso-hablar" onPress={() => props.onTalkTo(admins[0]!)} className="mt-2 min-h-[48px] flex-row items-center justify-center gap-2">
            <MessageCircle size={18} color={colors.primary} />
            <Text className="text-[15px] font-semibold text-primary">Hablar con un admin</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}
