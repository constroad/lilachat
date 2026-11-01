import { Pressable } from 'react-native';
import { SquareSlash } from 'lucide-react-native';
import { useColores } from '../../ui/tema';

/**
 * The «/» next to the field (José 02/11: «coloca un CTA para mostrar los
 * comandos»), in a channel and in the chat with an app: it writes the slash,
 * so the list of the chat's commands opens without knowing it was there.
 */
export function SlashCommandsButton(props: { onPress: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID="btn-comandos" accessibilityLabel="Ver los comandos" onPress={props.onPress} android_ripple={{ color: colors.outline, borderless: true, radius: 20 }} className="h-11 w-11 items-center justify-center">
      <SquareSlash size={20} color={colors.outline} />
    </Pressable>
  );
}
