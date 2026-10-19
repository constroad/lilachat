import type { ReactNode } from 'react';
import { Modal, Pressable, StatusBar, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { ArrowLeft } from 'lucide-react-native';
import { useMargenes } from './useMargenes';

export type AccionDelVisor = { testID: string; texto: string; icono: ReactNode; onPress: () => void };

/**
 * Una foto de perfil o de grupo a pantalla completa (José, 18/10: «al tocar
 * la foto de perfil no me deja verla, solo elegir otra»). Como WhatsApp:
 * fondo negro, la foto entera y, si es tuya, las acciones abajo.
 */
export function VisorDeFoto(props: { foto?: string | null; titulo: string; acciones?: AccionDelVisor[]; onCerrar: () => void }) {
  const margenes = useMargenes();
  return (
    <Modal visible={Boolean(props.foto)} animationType="fade" onRequestClose={props.onCerrar} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View testID="visor-de-foto" className="flex-1 bg-black">
        <View className="flex-row items-center gap-2 px-2" style={{ paddingTop: margenes.cabecera }}>
          <Pressable testID="btn-cerrar-visor-de-foto" accessibilityLabel="Cerrar" onPress={props.onCerrar} className="h-12 w-12 items-center justify-center">
            <ArrowLeft size={22} color="white" />
          </Pressable>
          <Text className="min-w-0 flex-1 text-[17px] font-semibold text-white" numberOfLines={1}>
            {props.titulo}
          </Text>
        </View>
        {props.foto ? <Image source={{ uri: props.foto }} style={{ flex: 1 }} contentFit="contain" transition={120} /> : null}
        {props.acciones?.length ? (
          <View className="flex-row justify-center gap-10 pt-4" style={{ paddingBottom: margenes.pie + 16 }}>
            {props.acciones.map((accion) => (
              <Pressable key={accion.testID} testID={accion.testID} onPress={accion.onPress} className="min-h-[56px] items-center justify-center gap-1 px-3">
                {accion.icono}
                <Text className="text-[13px] font-semibold text-white">{accion.texto}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
