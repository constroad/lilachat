import { Text, View } from 'react-native';
import { Forward } from 'lucide-react-native';
import { useColores } from '../ui/tema';

/** José 13/11: a forwarded copy says so at the top of its bubble, like WhatsApp. */
export function ForwardedLabel(props: { testID: string; className?: string }) {
  const colors = useColores();
  return (
    <View testID={props.testID} className={`flex-row items-center gap-1 ${props.className ?? ''}`}>
      <Forward size={12} color={colors['on-surface-variant']} />
      <Text className="text-[12px] italic text-on-surface-variant">Reenviado</Text>
    </View>
  );
}
