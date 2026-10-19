import { Pressable, Text, View } from 'react-native';
import { Camera, Pencil } from 'lucide-react-native';
import { Avatar } from '../ui/Avatar';
import { useColores } from '../ui/tema';

/** El avatar del detalle (dp): 112, el del diseño `info-grupo`. */
const AVATAR_DEL_DETALLE = 112;

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
  onVerFoto,
  onEditarNombre,
}: {
  nombre: string;
  avatarUrl?: string;
  debajo: string;
  editable: boolean;
  subiendoFoto: boolean;
  onCambiarFoto: () => void;
  /** Tocar la foto la muestra entera (18/10); la cámara es la que la cambia. */
  onVerFoto: () => void;
  onEditarNombre: () => void;
}) {
  const colores = useColores();

  return (
    <View className="items-center px-6 pt-6">
      <View style={{ width: AVATAR_DEL_DETALLE, height: AVATAR_DEL_DETALLE }}>
        <Pressable
          testID="btn-ver-foto-chat"
          accessibilityLabel="Ver la foto"
          disabled={!avatarUrl && (!editable || subiendoFoto)}
          onPress={avatarUrl ? onVerFoto : onCambiarFoto}
        >
          <Avatar nombre={nombre} foto={avatarUrl} tamano={AVATAR_DEL_DETALLE} />
        </Pressable>
        {/* La cámara ENCIMA de la foto: sin esa marca, un avatar redondo no se
            lee como algo que se puede cambiar. */}
        {editable ? (
          <Pressable
            testID="btn-foto-grupo"
            accessibilityLabel="Cambiar la foto del grupo"
            disabled={subiendoFoto}
            onPress={onCambiarFoto}
            hitSlop={8}
            className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary"
          >
            <Camera size={15} color={colores['on-primary']} />
          </Pressable>
        ) : null}
      </View>

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
