import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, Volume2 } from 'lucide-react-native';
import { formatCallDuration, type CallState } from '@lilachat/shared';
import { useColores } from '../ui/tema';

/**
 * La pantalla de llamada (diseños «Llamada de Voz» y «Video Llamada»).
 *
 * Composición de las capturas: en voz, fondo de acento a pantalla completa,
 * nombre y reloj arriba, avatar grande en el centro con anillos, y al pie una
 * píldora con los controles y su etiqueta debajo —el de colgar en rojo y más
 * grande—. En video, el remoto a sangre y el propio en un recuadro chico
 * arriba a la derecha.
 *
 * **El estado lo manda la máquina de `shared/call.ts`**, no esta pantalla: acá
 * solo se dibuja. Un botón que decide por su cuenta si la llamada terminó es
 * como se llega a dos aparatos con ideas distintas de lo que está pasando.
 */
export function CallScreen({
  visible,
  state,
  peerName,
  video,
  muted,
  speaker,
  onToggleMute,
  onToggleSpeaker,
  onToggleVideo,
  onAccept,
  onHangUp,
}: {
  visible: boolean;
  state: CallState;
  peerName: string;
  video: boolean;
  muted: boolean;
  speaker: boolean;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onToggleVideo: () => void;
  onAccept: () => void;
  onHangUp: () => void;
}) {
  const colores = useColores();
  // El reloj se recalcula cada segundo; el ESTADO no cambia por eso.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (state.fase !== 'activa') return;
    const timer = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state.fase]);

  const leyenda =
    state.fase === 'llamando'
      ? 'Llamando…'
      : state.fase === 'sonando'
        ? video
          ? 'Videollamada entrante'
          : 'Llamada entrante'
        : state.fase === 'activa'
          ? formatCallDuration(state, ahora)
          : 'Llamada terminada';

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View className="flex-1 bg-primary" testID="pantalla-llamada">
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-2xl font-bold text-on-primary" testID="nombre-llamada">
            {peerName}
          </Text>
          <Text className="mt-1 text-[15px] text-on-primary/70" testID="estado-llamada">
            {leyenda}
          </Text>

          {/* Los anillos del diseño: dos círculos concéntricos alrededor del
              avatar. Marcan que algo está pasando sin necesidad de leer. */}
          <View className="mt-12 h-52 w-52 items-center justify-center rounded-full bg-on-primary/10">
            <View className="h-40 w-40 items-center justify-center rounded-full bg-on-primary/10">
              <View className="h-32 w-32 items-center justify-center rounded-full bg-on-primary/20">
                <Text className="text-5xl font-bold text-on-primary">
                  {peerName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View className="px-6 pb-14">
          {/* Entrante: contestar y rechazar, separados y grandes. Un solo botón
              obligaría a mirar antes de actuar, y un teléfono sonando se
              contesta sin mirar. */}
          {state.fase === 'sonando' ? (
            <View className="flex-row items-center justify-evenly">
              <Boton
                testID="btn-rechazar"
                label="Rechazar"
                onPress={onHangUp}
                destructivo
                icon={<PhoneOff size={26} color={colores["on-primary"]} />}
              />
              <Boton
                testID="btn-contestar"
                label="Contestar"
                onPress={onAccept}
                verde
                icon={<Phone size={26} color={colores["on-primary"]} />}
              />
            </View>
          ) : (
            <View className="flex-row items-center justify-evenly rounded-3xl bg-on-primary/10 py-4">
              <Boton
                testID="btn-silenciar"
                label={muted ? 'Activar' : 'Silenciar'}
                onPress={onToggleMute}
                activo={muted}
                icon={
                  muted ? <MicOff size={22} color={colores["on-primary"]} /> : <Mic size={22} color={colores["on-primary"]} />
                }
              />
              <Boton
                testID="btn-altavoz"
                label="Altavoz"
                onPress={onToggleSpeaker}
                activo={speaker}
                icon={<Volume2 size={22} color={colores["on-primary"]} />}
              />
              <Boton
                testID="btn-video"
                label="Video"
                onPress={onToggleVideo}
                activo={video}
                icon={
                  video ? <Video size={22} color={colores["on-primary"]} /> : <VideoOff size={22} color={colores["on-primary"]} />
                }
              />
              <Boton
                testID="btn-colgar"
                label="Colgar"
                onPress={onHangUp}
                destructivo
                icon={<PhoneOff size={22} color={colores["on-primary"]} />}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** Círculo con etiqueta debajo, como en las dos capturas. */
function Boton({
  icon,
  label,
  onPress,
  destructivo,
  verde,
  activo,
  testID,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  destructivo?: boolean;
  verde?: boolean;
  activo?: boolean;
  testID: string;
}) {
  // El de colgar es MÁS GRANDE y rojo: es el que se busca a ciegas.
  const grande = destructivo || verde;

  return (
    <View className="items-center">
      <Pressable
        testID={testID}
        onPress={onPress}
        className={`items-center justify-center rounded-full ${
          grande ? 'h-16 w-16' : 'h-14 w-14'
        } ${
          destructivo
            ? 'bg-red-600'
            : verde
              ? 'bg-emerald-500'
              : activo
                ? 'bg-on-primary/40'
                : 'bg-on-primary/15'
        }`}
      >
        {icon}
      </Pressable>
      <Text className="mt-1.5 text-[11px] text-on-primary/70">{label}</Text>
    </View>
  );
}
