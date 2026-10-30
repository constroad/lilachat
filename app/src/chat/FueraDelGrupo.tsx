import { Text, View } from 'react-native';

/**
 * En lugar de la barra de escribir cuando me sacaron del grupo (FL9d;
 * auditoría §46.2), como WhatsApp: la conversación se sigue leyendo, pero ya
 * no se puede escribir.
 */
/** `text`: another reason the composer is closed (pending 8: only admins write). */
export function ComposerLocked({ bottomInset, text }: { bottomInset: number; text?: string | null }) {
  return (
    <View
      testID="fuera-del-grupo"
      className="items-center border-t border-outline/10 bg-surface px-6 pt-4"
      style={{ paddingBottom: bottomInset + 8 }}
    >
      <Text className="text-center text-sm leading-5 text-on-surface-variant">
        {text ?? 'No puedes enviar mensajes a este grupo porque ya no eres participante.'}
      </Text>
    </View>
  );
}
