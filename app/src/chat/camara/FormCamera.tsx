import { useRef, useState, type RefObject } from 'react';
import { Animated, Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { CameraView, type CameraCapturedPicture } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Check, Image as ImageIcon, RefreshCw, RotateCcw, X, Zap, ZapOff } from 'lucide-react-native';
import type { TimemarkStampAsked } from '@lilachat/shared';
import { Modal } from '../../ui/Modal';
import { reportarError } from '../../ui/reportarError';
import { useMargenes } from '../../ui/useMargenes';
import { getCurrentSpaceId, useSpaceLogo } from '../../spaces/currentSpace';
import { FLASH_LABEL, NEXT_FLASH, type FlashMode } from './flash';
import { StampOverlay } from './StampOverlay';
import { VideoPreview } from './VideoPreview';
import { useCameraLogo } from './cameraLogoPref';
import { CameraChips } from './CameraChips';
import { useLiveStamp } from './useLiveStamp';
import { useVideoRecording } from './useVideoRecording';
import { recordingLabel, VIDEO_BITRATE } from '@lilachat/shared';
import { ModeSwitch, RECORD_RED, type CameraMode } from './ModeSwitch';

export type CameraShot = { uri: string; mime: string; /** A video's length, for the ticket's limit. */ seconds?: number };

export const CAMERA_DENIED = 'Permite la cámara para tomar la foto.';
/** Native and untouched: `uploadFormPhoto` makes it lighter once (Portal's standard, 28/10). */
const PHOTO_QUALITY = 1;
const PHOTO_MIME = 'image/jpeg';
const VIDEO_MIME = 'video/mp4';
const MS_PER_SECOND = 1000;
/** The FOTO / VIDEO row above the shutter: label, dot and its margin. */
const MODE_SWITCH = 52;
const SHUTTER = 76;
const SIDE_BUTTON = 48;
const BLINK_IN_MS = 60;
const BLINK_OUT_MS = 140;
/** Where the controls sit, so the stamp stays above them. */
const BOTTOM_BAR = 120;
const SIDE_BAR = 110;
/** The chips sit under the top bar. */
const CHIPS_BELOW = 56;

/**
 * Asks only when it has to. Android refuses a request while another one is open,
 * and the report's GPS may be asking for its own permission at this very moment.
 */
export async function cameraAllowed(): Promise<boolean> {
  try {
    const current = await ImagePicker.getCameraPermissionsAsync();
    return current.granted || (await ImagePicker.requestCameraPermissionsAsync()).granted;
  } catch (error) {
    reportarError('FormCamera.cameraAllowed', error);
    return false;
  }
}

type Props = { title: string; onShot: (shot: CameraShot, stamp: TimemarkStampAsked) => void; onClose: () => void; onGallery?: () => void; /** FOTO / VIDEO with this ceiling (an observation: 30 s, the Drive: 60 s). */ video?: { maxSeconds: number; first?: boolean } };

/**
 * The full-screen camera of every report, form, observation and Drive shot in the APK (José 12/11,
 * designs cam-01/02/03/04/05): the Timemark-like stamp live (hour, date, weekday and address, never
 * the person's name), the «Logo» chip, and the shot reviewed before it is used. Where the caller
 * allows it, FOTO / VIDEO with the recording clock. Held sideways, the controls go to a column on
 * the right. The server burns the same stamp, once, while it compresses the shot.
 */
export function FormCamera(props: Props) {
  const camera = useRef<CameraView>(null);
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const [flash, setFlash] = useState<FlashMode>('auto');
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [mode, setMode] = useState<CameraMode>(props.video?.first ? 'video' : 'picture');
  const margins = useMargenes();
  const live = useLiveStamp();
  const logoOn = useCameraLogo();
  const spaceLogo = useSpaceLogo(getCurrentSpaceId());
  const logoUrl = logoOn ? spaceLogo : null;
  const capture = useFormCapture(camera, props.video?.maxSeconds);
  const { shot } = capture;
  const use = () => shot && props.onShot(shot, { timemark: true, point: live.point, logo: Boolean(logoUrl), takenAt: shot.takenAt });
  return (
    <Modal visible animationType="fade" onRequestClose={shot ? capture.retake : props.onClose}>
      <View testID="camara-formulario" className="flex-1 bg-black">
        <ShotOrPreview camera={camera} shot={shot} mode={mode} facing={facing} flash={flash} />
        {/* While it captures the preview goes transparent and would show the form behind it. */}
        {capture.shooting ? <View pointerEvents="none" className="absolute inset-0 bg-black" /> : null}
        <Animated.View pointerEvents="none" className="absolute inset-0 bg-white" style={{ opacity: capture.blink }} />
        <StampOverlay stamp={live.stamp} logoUrl={logoUrl} width={width} height={height} bottomInset={landscape ? 0 : BOTTOM_BAR + margins.pie + (props.video ? MODE_SWITCH : 0)} />
        <TopBar title={props.title} flash={flash} reviewing={Boolean(shot)} landscape={landscape} recording={capture.recording ? recordingLabel(capture.elapsedMs, props.video?.maxSeconds) : null} onClose={props.onClose} onFlash={() => setFlash((before) => NEXT_FLASH[before])} />
        {shot || capture.recording ? null : <CameraChips logoOn={logoOn} logoUrl={spaceLogo} precision={live.point?.precision ?? null} top={margins.cabecera + CHIPS_BELOW} />}
        {shot ? (
          <ReviewBar landscape={landscape} video={isVideoShot(shot)} onRetake={capture.retake} onUse={use} />
        ) : (
          <ShutterBar landscape={landscape} mode={mode} recording={capture.recording} shooting={capture.shooting} onMode={props.video ? setMode : undefined} onShoot={() => void (mode === 'video' ? capture.record() : capture.shoot())} onFlip={() => setFacing((before) => (before === 'back' ? 'front' : 'back'))} onGallery={props.onGallery} />
        )}
      </View>
    </Modal>
  );
}

