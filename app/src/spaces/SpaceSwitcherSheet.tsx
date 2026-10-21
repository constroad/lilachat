import { useEffect } from 'react';
import { Image } from 'expo-image';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronRight, CircleCheck, Keyboard, Plus, X } from 'lucide-react-native';
import { spaceInitials, spaceSubtitle, type ClientWorkspace } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';

/** The square logo of a space: its picture, or its initials on the accent. */
export function SpaceLogo({ space, size }: { space: Pick<ClientWorkspace, 'name' | 'logoUrl'>; size: number }) {
  if (space.logoUrl) return <Image source={{ uri: space.logoUrl }} style={{ width: size, height: size, borderRadius: size * 0.25 }} contentFit="cover" />;
  return (
    <View className="items-center justify-center bg-primary" style={{ width: size, height: size, borderRadius: size * 0.25 }}>
      <Text className="font-bold text-on-primary" style={{ fontSize: size * 0.36 }}>{spaceInitials(space.name)}</Text>
    </View>
  );
}

const STATUS_PILL: Partial<Record<ClientWorkspace['status'], string>> = { pending: 'PENDIENTE', deactivated: 'SIN ACCESO' };

/**
 * «Cambiar de espacio» (E1; design `e1-06-selector-espacios`): the personal
 * account and each company space, the one open marked ACTIVO, how many chats
 * have something new, and the ways in: a code or a new space. A space still
 * waiting for approval, or one where access was removed, cannot be opened.
 */
export function SpaceSwitcherSheet(props: {
  visible: boolean;
  spaces: ClientWorkspace[] | null;
  currentId: string | null;
  me: { name: string; phone: string };
  personalUnread: number;
  onPick: (spaceId: string | null) => void;
  onJoin: () => void;
  onCreate: () => void;
  onClose: () => void;
  onOpen: () => void;
}) {
  const colors = useColores();
  const margins = useMargenes();
  const { visible, onOpen } = props;
  // Asked again each time it opens: a request approved meanwhile, new chats.
  useEffect(() => {
    if (visible) onOpen();
  }, [visible, onOpen]);
  const badge = (count: number) => (count > 0 ? <View className="h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-1.5"><Text className="text-[12px] font-bold text-on-primary">{count}</Text></View> : null);
  const row = (key: string, active: boolean, disabled: boolean, onPress: () => void, children: React.ReactNode) => (
    <Pressable key={key} testID={`espacio-${key}`} disabled={disabled} onPress={onPress} accessibilityState={{ selected: active, disabled }} className={`mb-2.5 min-h-[72px] flex-row items-center gap-3 rounded-2xl border px-3 py-2.5 ${active ? 'border-primary bg-primary/[0.04]' : 'border-outline/15 bg-surface'} ${disabled ? 'opacity-60' : ''}`}>
      {children}
    </Pressable>
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cerrar" />
      <View testID="hoja-espacios" className="max-h-[85%] rounded-t-3xl bg-surface px-4 pt-3" style={{ paddingBottom: margins.pie + 8 }}>
        <View className="mb-2 h-1.5 w-11 self-center rounded-full bg-outline/30" />
        <View className="mb-3 flex-row items-start">
          <View className="flex-1">
            <Text className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Tus espacios</Text>
            <Text className="text-[22px] font-bold text-on-surface">Cambiar de espacio</Text>
          </View>
          <Pressable testID="espacios-cerrar" onPress={props.onClose} accessibilityLabel="Cerrar" className="h-11 w-11 items-center justify-center">
            <X size={22} color={colors['on-surface-variant']} />
          </Pressable>
        </View>
        <ScrollView>
          {row('personal', props.currentId === null, false, () => props.onPick(null), (
            <>
              <Avatar nombre={props.me.name} tamano={44} />
              <View className="min-w-0 flex-1">
                <Text className="text-[16px] font-bold text-on-surface">Personal</Text>
                <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">{`${props.me.name} · ${props.me.phone}`}</Text>
              </View>
              {badge(props.personalUnread)}
              {props.currentId === null ? <CircleCheck size={22} color={colors.primary} /> : <ChevronRight size={20} color={colors.outline} />}
            </>
          ))}
          {props.spaces === null ? <View className="mb-2.5 h-[72px] rounded-2xl bg-surface-variant" /> : null}
          {(props.spaces ?? []).map((space) => {
            const active = props.currentId === space.id;
            const blocked = space.status !== 'active';
            return row(space.id, active, blocked, () => props.onPick(space.id), (
              <>
                <SpaceLogo space={space} size={44} />
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-[16px] font-bold text-on-surface">{space.name}</Text>
                  <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">{spaceSubtitle(space)}</Text>
                </View>
                {STATUS_PILL[space.status] ? <Text className="rounded-full bg-surface-variant px-2 py-0.5 text-[11px] font-bold text-on-surface-variant">{STATUS_PILL[space.status]}</Text> : null}
                {active ? <Text className="rounded-full border border-en-linea/40 bg-en-linea/10 px-2 py-0.5 text-[11px] font-bold text-en-linea">ACTIVO</Text> : null}
                {badge(space.unreadChats)}
                {active ? <CircleCheck size={22} color={colors.primary} /> : blocked ? null : <ChevronRight size={20} color={colors.outline} />}
              </>
            ));
          })}
          <View className="my-2 h-px bg-outline/15" />
          <Pressable testID="espacios-unirme" onPress={props.onJoin} className="mb-2.5 min-h-[56px] flex-row items-center gap-3 rounded-2xl border border-outline/15 px-4">
            <Keyboard size={20} color={colors.primary} />
            <Text className="flex-1 text-[16px] font-semibold text-on-surface">Unirme con un código</Text>
            <ChevronRight size={20} color={colors.outline} />
          </Pressable>
          <Pressable testID="espacios-crear" onPress={props.onCreate} className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary">
            <Plus size={20} color={colors['on-primary']} />
            <Text className="text-[16px] font-bold text-on-primary">Crear un espacio</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
