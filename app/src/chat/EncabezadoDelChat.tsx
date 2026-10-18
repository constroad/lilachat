import { Pressable, Text, View } from 'react-native';
import { ArrowLeft, Lock, MoreVertical, Phone, Video } from 'lucide-react-native';
import { useMargenes } from '../ui/useMargenes';
import { Avatar } from '../ui/Avatar';
import { useColores } from '../ui/tema';

/** El avatar de la cabecera (dp): 40, como WhatsApp (antes 36). */
const AVATAR_DE_CABECERA = 40;

/**
 * La cabecera del chat (salió de `ChatScreen`, que pasaba de 900 líneas): la
 * flecha, el avatar y el nombre que abren el detalle, el estado de conexión o
 * presencia, las llamadas en un 1:1 y el ⋮.
 */
export function EncabezadoDelChat(props: {
  nombre: string;
  foto?: string;
  secreto: boolean;
  conectado: boolean;
  subtitulo: string;
  otroEscribe: boolean;
  /** Solo en un 1:1: una llamada grupal es otra cosa. */
  puedeLlamar: boolean;
  onVolver: () => void;
  onAbrirDetalle: () => void;
  onLlamar: (conVideo: boolean) => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const { nombre: nombreVisible, foto: fotoVisible } = props;
  // Como el diseño: FLECHA (no la palabra «Atrás»), avatar del chat junto al
  // nombre, y el menú al final.
  return (
    <View className="flex-row items-center gap-2 border-b border-outline/10 bg-surface px-3 pb-3" style={{ paddingTop: margenes.cabecera }}>
      <Pressable onPress={props.onVolver} testID="btn-volver" className="h-11 w-11 items-center justify-center">
        <ArrowLeft size={22} color={colores["on-surface"]} />
      </Pressable>
      {/* Tocar el avatar Y el nombre abre el detalle, como en WhatsApp: es
          donde la gente lo busca, mucho antes que en el menú de tres puntos.
          Los dos van dentro del MISMO Pressable — que solo responda el avatar
          deja un área táctil chiquita al lado de un nombre que parece tocable. */}
      <Pressable
        testID="btn-abrir-detalle"
        accessibilityLabel="Ver el detalle del chat"
        onPress={props.onAbrirDetalle}
        className="min-w-0 flex-1 flex-row items-center gap-2"
      >
      <Avatar nombre={nombreVisible} foto={fotoVisible} tamano={AVATAR_DE_CABECERA} />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          {/* El candado va PEGADO al nombre y no en una banda aparte: es una
              propiedad de con quién se está hablando, y tiene que verse en la
              misma mirada que el nombre. */}
          {props.secreto ? <Lock size={13} color={colores.primary} /> : null}
          <Text className="min-w-0 flex-1 text-base font-bold text-on-surface" numberOfLines={1}>
            {nombreVisible}
          </Text>
        </View>
        {/* El estado de conexión se DICE: un mensaje que no sale sin
            explicación es lo que hace desconfiar de una app de mensajería. */}
        {!props.conectado ? (
          <Text className="text-xs text-on-surface-variant" testID="estado-conexion">
            Sin conexión · se enviará cuando vuelva
          </Text>
        ) : props.subtitulo ? (
          <Text
            testID="estado-presencia"
            className={`text-xs ${props.otroEscribe ? 'text-primary' : 'text-on-surface-variant'}`}
            numberOfLines={1}
          >
            {props.subtitulo}
          </Text>
        ) : null}
      </View>
      </Pressable>
      {/* Llamadas: dejan de ser inertes (F10). Solo en 1:1 — una llamada
          grupal es otra cosa (varias conexiones a la vez) y prometerla con el
          mismo botón sería mentir. */}
      {props.puedeLlamar ? (
        <>
          <Pressable
            testID="btn-videollamada"
            accessibilityLabel="Videollamada"
            onPress={() => props.onLlamar(true)}
            className="h-11 w-11 items-center justify-center"
          >
            <Video size={20} color={colores["on-surface-variant"]} />
          </Pressable>
          <Pressable
            testID="btn-llamada"
            accessibilityLabel="Llamar"
            onPress={() => props.onLlamar(false)}
            className="h-11 w-11 items-center justify-center"
          >
            <Phone size={20} color={colores["on-surface-variant"]} />
          </Pressable>
        </>
      ) : null}
      {/* El ⋮ no hacía nada (auditoría del 16/10): un botón que no responde
          enseña que la app no responde. Abre la info del chat. */}
      <Pressable
        testID="btn-menu-chat"
        accessibilityLabel="Info del chat"
        onPress={props.onAbrirDetalle}
        android_ripple={{ color: colores.outline, borderless: true, radius: 22 }}
        className="h-11 w-11 items-center justify-center"
      >
        <MoreVertical size={20} color={colores["on-surface-variant"]} />
      </Pressable>
    </View>
  );
}
