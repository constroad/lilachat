import { useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { CameraView, type CameraCapturedPicture } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Image } from 'expo-image';
import { Image as GalleryIcon, RefreshCcw, X, Zap, ZapOff } from 'lucide-react-native';
import type { GeoPoint, TimemarkStampAsked } from '@lilachat/shared';
import { Modal } from '../../ui/Modal';
import { useMargenes } from '../../ui/useMargenes';
import { reportarError } from '../../ui/reportarError';
import { getCurrentSpaceId, useSpaceLogo } from '../../spaces/currentSpace';
import type { FotoAEnviar, FotoElegida } from '../envioDeFotos';
import { EnviarFotos } from '../EnviarFotos';
import { FLASH_LABEL, NEXT_FLASH, type FlashMode } from './flash';
import { CameraChips } from './CameraChips';
import { StampOverlay } from './StampOverlay';
import { useCameraLogo } from './cameraLogoPref';
import { useLiveStamp } from './useLiveStamp';
import { useVideoRecording, type RecordedVideo } from './useVideoRecording';
import { recordingLabel, VIDEO_BITRATE } from './videoClock';

/** How many recent photos the strip shows (only if the gallery is already allowed). */
const RECENT = 12;
const THUMB = 56;
const SHUTTER = 76;
const SIDE_BUTTON = 48;
const BLINK_IN_MS = 60;
const BLINK_OUT_MS = 180;
/** The chips sit under the top bar; the stamp sits above the bottom panel. */
const CHIPS_BELOW = 92;
const BOTTOM_PANEL = 200;
const RECORD_RED = '#dc2626';
type Mode = 'picture' | 'video';

type Props = { visible: boolean; nombreDelChat: string; onEnviar: (fotos: FotoAEnviar[], opciones: { hd: boolean }) => void; onGaleria: () => void; onCerrar: () => void };

/**
 * The chat's own camera (José 20/10, design `f2-app-camara`; José 12/11, designs cam-04/cam-05):
 * photo and video, with the live Timemark-like stamp (hour, date, address and the space's logo by
 * its chip) that the server burns into what is sent. «Enviar» opens on top of this same screen
 * (two modals do not stack well on Android). The body mounts only while it is open: the GPS and the
 * clock of the stamp do not run behind a closed chat.
 */
export function ChatCamera(props: Props) {
  const back = useRef<(() => boolean) | null>(null);
  return (
    <Modal visible={props.visible} animationType="fade" onRequestClose={() => (back.current?.() ? undefined : props.onCerrar())} statusBarTranslucent>
      {props.visible ? <ChatCameraBody {...props} backRef={back} /> : null}
    </Modal>
  );
}

const stampOf = (point: GeoPoint | null, logo: boolean, takenAt: string): TimemarkStampAsked => ({ timemark: true, point, logo, takenAt });

