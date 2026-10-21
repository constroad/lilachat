import { Pressable, Text, View } from 'react-native';
import { RotateCcw, ShieldCheck, ShieldOff, UserMinus, UserRound } from 'lucide-react-native';
import type { MemberAction } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';

const ACTIONS: Record<MemberAction, { label: string; Icon: typeof ShieldCheck; danger?: boolean }> = {
  'make-admin': { label: 'Hacer admin', Icon: ShieldCheck },
  'make-member': { label: 'Cambiar a miembro', Icon: ShieldOff },
  'make-guest': { label: 'Cambiar a invitado', Icon: UserRound },
  deactivate: { label: 'Desactivar', Icon: UserMinus, danger: true },
  reactivate: { label: 'Reactivar', Icon: RotateCcw },
};

/** «Cambiar rol o acceso» of a member (design `e1-10`): only what the actor may do. */
export function MemberActionsSheet(props: { name: string; actions: MemberAction[]; onPick: (action: MemberAction) => void; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cerrar" />
      <View testID="hoja-acciones-miembro" className="rounded-t-3xl bg-surface px-4 pt-4" style={{ paddingBottom: margins.pie + 12 }}>
        <View className="flex-row items-center justify-between border-b border-outline/10 pb-3">
          <Text className="text-[12px] font-bold uppercase tracking-widest text-primary">Cambiar rol o acceso</Text>
          <Text numberOfLines={1} className="max-w-[55%] text-[14px] font-bold text-on-surface">{props.name}</Text>
        </View>
        {props.actions.map((action) => {
          const { label, Icon, danger } = ACTIONS[action];
          return (
            <Pressable key={action} testID={`accion-${action}`} onPress={() => props.onPick(action)} className="min-h-[52px] flex-row items-center gap-3">
              <Icon size={20} color={danger ? colors.error : colors.primary} />
              <Text className={`text-[16px] font-semibold ${danger ? 'text-error' : 'text-on-surface'}`}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}
