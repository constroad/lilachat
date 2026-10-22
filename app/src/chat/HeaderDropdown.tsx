import { Pressable, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Modal } from '../ui/Modal';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';

/** Below the header's buttons, like WhatsApp's menus (dp). */
const BELOW_HEADER = 52;
const MENU_WIDTH = 248;

/**
 * A menu that drops from the chat header (José, 21/10, like WhatsApp): the ⋮
 * and the camera with its arrow. A tap outside or the back button closes it.
 */
export function HeaderDropdown<Id extends string>(props: {
  visible: boolean;
  options: readonly { id: Id; label: string; Icon?: LucideIcon }[];
  /** How far from the right edge it hangs: under the button that opened it. */
  right: number;
  testID: string;
  onSelect: (id: Id) => void;
  onClose: () => void;
}) {
  const colors = useColores();
  const margins = useMargenes();
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <Pressable testID={`${props.testID}-fondo`} accessibilityLabel="Cerrar el menú" onPress={props.onClose} className="flex-1">
        <View
          testID={props.testID}
          className="absolute overflow-hidden rounded-xl border border-outline/15 bg-surface py-1.5"
          style={{ top: margins.cabecera + BELOW_HEADER, right: props.right, width: MENU_WIDTH, elevation: 6 }}
        >
          {props.options.map((option) => (
            <Pressable
              key={option.id}
              testID={`${props.testID}-${option.id}`}
              onPress={() => {
                props.onClose();
                props.onSelect(option.id);
              }}
              android_ripple={{ color: colors.outline }}
              className="min-h-[48px] flex-row items-center gap-4 px-5"
            >
              {option.Icon ? <option.Icon size={20} color={colors['on-surface-variant']} /> : null}
              <Text className="text-[16px] text-on-surface">{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}