function ChatCameraBody(props: Props & { backRef: { current: (() => boolean) | null } }) {
  const margins = useMargenes();
  const { width, height } = useWindowDimensions();
  const camera = useRef<CameraView>(null);
  const blink = useRef(new Animated.Value(0)).current;
  const [mode, setMode] = useState<Mode>('picture');
  const [front, setFront] = useState(false);
  const [flash, setFlash] = useState<FlashMode>('auto');
  const [sound, setSound] = useState(true);
  const [shooting, setShooting] = useState(false);
  const [recent, setRecent] = useState<MediaLibrary.Asset[]>([]);
  /** What was just taken: «Enviar» opens ON TOP, in this same screen. */
  const [taken, setTaken] = useState<FotoElegida | null>(null);
  /** While the photo is being cropped, «back» closes the crop (01/11). */
  const sendScreenBack = useRef<(() => void) | null>(null);
  const live = useLiveStamp();
  const logoOn = useCameraLogo();
  const spaceLogo = useSpaceLogo(getCurrentSpaceId());
  const video = useVideoRecording(camera, sound);
  const withLogo = Boolean(logoOn && spaceLogo);

  useEffect(() => {
    void loadRecent().then(setRecent);
  }, []);
  props.backRef.current = () => backStep({ sendScreenBack: sendScreenBack.current, recording: video.recording, stop: video.stop, taken: Boolean(taken), retake: () => (setTaken(null), setShooting(false)) });

  const shoot = async () => {
    if (shooting || !camera.current) return;
    setShooting(true);
    Animated.sequence([Animated.timing(blink, { toValue: 1, duration: BLINK_IN_MS, useNativeDriver: true }), Animated.timing(blink, { toValue: 0, duration: BLINK_OUT_MS, useNativeDriver: true })]).start();
    const takenAt = new Date().toISOString();
    try {
      // `quality: 1`: native and whole; the server shrinks it once while it burns the stamp.
      await camera.current.takePictureAsync({ quality: 1, onPictureSaved: (picture: CameraCapturedPicture) => setTaken({ ...pictureOf(picture), stamp: stampOf(live.point, withLogo, takenAt) }) });
    } catch (error) {
      reportarError('CamaraDelChat.shoot', error);
      setShooting(false);
    }
  };
  const record = async () => {
    if (video.recording) return video.stop();
    const recorded = await video.start();
    if (recorded) setTaken(videoOf(recorded, stampOf(live.point, withLogo, recorded.startedAt)));
  };

  return (
    <View testID="camara-del-chat" className="flex-1 bg-black">
      <CameraView ref={camera} style={{ flex: 1 }} mode={mode} facing={front ? 'front' : 'back'} flash={flash} mute={!sound} videoQuality="720p" videoBitrate={VIDEO_BITRATE} active={!taken} />
      {/* While it captures, the preview goes transparent (the chat shows behind): black until «Enviar». */}
      {shooting || taken ? <View pointerEvents="none" className="absolute inset-0 bg-black" /> : null}
      <Animated.View pointerEvents="none" className="absolute inset-0 bg-white" style={{ opacity: blink }} />
      {taken ? null : <StampOverlay stamp={live.stamp} logoUrl={withLogo ? spaceLogo : null} width={width} height={height} bottomInset={BOTTOM_PANEL + margins.pie} />}
      <ChatCameraTop name={props.nombreDelChat} flash={flash} recordingMs={video.recording ? video.elapsedMs : null} onClose={props.onCerrar} onFlash={() => setFlash((before) => NEXT_FLASH[before])} />
      {taken ? null : <CameraChips logoOn={logoOn} logoUrl={spaceLogo} precision={live.point?.precision ?? null} top={margins.cabecera + CHIPS_BELOW} sound={mode === 'video' && !video.recording ? { on: sound, onToggle: () => setSound((before) => !before) } : undefined} />}
      <BottomPanel mode={mode} recent={recent} recording={video.recording} shooting={shooting} onMode={setMode} onPick={(asset) => setTaken(assetOf(asset))} onShoot={() => void (mode === 'video' ? record() : shoot())} onFlip={() => setFront((before) => !before)} onGallery={props.onGaleria} />
      <EnviarFotos
        embebido
        backRef={sendScreenBack}
        fotos={taken ? [taken] : []}
        onCancelar={() => {
          setTaken(null);
          setShooting(false);
        }}
        onEnviar={(fotos, opciones) => {
          props.onEnviar(fotos, opciones);
          props.onCerrar();
        }}
      />
    </View>
  );
}

/** Android's «back», one step at a time: the crop, the recording, the shot, and only then the camera. */
function backStep(state: { sendScreenBack: (() => void) | null; recording: boolean; stop: () => void; taken: boolean; retake: () => void }): boolean {
  if (state.sendScreenBack) return (state.sendScreenBack(), true);
  if (state.recording) return (state.stop(), true);
  if (state.taken) return (state.retake(), true);
  return false;
}

type BottomProps = { mode: Mode; recent: MediaLibrary.Asset[]; recording: boolean; shooting: boolean; onMode: (mode: Mode) => void; onPick: (asset: MediaLibrary.Asset) => void; onShoot: () => void; onFlip: () => void; onGallery: () => void };

/** The recent photos (in photo mode), FOTO / VIDEO and the shutter row (design cam-04). */
function BottomPanel(props: BottomProps) {
  const margins = useMargenes();
  return (
    <View className="absolute bottom-0 left-0 right-0 bg-black/45 pt-3" style={{ paddingBottom: margins.pie + 12 }}>
      {props.mode === 'picture' && props.recent.length ? <RecentStrip recent={props.recent} onPick={props.onPick} /> : null}
      {props.recording ? null : <ModeSwitch mode={props.mode} onMode={props.onMode} />}
      <ShutterRow mode={props.mode} recording={props.recording} shooting={props.shooting} onShoot={props.onShoot} onFlip={props.onFlip} onGallery={props.onGallery} />
    </View>
  );
}

const assetOf = (asset: MediaLibrary.Asset): FotoElegida => ({ uri: asset.uri, fileName: asset.filename, mimeType: 'image/jpeg', width: asset.width, height: asset.height });

