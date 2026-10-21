import { Pressable, Text, View } from 'react-native';
import { ClipboardPaste, X } from 'lucide-react-native';
import { useColores } from '../ui/tema';

/** «Pegar la imagen copiada» over the bar while writing (José, 21/10), like the keyboard's suggestion in WhatsApp. */
export function PasteImageChip(props: { onPaste: () => void; onDismiss: () => void }) {
  const palette = useColores();
  return (
    <View testID="chip-pegar-imagen" className="flex-row items-center gap-1 border-t border-outline/10 bg-surface px-3 py-1.5">
      <Pressable testID="btn-pegar-imagen" onPress={props.onPaste} className="h-11 flex-row items-center gap-2 rounded-full bg-primary/10 px-4">
        <ClipboardPaste size={18} color={palette.primary} />
        <Text className="text-[14px] font-semibold text-primary">Pegar la imagen copiada</Text>
      </Pressable>
      <Pressable testID="btn-descartar-pegar" accessibilityLabel="No pegar" onPress={props.onDismiss} className="h-11 w-11 items-center justify-center">
        <X size={18} color={palette['on-surface-variant']} />
      </Pressable>
    </View>
  );
}
