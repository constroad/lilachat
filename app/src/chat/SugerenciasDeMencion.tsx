import { Pressable, Text, View } from 'react-native';
import { Megaphone } from 'lucide-react-native';
import { useColores } from '../ui/tema';
import { Avatar } from '../ui/Avatar';
import type { MentionSuggestion } from './useMenciones';

/** El avatar de cada sugerencia (dp). */
const AVATAR_DE_SUGERENCIA = 32;

/**
 * La lista de miembros que aparece arriba de la barra al escribir «@» en un
 * grupo (José, 18/10), como WhatsApp. Tocar uno completa la mención.
 */
export function SugerenciasDeMencion(props: { sugerencias: readonly MentionSuggestion[]; onElegir: (miembro: MentionSuggestion) => void }) {
  const palette = useColores();
  if (props.sugerencias.length === 0) return null;
  return (
    <View testID="sugerencias-mencion" className="border-t border-outline/10 bg-surface py-1">
      {props.sugerencias.map((miembro) => (
        <Pressable
          key={miembro.id}
          testID={`mencionar-${miembro.id}`}
          // Tocar la sugerencia no puede cerrar el teclado.
          onPress={() => props.onElegir(miembro)}
          className="min-h-[48px] flex-row items-center gap-3 px-4"
        >
          {miembro.hint ? (
            <View className="items-center justify-center rounded-full bg-primary/10" style={{ width: AVATAR_DE_SUGERENCIA, height: AVATAR_DE_SUGERENCIA }}>
              <Megaphone size={16} color={palette.primary} />
            </View>
          ) : (
            <Avatar nombre={miembro.nombre} foto={miembro.foto} tamano={AVATAR_DE_SUGERENCIA} />
          )}
          <View className="min-w-0 flex-1">
            <Text className="text-[15px] font-semibold text-on-surface" numberOfLines={1}>
              {miembro.hint ? `@${miembro.nombre}` : miembro.nombre}
            </Text>
            {miembro.hint ? (
              <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>
                {miembro.hint}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}
