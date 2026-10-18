import { Text, View } from 'react-native';

/**
 * En lugar de la barra de escribir cuando me sacaron del grupo (FL9d;
 * auditoría §46.2), como WhatsApp: la conversación se sigue leyendo, pero ya
 * no se puede escribir.
 */
export function FueraDelGrupo({ margenPie }: { margenPie: number }) {
  return (
    <View
      testID="fuera-del-grupo"
      className="items-center border-t border-outline/10 bg-surface px-6 pt-4"
      style={{ paddingBottom: margenPie + 8 }}
    >
      <Text className="text-center text-sm leading-5 text-on-surface-variant">
        No puedes enviar mensajes a este grupo porque ya no eres participante.
      </Text>
    </View>
  );
}
