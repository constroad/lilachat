import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Modal } from '../ui/Modal';
import { RTCView, type MediaStream } from 'react-native-webrtc';
import { Mic, PhoneOff, User } from 'lucide-react-native';
import { SwitchCamera } from 'lucide-react-native';
import type { CallState } from '@lilachat/shared';
import { mirrorsSelfView, type CameraFacing } from '@lilachat/shared';
import type { CallReaction } from '@lilachat/shared';
import type { CallEmoji } from '@lilachat/shared';
import { CallReactionOverlay, CallReactionSheet } from './CallReactions';
import { CallBar, CallMoreSheet, CallNotice, CallTopBar, EffectsButton } from './CallControls';
import { callBarButtons, moreOptions } from './callBarLayout';
import { leyendaDeLlamada, type EstadoDeMedios } from './estadoDeMedios';
import { useColores, useTema } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { Image } from 'expo-image';
import { inicialesDe } from '../ui/avatarMotor';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { DeslizarParaContestar } from './DeslizarParaContestar';

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
  medios,
  peerName,
  video,
  muted,
  speaker,
  localStream,
  remoteStream,
  onToggleMute,
  noiseSuppression,
  onNoiseSuppression,
  screen,
  onToggleSpeaker,
  onToggleVideo,
  facing,
  onSwitchCamera,
  reaction,
  onSendReaction,
  onReactionDone,
  puedeAlternarVideo,
  onAccept,
  onHangUp,
  onMinimize,
  onSendMessage,
  notice,
  peerPhoto,
}: {
  visible: boolean;
  state: CallState;
  /** Contestada no es conectada: hasta que pasa el audio dice «Conectando…». */
  medios: EstadoDeMedios;
  peerName: string;
  video: boolean;
  muted: boolean;
  speaker: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onToggleMute: () => void;
  /** «Cancelación de ruido» (design c-03): on by default, remembered. */
  noiseSuppression: boolean;
  /** «Compartir pantalla» (APK 0.1.175): only in a video call. */
  screen: { sharing: boolean; toggle: () => void };
  onNoiseSuppression: (on: boolean) => void;
  onToggleSpeaker: () => void;
  onToggleVideo: () => void;
  /** Front or rear camera (pending 97), with its button on my own view. */
  facing: CameraFacing;
  onSwitchCamera: () => void;
  /** Winks and stickers during the call (pending 98): what plays now, sending one, and when it ends. */
  reaction: { reaction: CallReaction; key: number } | null;
  onSendReaction: (reaction: CallReaction) => void;
  onReactionDone: () => void;
  /**
   * Solo en una videollamada: en una de voz el botón prendía el ícono sin
   * prender ninguna cámara (sumar video a mitad de llamada pide renegociar).
   */
  puedeAlternarVideo: boolean;
  onAccept: () => void;
  onHangUp: () => void;
  /** Pending 106: the call goes to a pill over the app; `onSendMessage` minimizes and opens its chat. */
  onMinimize: () => void;
  onSendMessage?: () => void;
  /** Pending 105b: the other did not get the last reaction. */
  notice: string | null;
  /** The other person's photo (the chat's), for the middle of the screen. */
  peerPhoto?: string;
}) {
  const { oscuro } = useTema();
  const margenes = useMargenes();
  const inicialesDelOtro = inicialesDe(peerName);
  // El reloj se recalcula cada segundo; el ESTADO no cambia por eso.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (state.fase !== 'activa') return;
    const timer = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state.fase]);

  const leyenda = leyendaDeLlamada({ state, medios, video, ahora });
  const [reacting, setReacting] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const sendEmoji = (emoji: CallEmoji) => onSendReaction({ kind: 'emoji', id: emoji });

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      {/* Un Modal de Android necesita su propia raíz de gestos para deslizar. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Los íconos del sistema contra el fondo de la llamada (FL13): en claro el
          fondo es violeta y van claros; en oscuro es lavanda y van oscuros. */}
      <StatusBar style={oscuro ? 'dark' : 'light'} />
      <View className="flex-1 bg-primary" testID="pantalla-llamada">
        {/* Video: el remoto llena la pantalla y el propio va en un recuadro
            arriba a la derecha, como en el diseño «Video Llamada». El audio no
            los tiene y cae al avatar de abajo. */}
        {video && remoteStream ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            objectFit="cover"
            // Each RTCView is a SurfaceView on Android: without a z-order the one created last wins, and the
            // other's video (it arrives after mine) covered my own box (pending 105, José 28/10).
            zOrder={0}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {video && localStream ? (
          <RTCView streamURL={localStream.toURL()} objectFit="cover" mirror={mirrorsSelfView(facing)} zOrder={1} style={estilos.propio} />
        ) : null}
        {/* Like WhatsApp (design c-02): switching the camera and the effects sit under my own view. */}
        {video && localStream?.getVideoTracks().length ? (
          <View style={estilos.selfActions} className="flex-row gap-3">
            {screen.sharing ? null : (
              <Pressable testID="btn-girar-camara" accessibilityLabel={facing === 'user' ? 'Usar la cámara trasera' : 'Usar la cámara frontal'} onPress={onSwitchCamera} className="h-11 w-11 items-center justify-center rounded-full bg-black/45">
                <SwitchCamera size={20} color="white" />
              </Pressable>
            )}
            {state.fase === 'activa' ? <EffectsButton onPress={() => setReacting(true)} /> : null}
          </View>
        ) : null}

        {state.fase === 'sonando' ? (
          <View className="items-center px-8" style={{ paddingTop: margenes.cabecera + 28 }}>
            <Text className="text-2xl font-bold text-on-primary" numberOfLines={1} testID="nombre-llamada">{peerName}</Text>
            <Text className="mt-1 text-[15px] text-on-primary/70" testID="estado-llamada">{leyenda}</Text>
          </View>
        ) : (
          <CallTopBar peerName={peerName} caption={leyenda} onMinimize={onMinimize} />
        )}

        <View className="flex-1 items-center justify-center">
          {/* With the other's video the face would cover it. */}
          {video && remoteStream ? null : <PeerFace photo={peerPhoto} initials={inicialesDelOtro ?? ''} />}
        </View>

        <View className="px-4" style={{ paddingBottom: margenes.pie + 24 }}>
          {/* Entrante: contestar y rechazar, separados y grandes. Un solo botón
              obligaría a mirar antes de actuar, y un teléfono sonando se
              contesta sin mirar. */}
          {state.fase === 'sonando' ? (
            <View className="flex-row items-end justify-evenly">
              <CallButton testID="btn-rechazar" label="Rechazar" onPress={onHangUp} destructivo Icon={PhoneOff} />
              {/* Contestar se DESLIZA (FL8.1): un toque sin querer no contesta. */}
              <DeslizarParaContestar onContestar={onAccept} />
            </View>
          ) : (
            <>
              <CallNotice text={screen.sharing ? 'Estás compartiendo tu pantalla' : notice} />
              <CallBar buttons={callBarButtons(puedeAlternarVideo)} video={video} muted={muted} speaker={speaker} onMore={() => setMoreOpen(true)} onToggleVideo={onToggleVideo} onToggleSpeaker={onToggleSpeaker} onToggleMute={onToggleMute} onHangUp={onHangUp} />
            </>
          )}
        </View>
        <CallReactionOverlay played={reaction} onDone={onReactionDone} />
      </View>
      {reacting ? <CallReactionSheet peerName={peerName} onSend={onSendReaction} onClose={() => setReacting(false)} /> : null}
      {moreOpen ? (
        <CallMoreSheet options={moreOptions(Boolean(onSendMessage), video && state.fase === 'activa')} video={video} noiseSuppression={noiseSuppression} onNoiseSuppression={onNoiseSuppression} sharingScreen={screen.sharing} onScreen={screen.toggle} onClose={() => setMoreOpen(false)} onMessage={() => onSendMessage?.()} onReactions={() => setReacting(true)} onEmoji={sendEmoji} />
      ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  // Recuadro del video propio: arriba a la derecha, sobre el remoto.
  // The other's photo in the middle, like WhatsApp's.
  foto: { width: 200, height: 200, borderRadius: 100 },
  propio: {
    position: 'absolute',
    top: 48,
    right: 16,
    width: 108,
    height: 160,
    borderRadius: 12,
    backgroundColor: '#000',
    zIndex: 1,
  },
  // Under my own view, its two buttons side by side.
  selfActions: { position: 'absolute', top: 216, right: 16, zIndex: 1 },
});

/**
 * A round button with its label under it, like WhatsApp's call (José, 22/10):
 * the one that is on goes white with the icon in the call's color; hanging up
 * is red.
 */
function CallButton(props: { Icon: typeof Mic; label: string; onPress: () => void; destructivo?: boolean; activo?: boolean; testID: string }) {
  const colores = useColores();
  const { Icon } = props;
  const fill = props.destructivo ? 'bg-red-600' : props.activo ? 'bg-on-primary' : 'bg-on-primary/15';
  return (
    <View className="w-[84px] items-center">
      <Pressable testID={props.testID} accessibilityLabel={props.label} accessibilityState={{ selected: Boolean(props.activo) }} onPress={props.onPress} className={`h-[68px] w-[68px] items-center justify-center rounded-full ${fill}`}>
        <Icon size={26} color={props.activo && !props.destructivo ? colores.primary : colores['on-primary']} />
      </Pressable>
      <Text className="mt-2 text-[13px] text-on-primary/85">{props.label}</Text>
    </View>
  );
}

/** The other person's photo, big and round; without one, their initials in the rings. */
function PeerFace(props: { photo?: string; initials: string }) {
  const colores = useColores();
  if (props.photo) return <Image source={{ uri: props.photo }} style={estilos.foto} contentFit="cover" testID="foto-llamada" />;
  return (
    <View className="h-52 w-52 items-center justify-center rounded-full bg-on-primary/10">
      <View className="h-40 w-40 items-center justify-center rounded-full bg-on-primary/10">
        <View className="h-32 w-32 items-center justify-center rounded-full bg-on-primary/20">
          {props.initials ? (
            <Text className="text-5xl font-semibold text-on-primary" allowFontScaling={false}>
              {props.initials}
            </Text>
          ) : (
            <User size={56} color={colores['on-primary']} />
          )}
        </View>
      </View>
    </View>
  );
}