type TakenShot = CameraShot & { takenAt: string };
const isVideoShot = (shot: CameraShot) => shot.mime.startsWith('video/');

/** The photo or the video being taken, and the blink of the shutter. */
function useFormCapture(camera: RefObject<CameraView | null>, maxSeconds: number | undefined) {
  const blink = useRef(new Animated.Value(0)).current;
  const [shooting, setShooting] = useState(false);
  const [shot, setShot] = useState<TakenShot | null>(null);
  const video = useVideoRecording(camera, true, maxSeconds);
  const shoot = async () => {
    if (shooting || !camera.current) return;
    setShooting(true);
    Animated.sequence([Animated.timing(blink, { toValue: 1, duration: BLINK_IN_MS, useNativeDriver: true }), Animated.timing(blink, { toValue: 0, duration: BLINK_OUT_MS, useNativeDriver: true })]).start();
    const takenAt = new Date().toISOString();
    try {
      await camera.current.takePictureAsync({ quality: PHOTO_QUALITY, onPictureSaved: (picture: CameraCapturedPicture) => (setShot({ uri: picture.uri, mime: PHOTO_MIME, takenAt }), setShooting(false)) });
    } catch (error) {
      reportarError('FormCamera.shoot', error);
      setShooting(false);
    }
  };
  const record = async () => {
    if (video.recording) return video.stop();
    const recorded = await video.start();
    if (recorded) setShot({ uri: recorded.uri, mime: VIDEO_MIME, takenAt: recorded.startedAt, seconds: Math.round((Date.now() - Date.parse(recorded.startedAt)) / MS_PER_SECOND) });
  };
  return { blink, shooting, shot, recording: video.recording, elapsedMs: video.elapsedMs, shoot, record, retake: () => setShot(null) };
}

/** The live camera, or the shot to review: the photo, or the video playing in a loop (design cam-06). */
function ShotOrPreview(props: { camera: RefObject<CameraView | null>; shot: CameraShot | null; mode: CameraMode; facing: 'back' | 'front'; flash: FlashMode }) {
  if (props.shot && isVideoShot(props.shot)) return <VideoPreview uri={props.shot.uri} fit="cover" />;
  if (props.shot) return <Image source={{ uri: props.shot.uri }} style={{ flex: 1 }} resizeMode="cover" />;
  return <CameraView ref={props.camera} style={{ flex: 1 }} mode={props.mode} facing={props.facing} flash={props.flash} videoQuality="720p" videoBitrate={VIDEO_BITRATE} />;
}


function TopBar(props: { title: string; flash: FlashMode; reviewing: boolean; landscape: boolean; recording: string | null; onClose: () => void; onFlash: () => void }) {
  const margins = useMargenes();
  return (
    <View className="absolute left-0 top-0 flex-row items-center gap-3 px-3" style={{ paddingTop: margins.cabecera, right: props.landscape ? SIDE_BAR : 0 }}>
      <Pressable testID="btn-cerrar-camara-formulario" accessibilityLabel="Cerrar la cámara" onPress={props.onClose} className="h-11 w-11 items-center justify-center rounded-full bg-black/45">
        <X size={24} color="white" />
      </Pressable>
      {/* Audit 12/11: white on a bright frame (the sun on site) vanished; it sits on its own dark pill. */}
      <View className="min-w-0 flex-1 items-center">
        {props.recording ? (
          <View testID="reloj-de-video" className="flex-row items-center gap-2 rounded-full border border-red-500 bg-black/60 px-3 py-1.5">
            <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RECORD_RED }} />
            <Text className="text-[15px] font-bold" style={{ color: 'white', fontVariant: ['tabular-nums'] }}>{props.recording}</Text>
          </View>
        ) : (
          <Text className="max-w-full rounded-full bg-black/55 px-3 py-1.5 text-center text-[15px] font-semibold" style={{ color: 'white' }} numberOfLines={1}>{props.title}</Text>
        )}
      </View>
      {props.reviewing ? <View className="w-11" /> : (
        <Pressable testID="btn-flash-formulario" accessibilityLabel={`Flash: ${FLASH_LABEL[props.flash]}`} onPress={props.onFlash} className="h-11 flex-row items-center gap-1 rounded-full bg-black/45 px-3">
          {props.flash === 'off' ? <ZapOff size={20} color="white" /> : <Zap size={20} color="white" />}
          <Text className="text-[13px] font-semibold" style={{ color: 'white' }}>{FLASH_LABEL[props.flash]}</Text>
        </Pressable>
      )}
    </View>
  );
}

