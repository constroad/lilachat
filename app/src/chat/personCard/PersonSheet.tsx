import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { formatPhoneDisplay, type CardPerson } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';

const AVATAR_SIZE = 80;

/**
 * A person's card (José, 25/10/2026): their photo and name from a chat, a group or the
 * member list, and «Enviar mensaje» when there is a 1:1 to open. Nothing is offered
 * when there is nobody to write to (yourself, or an app with no 1:1 here).
 */
export function PersonSheet(props: { person: CardPerson; canWrite: boolean; checking: boolean; busy: boolean; error: string | null; onWrite: () => void; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const { person } = props;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cerrar" />
      <View testID="hoja-persona" className="items-center rounded-t-3xl bg-surface px-6 pt-6" style={{ paddingBottom: margins.pie + 16 }}>
        <Avatar nombre={person.name} foto={person.avatarUrl} tamano={AVATAR_SIZE} bot={person.isApp} />
        <Text testID="persona-nombre" numberOfLines={2} className="mt-3 text-center text-[20px] font-bold text-on-surface">{person.name}</Text>
        {person.badge ? (
          <View className="mt-1.5 rounded-full border border-primary/30 bg-primary/[0.08] px-3 py-1">
            <Text testID="persona-insignia" className="text-[12px] font-semibold text-primary">{person.badge}</Text>
          </View>
        ) : null}
        {person.phone ? <Text testID="persona-telefono" className="mt-2 text-[14px] text-on-surface-variant">{formatPhoneDisplay(person.phone) || person.phone}</Text> : null}
        {props.error ? <Text testID="persona-error" accessibilityRole="alert" className="mt-3 text-center text-[13px] text-error">{props.error}</Text> : null}
        {props.checking ? (
          <ActivityIndicator className="mt-5" color={colors.primary} />
        ) : props.canWrite ? (
          <Pressable testID="persona-enviar-mensaje" disabled={props.busy} onPress={props.onWrite} className={`mt-5 min-h-[52px] w-full flex-row items-center justify-center gap-2 rounded-2xl bg-primary ${props.busy ? 'opacity-60' : ''}`}>
            {props.busy ? <ActivityIndicator color={colors['on-primary']} /> : <MessageCircle size={18} color={colors['on-primary']} />}
            <Text className="text-[16px] font-semibold text-on-primary">Enviar mensaje</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}
