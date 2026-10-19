import { Pressable, Text, View } from 'react-native';
import { Avatar } from '../ui/Avatar';
import type { MiembroMencionable } from './useMenciones';

/** El avatar de cada sugerencia (dp). */
const AVATAR_DE_SUGERENCIA = 32;

/**
 * La lista de miembros que aparece arriba de la barra al escribir «@» en un
 * grupo (José, 18/10), como WhatsApp. Tocar uno completa la mención.
 */
export function SugerenciasDeMencion(props: { sugerencias: readonly MiembroMencionable[]; onElegir: (miembro: MiembroMencionable) => void }) {
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
          <Avatar nombre={miembro.nombre} foto={miembro.foto} tamano={AVATAR_DE_SUGERENCIA} />
          <Text className="min-w-0 flex-1 text-[15px] font-semibold text-on-surface" numberOfLines={1}>
            {miembro.nombre}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
