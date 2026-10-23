import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Modal } from './Modal';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { ArrowLeft } from 'lucide-react-native';
import { useColores } from './tema';
import { useMargenes } from './useMargenes';

/**
 * Una pantalla propia que se abre desde una fila (FL13): flecha, título y el
 * contenido con scroll. La usa lo que antes se desplegaba DENTRO de Ajustes,
 * como el formulario de la passphrase, que empujaba todo lo demás hacia abajo.
 */
export function PantallaEnModal(props: {
  visible: boolean;
  titulo: string;
  onCerrar: () => void;
  testIDCerrar?: string;
  /** Stays at the bottom, outside the scroll (pending 13: «Eliminar para mí» of the picked files). */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onCerrar}>
      <View className="flex-1 bg-background">
        <View className="min-h-[56px] flex-row items-center gap-1 bg-background px-2 pb-2" style={{ paddingTop: margenes.cabecera }}>
          <Pressable
            testID={props.testIDCerrar}
            accessibilityLabel="Volver"
            onPress={props.onCerrar}
            className="h-12 w-12 items-center justify-center rounded-full"
          >
            <ArrowLeft size={22} color={colores['on-surface']} />
          </Pressable>
          <Text accessibilityRole="header" className="flex-1 text-xl font-bold text-on-surface" numberOfLines={1}>
            {props.titulo}
          </Text>
        </View>
        {/* `padding` también en Android: con edge-to-edge la ventana no se
            encoge con el teclado (mismo motivo que en ChatScreen). */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: margenes.pie + 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {props.children}
          </ScrollView>
          {props.footer ? <View className="px-4 pt-2" style={{ paddingBottom: margenes.pie + 12 }}>{props.footer}</View> : null}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
