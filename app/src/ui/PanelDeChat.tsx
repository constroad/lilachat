import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { MessagesSquare } from 'lucide-react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColores } from './tema';

/**
 * El chat al lado de la lista, en tablet (FL10). Va debajo de la cabecera de
 * la app y a la derecha del riel, así que no le toca el margen del sistema
 * arriba ni a la izquierda: sin esto la cabecera del chat dejaba un hueco del
 * alto de la barra de estado.
 */
export function SinMargenArriba({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0, left: 0 }}>{children}</SafeAreaInsetsContext.Provider>
  );
}

/**
 * Girado, la barra de navegación o el recorte de la cámara quedan a un costado
 * (FL10): el contenido no se mete debajo.
 */
export function ConMargenesLaterales({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={{ flex: 1, paddingLeft: insets.left, paddingRight: insets.right }}>{children}</View>;
}

/** El panel derecho cuando todavía no se eligió un chat, como WhatsApp. */
export function SinChatElegido() {
  const colores = useColores();
  return (
    <View className="flex-1 items-center justify-center bg-background px-10" testID="sin-chat-elegido">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <MessagesSquare size={28} color={colores.primary} />
      </View>
      <Text className="mt-4 text-lg font-semibold text-on-surface">Elige un chat</Text>
      <Text className="mt-1 text-center text-sm leading-5 text-on-surface-variant">
        Tus conversaciones se abren aquí, al lado de la lista.
      </Text>
    </View>
  );
}
