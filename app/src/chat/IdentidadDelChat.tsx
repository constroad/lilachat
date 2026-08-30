import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Camera, Pencil } from 'lucide-react-native';
import { useColores } from '../ui/tema';

/**
 * La cabecera del detalle: foto, nombre y el dato que ubica —cuántos son, o el
 * teléfono en un 1:1—. Es la composición del diseño `info-grupo-alpha.png`.
 *
 * En un grupo, la foto y el nombre **se pueden tocar para cambiarlos**; en un
 * 1:1 no, porque ahí no hay nombre ni foto propios: son los de la otra persona,
 * y dejarlos editar sería dejarte renombrar a alguien en su propio chat.
 */
export function IdentidadDelChat({
  nombre,
  avatarUrl,
  debajo,
  editable,
  subiendoFoto,
  onCambiarFoto,
  onEditarNombre,
}: {
  nombre: string;
  avatarUrl?: string;
  debajo: string;
  editable: boolean;
  subiendoFoto: boolean;
  onCambiarFoto: () => void;
  onEditarNombre: () => void;
}) {
  const colores = useColores();

  return (
    <View className="items-center px-6 pt-6">
      <Pressable
        testID="btn-foto-grupo"
        accessibilityLabel="Cambiar la foto del grupo"
        disabled={!editable || subiendoFoto}
        onPress={onCambiarFoto}
      >
        <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-primary/10">
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: 96, height: 96 }} contentFit="cover" />
          ) : (
            <Text className="text-3xl font-bold text-primary">
              {nombre.slice(0, 1).toUpperCase()}
            </Text>
          )}
        </View>
        {/* La cámara ENCIMA de la foto: sin esa marca, un avatar redondo no se
            lee como algo que se puede tocar, y la foto del grupo se queda sin
            cambiar para siempre. */}
        {editable ? (
          <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary">
            <Camera size={15} color={colores['on-primary']} />
          </View>
        ) : null}
      </Pressable>

      {subiendoFoto ? (
        <Text testID="subiendo-foto" className="mt-2 text-[12px] text-on-surface-variant">
          Subiendo la foto…
        </Text>
      ) : null}

      <View className="mt-3 max-w-full flex-row items-center gap-1">
        <Text className="shrink text-center text-xl font-bold text-on-surface" numberOfLines={2}>
          {nombre}
        </Text>
        {editable ? (
          <Pressable
            testID="btn-editar-nombre"
            accessibilityLabel="Cambiar el nombre del grupo"
            onPress={onEditarNombre}
            className="h-11 w-11 shrink-0 items-center justify-center"
          >
            <Pencil size={16} color={colores.primary} />
          </Pressable>
        ) : null}
      </View>

      <Text className="mt-0.5 text-sm text-on-surface-variant">{debajo}</Text>
    </View>
  );
}
