import { Pressable, Switch, Text, View } from 'react-native';
import { ChevronDown, MessageSquare, Mic, MicOff, MoreHorizontal, PhoneOff, Sparkles, Video, VideoOff, Volume2, X, type LucideIcon } from 'lucide-react-native';
import { CALL_EMOJIS, type CallEmoji } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import type { CallBarButton, MoreOption } from './callBarLayout';

/** Top of the call (design c-02): minimize on the left, who and how it goes in the middle. */
export function CallTopBar(props: { peerName: string; caption: string; onMinimize: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  return (
    <View className="mx-3 flex-row items-center rounded-3xl border border-on-primary/10 bg-black/25 px-2 py-2" style={{ marginTop: margins.cabecera + 8 }}>
      <Pressable testID="btn-minimizar-llamada" accessibilityLabel="Minimizar la llamada" onPress={props.onMinimize} className="h-12 w-12 items-center justify-center rounded-full bg-on-primary/15">
        <ChevronDown size={24} color={colors['on-primary']} />
      </Pressable>
      <View className="flex-1 items-center px-2">
        <Text className="text-[19px] font-bold text-on-primary" numberOfLines={1} testID="nombre-llamada">{props.peerName}</Text>
        <Text className="mt-0.5 font-mono text-[14px] text-on-primary/75" testID="estado-llamada">{props.caption}</Text>
      </View>
      {/* Same width as minimize, so the name stays centered. */}
      <View className="h-12 w-12" />
    </View>
  );
}

type BarProps = {
  buttons: CallBarButton[];
  video: boolean;
  muted: boolean;
  speaker: boolean;
  onMore: () => void;
  onToggleVideo: () => void;
  onToggleSpeaker: () => void;
  onToggleMute: () => void;
  onHangUp: () => void;
};

/** The bar at the bottom (design c-02): «⋯ · cámara · altavoz · micrófono · colgar», round and without labels. */
export function CallBar(props: BarProps) {
  const spec: Record<CallBarButton, { Icon: LucideIcon; label: string; onPress: () => void; on?: boolean; danger?: boolean; testID: string }> = {
    more: { Icon: MoreHorizontal, label: 'Más opciones', onPress: props.onMore, testID: 'btn-mas-opciones' },
    camera: { Icon: props.video ? Video : VideoOff, label: props.video ? 'Apagar la cámara' : 'Prender la cámara', onPress: props.onToggleVideo, on: !props.video, testID: 'btn-video' },
    speaker: { Icon: Volume2, label: 'Altavoz', onPress: props.onToggleSpeaker, on: props.speaker, testID: 'btn-altavoz' },
    mic: { Icon: props.muted ? MicOff : Mic, label: props.muted ? 'Activar el micrófono' : 'Silenciar', onPress: props.onToggleMute, on: props.muted, testID: 'btn-silenciar' },
    hangup: { Icon: PhoneOff, label: 'Colgar', onPress: props.onHangUp, danger: true, testID: 'btn-colgar' },
  };
  return (
    <View testID="barra-llamada" className="flex-row items-center justify-between rounded-[36px] border border-on-primary/10 bg-black/30 px-3 py-3">
      {props.buttons.map((key) => <RoundButton key={key} {...spec[key]} />)}
    </View>
  );
}

function RoundButton(props: { Icon: LucideIcon; label: string; onPress: () => void; on?: boolean; danger?: boolean; testID: string }) {
  const colors = useColores();
  const fill = props.danger ? 'bg-red-600' : props.on ? 'bg-on-primary' : 'bg-on-primary/15';
  return (
    <Pressable testID={props.testID} accessibilityLabel={props.label} accessibilityState={{ selected: Boolean(props.on) }} onPress={props.onPress} className={`h-[60px] w-[60px] items-center justify-center rounded-full ${fill}`}>
      <props.Icon size={26} color={props.on && !props.danger ? colors.primary : colors['on-primary']} />
    </Pressable>
  );
}

/** «Efectos» on my own view (design c-02): opens winks and stickers. */
export function EffectsButton(props: { onPress: () => void }) {
  return (
    <Pressable testID="btn-efectos" accessibilityLabel="Guiños y stickers" onPress={props.onPress} className="h-11 w-11 items-center justify-center rounded-full bg-black/45">
      <Sparkles size={20} color="white" />
    </Pressable>
  );
}

type MoreProps = { options: MoreOption[]; video: boolean; noiseSuppression: boolean; onNoiseSuppression: (on: boolean) => void; onClose: () => void; onMessage: () => void; onReactions: () => void; onEmoji: (emoji: CallEmoji) => void };

/** «Más opciones» (design c-03): quick effects (pending 78), send a message, noise cancellation, winks and stickers. */
export function CallMoreSheet(props: MoreProps) {
  const colors = useColores();
  const margins = useMargenes();
  const pick = (action: () => void) => {
    props.onClose();
    action();
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable className="flex-1 bg-black/30" onPress={props.onClose} accessibilityLabel="Cerrar" />
      <View testID="hoja-mas-opciones" className="rounded-t-3xl bg-surface px-5 pt-3" style={{ paddingBottom: margins.pie + 12 }}>
        <View className="mb-3 h-1.5 w-11 self-center rounded-full bg-outline/30" />
        <View className="mb-3 flex-row items-start">
          <View className="flex-1">
            <Text className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Más opciones</Text>
            <Text className="text-[20px] font-bold text-on-surface">{props.video ? 'Opciones de videollamada' : 'Opciones de llamada'}</Text>
          </View>
          <Pressable onPress={props.onClose} accessibilityLabel="Cerrar" className="h-11 w-11 items-center justify-center rounded-full border border-outline/20"><X size={18} color={colors['on-surface-variant']} /></Pressable>
        </View>
        <View className="mb-2 flex-row justify-between rounded-2xl border border-outline/15 px-2 py-2">
          {CALL_EMOJIS.map((emoji) => (
            <Pressable key={emoji} testID={`efecto-${emoji}`} accessibilityLabel={`Mandar ${emoji}`} onPress={() => pick(() => props.onEmoji(emoji))} className="h-12 w-12 items-center justify-center rounded-full">
              <Text className="text-[28px]" allowFontScaling={false}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
        {props.options.includes('message') ? <MoreRow testID="opcion-enviar-mensaje" Icon={MessageSquare} label="Enviar mensaje" onPress={() => pick(props.onMessage)} /> : null}
        <View testID="opcion-cancelacion-ruido" className="min-h-[68px] flex-row items-center gap-3 border-b border-outline/10">
          <View className="h-11 w-11 items-center justify-center rounded-xl border border-outline/20"><Mic size={20} color={colors['on-surface']} /></View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-[16px] text-on-surface">Cancelación de ruido</Text>
              {props.noiseSuppression ? <Text className="rounded-md border border-en-linea/30 bg-en-linea/10 px-1.5 text-[10px] font-bold text-en-linea">ACTIVO</Text> : null}
            </View>
            <Text className="text-[13px] text-on-surface-variant">Baja el ruido de la obra y del tráfico</Text>
          </View>
          <Switch testID="switch-cancelacion-ruido" value={props.noiseSuppression} onValueChange={props.onNoiseSuppression} trackColor={{ true: colors.primary, false: colors.outline }} thumbColor={colors['on-primary']} accessibilityLabel="Cancelación de ruido" />
        </View>
        <MoreRow testID="opcion-guinos" Icon={Sparkles} label="Guiños y stickers" onPress={() => pick(props.onReactions)} />
      </View>
    </Modal>
  );
}

function MoreRow(props: { testID: string; Icon: LucideIcon; label: string; onPress: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID={props.testID} onPress={props.onPress} className="min-h-[60px] flex-row items-center gap-3 border-b border-outline/10">
      <View className="h-11 w-11 items-center justify-center rounded-xl border border-outline/20"><props.Icon size={20} color={colors['on-surface']} /></View>
      <Text className="flex-1 text-[16px] text-on-surface">{props.label}</Text>
    </Pressable>
  );
}

/** The minimized call (pending 106): a pill over the app; tapping it brings the call back. */
export function CallPill(props: { peerName: string; caption: string; onPress: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: margins.cabecera + 4, left: 0, right: 0, alignItems: 'center', zIndex: 50 }}>
      <Pressable testID="pastilla-llamada" accessibilityLabel={`Volver a la llamada con ${props.peerName}`} onPress={props.onPress} className="flex-row items-center gap-2 rounded-full bg-en-linea px-4 py-2.5 shadow-lg">
        <Video size={16} color={colors['on-primary']} />
        <Text className="max-w-[220px] text-[14px] font-semibold text-on-primary" numberOfLines={1}>{props.peerName}</Text>
        <Text className="font-mono text-[13px] text-on-primary/85">{props.caption}</Text>
      </Pressable>
    </View>
  );
}

/** A line over the call that says something went wrong, like a reaction the other did not get (pending 105b). */
export function CallNotice(props: { text: string | null }) {
  if (!props.text) return null;
  return (
    <View pointerEvents="none" className="mx-6 mb-3 rounded-2xl bg-black/60 px-4 py-2.5">
      <Text testID="aviso-llamada" className="text-center text-[14px] text-white">{props.text}</Text>
    </View>
  );
}