type ShutterProps = { landscape: boolean; mode: CameraMode; recording: boolean; shooting: boolean; onMode?: (mode: CameraMode) => void; onShoot: () => void; onFlip: () => void; onGallery?: () => void };

function ShutterBar(props: ShutterProps) {
  const margins = useMargenes();
  const along = props.landscape ? 'absolute bottom-0 right-0 top-0 items-center justify-around py-6' : 'absolute bottom-0 left-0 right-0 items-center pt-3';
  return (
    <View className={along} style={props.landscape ? { width: SIDE_BAR, paddingRight: margins.pie } : { paddingBottom: margins.pie + 12 }}>
      {props.onMode && !props.recording ? <ModeSwitch mode={props.mode} onMode={props.onMode} /> : null}
      <View className={props.landscape ? 'flex-1 items-center justify-around' : 'w-full flex-row items-center justify-around'}>
        {props.onGallery && !props.recording ? (
          <Pressable testID="btn-galeria-formulario" accessibilityLabel="Elegir de la galería" disabled={props.shooting} onPress={props.onGallery} className="items-center justify-center rounded-xl bg-white/15" style={{ width: SIDE_BUTTON, height: SIDE_BUTTON }}>
            <ImageIcon size={22} color="white" />
          </Pressable>
        ) : <View style={{ width: SIDE_BUTTON, height: SIDE_BUTTON }} />}
        <Shutter mode={props.mode} recording={props.recording} shooting={props.shooting} onShoot={props.onShoot} />
        {props.recording ? <View style={{ width: SIDE_BUTTON, height: SIDE_BUTTON }} /> : (
          <Pressable testID="btn-girar-camara" accessibilityLabel="Cambiar de cámara" onPress={props.onFlip} className="items-center justify-center rounded-full bg-black/45" style={{ width: SIDE_BUTTON, height: SIDE_BUTTON }}>
            <RefreshCw size={22} color="white" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** White for a photo, red to record, a red square to stop (designs cam-04/cam-05). */
function Shutter(props: { mode: CameraMode; recording: boolean; shooting: boolean; onShoot: () => void }) {
  const inner = SHUTTER - 16;
  const label = props.mode === 'video' ? (props.recording ? 'Detener el video' : 'Grabar video') : 'Tomar la foto';
  return (
    <Pressable testID="btn-disparar-formulario" accessibilityLabel={label} disabled={props.shooting} onPress={props.onShoot} className="items-center justify-center rounded-full border-4 border-white" style={{ width: SHUTTER, height: SHUTTER }}>
      {props.recording ? (
        <View className="rounded-md" style={{ width: inner / 2, height: inner / 2, backgroundColor: RECORD_RED }} />
      ) : (
        <View className={`rounded-full ${props.shooting ? 'opacity-60' : ''}`} style={{ width: inner, height: inner, backgroundColor: props.mode === 'video' ? RECORD_RED : 'white' }} />
      )}
    </Pressable>
  );
}

/** Designs cam-03/cam-06: the shot with its stamp, then «Repetir» or «Usar foto» / «Usar video». */
function ReviewBar(props: { landscape: boolean; video: boolean; onRetake: () => void; onUse: () => void }) {
  const margins = useMargenes();
  return (
    <View className={props.landscape ? 'absolute bottom-0 right-0 top-0 justify-center gap-3 px-3' : 'absolute bottom-0 left-0 right-0 flex-row gap-3 px-4 pt-3'} style={props.landscape ? { width: SIDE_BAR + 40 } : { paddingBottom: margins.pie + 12 }}>
      <Pressable testID="btn-repetir-foto" onPress={props.onRetake} className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-2xl border-2 border-white bg-black/45" style={props.landscape ? { flex: 0 } : undefined}>
        <RotateCcw size={20} color="white" />
        <Text className="text-[16px] font-bold" style={{ color: 'white' }}>Repetir</Text>
      </Pressable>
      <Pressable testID="btn-usar-foto" onPress={props.onUse} className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-primary" style={props.landscape ? { flex: 0 } : undefined}>
        <Check size={20} color="white" />
        <Text className="text-[16px] font-bold text-on-primary">{props.video ? 'Usar video' : 'Usar foto'}</Text>
      </Pressable>
    </View>
  );
}
