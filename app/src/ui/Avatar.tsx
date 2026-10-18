import { memo } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { User } from 'lucide-react-native';
import { inicialesDe, tonoDeAvatar, type TonoDeAvatar } from './avatarMotor';
import { useColores } from './tema';

/** NativeWind solo ve clases literales: una por tono. */
const FONDO_DEL_TONO: Record<TonoDeAvatar, string> = {
  'avatar-1': 'bg-avatar-1',
  'avatar-2': 'bg-avatar-2',
  'avatar-3': 'bg-avatar-3',
  'avatar-4': 'bg-avatar-4',
  'avatar-5': 'bg-avatar-5',
};

/** Las iniciales y el ícono, en proporción al círculo (FL6): 52 dp → 19 / 24. */
const ESCALA_DE_INICIALES = 0.36;
const ESCALA_DEL_ICONO = 0.46;

/**
 * El avatar de toda la app (FL13, auditoría §48). Antes había 14 versiones:
 * cada pantalla con su tamaño de letra, su fondo y UNA inicial. Ahora: la
 * foto, o dos iniciales sobre el tono de esa persona, o el ícono si el nombre
 * es un teléfono.
 */
export const Avatar = memo(function Avatar(props: {
  /** También fija el tono: la misma persona, el mismo color en toda la app. */
  nombre: string;
  foto?: string | null;
  tamano: number;
  testID?: string;
}) {
  const colores = useColores();
  const iniciales = inicialesDe(props.nombre);
  const lado = { width: props.tamano, height: props.tamano };
  return (
    <View
      testID={props.testID}
      style={[lado, { borderRadius: props.tamano / 2 }]}
      className={`items-center justify-center overflow-hidden ${FONDO_DEL_TONO[tonoDeAvatar(props.nombre)]}`}
    >
      {props.foto ? (
        <Image source={{ uri: props.foto }} style={lado} contentFit="cover" />
      ) : iniciales ? (
        <Text
          style={{ fontSize: Math.round(props.tamano * ESCALA_DE_INICIALES) }}
          className="font-semibold text-primary"
          allowFontScaling={false}
        >
          {iniciales}
        </Text>
      ) : (
        <User size={Math.round(props.tamano * ESCALA_DEL_ICONO)} color={colores.primary} />
      )}
    </View>
  );
});
