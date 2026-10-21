import { Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { CHAT_FONT, CHAT_FONT_CHOICES } from '@lilachat/shared';
import { Rotulo } from '../ui/Rotulo';
import { Avatar } from '../ui/Avatar';
import { setChatFont, useChatFont } from '../ui/chatFont';
import { useColores } from '../ui/tema';

/** The «Aa» of each option grows like the text it stands for. */
const SAMPLE_GROWTH = 3;

/**
 * Ajustes › Tamaño de la letra (backlog 1, José 20/10; design
 * `f-01-tamano-de-letra`): three sizes side by side, each with its «Aa», and
 * a preview of two bubbles at the chosen size.
 */
export function ChatFontSetting() {
  const colors = useColores();
  const font = useChatFont();
  return (
    <>
      <Rotulo>Tamaño de la letra</Rotulo>
      <View className="rounded-2xl border border-outline/10 bg-surface p-3" testID="ajuste-tamano-letra">
        <View className="flex-row gap-1.5 rounded-xl border border-outline/10 p-1">
          {CHAT_FONT_CHOICES.map((choice) => {
            const lit = font.choice === choice;
            return (
              <Pressable key={choice} testID={`letra-${choice}`} accessibilityRole="button" accessibilityState={{ selected: lit }} onPress={() => setChatFont(choice)} className={`min-h-[72px] flex-1 items-center justify-center rounded-lg border ${lit ? 'border-primary bg-primary/[0.06]' : 'border-transparent'}`}>
                <Text className={`font-bold ${lit ? 'text-primary' : 'text-on-surface-variant'}`} style={{ fontSize: CHAT_FONT[choice].size + SAMPLE_GROWTH }}>Aa</Text>
                <Text className={`text-[13px] ${lit ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}>{CHAT_FONT[choice].label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text className="px-2 pb-1 pt-2.5 text-center text-[12px] text-on-surface-variant">Se suma al tamaño de letra de tu teléfono.</Text>
        <View className="mt-2 gap-2 overflow-hidden rounded-xl bg-fondo-chat p-3" testID="vista-previa-letra">
          <View className="flex-row items-end gap-2 self-start">
            <Avatar nombre="Ana Torres" tamano={28} />
            <View className="rounded-2xl rounded-bl-md bg-burbuja-ajena px-3 py-1.5">
              <Text className="text-on-burbuja-ajena" style={{ fontSize: font.size, lineHeight: font.line }}>¿Ya salió el mixer?</Text>
              <Text className="self-end text-[11px] text-on-surface-variant">10:40</Text>
            </View>
          </View>
          <View className="self-end rounded-2xl rounded-br-md bg-burbuja-propia px-3 py-1.5">
            <Text className="text-on-burbuja-propia" style={{ fontSize: font.size, lineHeight: font.line }}>Sí, va en camino</Text>
            <View className="flex-row items-center gap-1 self-end">
              <Text className="text-[11px] text-on-burbuja-propia-suave">10:41</Text>
              <Check size={13} color={colors['check-leido-propio']} />
            </View>
          </View>
        </View>
      </View>
    </>
  );
}
