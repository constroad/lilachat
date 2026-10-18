import { Pressable, Text, View } from 'react-native';
import { Archive, ArrowLeft } from 'lucide-react-native';
import { useColores } from '../ui/tema';

/**
 * «Archivados» en la lista de chats (FL9), como WhatsApp: la fila de arriba
 * con cuántos tienen algo sin leer, y la cabecera de su vista.
 */
export function FilaDeArchivados(props: { sinLeer: number; onAbrir: () => void }) {
  const colores = useColores();
  return (
    <Pressable
      testID="fila-archivados"
      onPress={props.onAbrir}
      android_ripple={{ color: colores.outline }}
      className="min-h-[56px] flex-row items-center gap-3 px-4"
    >
      <View className="w-[52px] items-center">
        <Archive size={20} color={colores['on-surface-variant']} />
      </View>
      <Text className="flex-1 text-base font-semibold text-on-surface">Archivados</Text>
      {props.sinLeer > 0 ? (
        <Text testID="archivados-sin-leer" className="text-[12px] font-semibold text-primary">
          {props.sinLeer}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function CabeceraDeArchivados(props: { onVolver: () => void }) {
  const colores = useColores();
  return (
    <View testID="cabecera-archivados" className="flex-row items-center gap-1 px-2 pb-2 pt-1">
      <Pressable
        testID="btn-cerrar-archivados"
        accessibilityLabel="Volver a los chats"
        onPress={props.onVolver}
        className="h-11 w-11 items-center justify-center"
      >
        <ArrowLeft size={22} color={colores['on-surface']} />
      </Pressable>
      <Text className="text-lg font-semibold text-on-surface">Archivados</Text>
    </View>
  );
}
