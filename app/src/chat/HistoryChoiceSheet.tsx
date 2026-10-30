import { Pressable, Text, View } from 'react-native';
import { History, MessageSquarePlus } from 'lucide-react-native';
import { Modal } from '../ui/Modal';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';

/**
 * Adding someone to a group or channel (José 30/10): may they read what was
 * said before? «No» shows them only what comes after they join.
 */
export function HistoryChoiceSheet(props: { name: string | null; onChoose: (history: boolean) => void; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  return (
    <Modal visible={props.name !== null} transparent animationType="fade" onRequestClose={props.onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cancelar" />
      <View testID="pregunta-historial" className="rounded-t-2xl bg-surface px-5 pt-5" style={{ paddingBottom: margins.pie + 8 }}>
        <Text className="text-base font-bold text-on-surface">{`¿${props.name ?? ''} puede ver el historial?`}</Text>
        <Text className="mb-4 mt-1 text-[13px] text-on-surface-variant">Elige qué mensajes ve al entrar.</Text>
        <ChoiceRow testID="historial-todo" title="Sí, todo" detail="Lee los mensajes y archivos de antes." onPress={() => props.onChoose(true)} icon={<History size={20} color={colors.primary} />} />
        <ChoiceRow testID="historial-desde-ahora" title="No, solo desde ahora" detail="Ve lo que se escriba después de entrar." onPress={() => props.onChoose(false)} icon={<MessageSquarePlus size={20} color={colors['on-surface-variant']} />} />
      </View>
    </Modal>
  );
}

function ChoiceRow(props: { testID: string; title: string; detail: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable testID={props.testID} onPress={props.onPress} className="mb-2 min-h-[60px] flex-row items-center gap-3 rounded-xl border border-outline/20 px-4 py-2">
      {props.icon}
      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-on-surface">{props.title}</Text>
        <Text className="text-[13px] text-on-surface-variant">{props.detail}</Text>
      </View>
    </Pressable>
  );
}