function ChatCameraTop(props: { name: string; flash: FlashMode; recordingMs: number | null; onClose: () => void; onFlash: () => void }) {
  const margins = useMargenes();
  return (
    <View className="absolute left-0 right-0 top-0 items-center" style={{ paddingTop: margins.cabecera }}>
      <View className="w-full flex-row items-center justify-between gap-3 px-3">
        <Pressable testID="btn-cerrar-camara" accessibilityLabel="Cerrar la cámara" onPress={props.onClose} className="h-11 w-11 items-center justify-center rounded-full bg-black/45">
          <X size={24} color="white" />
        </Pressable>
        {props.recordingMs === null ? (
          <Text className="min-w-0 flex-1 rounded-full bg-black/55 px-3 py-1.5 text-center text-[14px] font-semibold" style={{ color: 'white' }} numberOfLines={1}>{`Para: ${props.name}`}</Text>
        ) : (
          <View testID="reloj-de-video" className="flex-row items-center gap-2 rounded-full border border-red-500 bg-black/60 px-3 py-1.5">
            <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RECORD_RED }} />
            <Text className="text-[15px] font-bold" style={{ color: 'white', fontVariant: ['tabular-nums'] }}>{recordingLabel(props.recordingMs)}</Text>
          </View>
        )}
        <Pressable testID="btn-flash" accessibilityLabel={`Flash: ${FLASH_LABEL[props.flash]}`} onPress={props.onFlash} className="h-11 flex-row items-center gap-1.5 rounded-full bg-black/45 px-3">
          {props.flash === 'off' ? <ZapOff size={20} color="white" /> : <Zap size={20} color="white" />}
          <Text className="text-[13px] font-semibold" style={{ color: 'white' }}>{FLASH_LABEL[props.flash]}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RecentStrip(props: { recent: MediaLibrary.Asset[]; onPick: (asset: MediaLibrary.Asset) => void }) {
  return (
    <FlatList
      horizontal
      data={props.recent}
      keyExtractor={(asset) => asset.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}
      renderItem={({ item }) => (
        <Pressable testID={`reciente-${item.id}`} onPress={() => props.onPick(item)}>
          <Image source={{ uri: item.uri }} style={{ width: THUMB, height: THUMB, borderRadius: 10 }} contentFit="cover" />
        </Pressable>
      )}
    />
  );
}

/** FOTO / VIDEO under the stamp (design cam-04). */
function ModeSwitch(props: { mode: Mode; onMode: (mode: Mode) => void }) {
  const option = (mode: Mode, label: string) => (
    <Pressable testID={`modo-${mode}`} accessibilityRole="tab" accessibilityState={{ selected: props.mode === mode }} onPress={() => props.onMode(mode)} className="items-center px-4 py-1">
      <Text className="text-[15px] font-bold tracking-widest" style={{ color: 'white', opacity: props.mode === mode ? 1 : 0.55 }}>{label}</Text>
      <View className="mt-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: props.mode === mode ? (mode === 'video' ? RECORD_RED : 'white') : 'transparent' }} />
    </Pressable>
  );
  return (
    <View className="mb-2 flex-row justify-center gap-4">
      {option('picture', 'FOTO')}
      {option('video', 'VIDEO')}
    </View>
  );
}

function ShutterRow(props: { mode: Mode; recording: boolean; shooting: boolean; onShoot: () => void; onFlip: () => void; onGallery: () => void }) {
  const inner = SHUTTER - 16;
  return (
    <View className="flex-row items-center justify-around">
      {props.recording ? <View style={{ width: SIDE_BUTTON }} /> : (
        <Pressable testID="btn-galeria-camara" accessibilityLabel="Elegir de la galería" onPress={props.onGallery} className="items-center justify-center rounded-full bg-white/15" style={{ width: SIDE_BUTTON, height: SIDE_BUTTON }}>
          <GalleryIcon size={22} color="white" />
        </Pressable>
      )}
      <Pressable testID="btn-disparar" accessibilityLabel={props.mode === 'video' ? (props.recording ? 'Detener el video' : 'Grabar video') : 'Tomar la foto'} disabled={props.shooting} onPress={props.onShoot} className="items-center justify-center rounded-full border-4 border-white" style={{ width: SHUTTER, height: SHUTTER }}>
        {props.recording ? (
          <View className="rounded-md" style={{ width: inner / 2, height: inner / 2, backgroundColor: RECORD_RED }} />
        ) : (
          <View className={`rounded-full ${props.shooting ? 'opacity-60' : ''}`} style={{ width: inner, height: inner, backgroundColor: props.mode === 'video' ? RECORD_RED : 'white' }} />
        )}
      </Pressable>
      {props.recording ? <View style={{ width: SIDE_BUTTON }} /> : (
        <Pressable testID="btn-girar-camara" accessibilityLabel="Girar la cámara" onPress={props.onFlip} className="items-center justify-center rounded-full bg-white/15" style={{ width: SIDE_BUTTON, height: SIDE_BUTTON }}>
          <RefreshCcw size={22} color="white" />
        </Pressable>
      )}
    </View>
  );
}

function pictureOf(picture: CameraCapturedPicture): FotoElegida {
  return { uri: picture.uri, fileName: `foto-${Date.now()}.jpg`, mimeType: 'image/jpeg', width: picture.width, height: picture.height };
}

function videoOf(recorded: RecordedVideo, stamp: TimemarkStampAsked): FotoElegida {
  return { uri: recorded.uri, fileName: `video-${Date.now()}.mp4`, mimeType: 'video/mp4', stamp };
}

/** The latest photos of the gallery, ONLY if it is already allowed (the camera asks for nothing more). */
async function loadRecent(): Promise<MediaLibrary.Asset[]> {
  try {
    const allowed = await MediaLibrary.getPermissionsAsync(false, ['photo']);
    if (!allowed.granted) return [];
    const page = await MediaLibrary.getAssetsAsync({ first: RECENT, mediaType: MediaLibrary.MediaType.photo, sortBy: [[MediaLibrary.SortBy.creationTime, false]] });
    return page.assets;
  } catch (error) {
    reportarError('CamaraDelChat.recent', error);
    return [];
  }
}
