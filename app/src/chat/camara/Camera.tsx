import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Animated, FlatList, Image as NativeImage, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { CameraView, type CameraCapturedPicture } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Image } from 'expo-image';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Image as GalleryIcon, RefreshCcw, X, Zap, ZapOff } from 'lucide-react-native';
import { recordingLabel, VIDEO_BITRATE, type GeoPoint, type Timemark, type TimemarkStampAsked } from '@lilachat/shared';
import { Modal } from '../../ui/Modal';
import { reportarError } from '../../ui/reportarError';
import { useMargenes } from '../../ui/useMargenes';
import { getCurrentSpaceId, useSpaceLogo } from '../../spaces/currentSpace';
import { FLASH_LABEL, NEXT_FLASH, type FlashMode } from './flash';
import { CameraChips } from './CameraChips';
import { StampOverlay } from './StampOverlay';
import { VideoPreview } from './VideoPreview';
import { useCameraLogo } from './cameraLogoPref';
import { useLiveStamp } from './useLiveStamp';
import { useVideoRecording } from './useVideoRecording';
import { ModeSwitch, RECORD_RED, type CameraMode } from './ModeSwitch';
import { useCameraZoom, ZoomChips } from './ZoomControls';

/**
 * THE camera of the APK (José 13/11: «solo un componente cámara, los demás borrarlos»): the chat,
 * every report, form, observation and Drive shot open this one. Photo and video, the live
 * Timemark-like stamp (hour, date, weekday, address and the space's logo by its chip) that the
 * server burns in once, .6x / 1x / 2x and the pinch, flash, and the controls in a right column
 * when the phone is held sideways. What happens after the shot is the caller's: the chat opens
 * «Enviar» on top, a form asks «Repetir» or «Usar foto».
 */
export type TakenMedia = {
  uri: string;
  mime: string;
  fileName: string;
  width?: number;
  height?: number;
  takenAt: string;
  /** A video's length, for a ticket's limit. */
  seconds?: number;
  /** What the server burns in; a photo picked from the gallery has none. */
  stamp?: TimemarkStampAsked;
  /** The stamp as the camera showed it, frozen at the shot (José 13/11). */
  seen?: { stamp: Timemark; logoUrl: string | null };
};

export type CameraProps = {
  testID: string;
  /** The pill at the top: «Para: Planta» in the chat, the report's name in a form. */
  title: string;
  /** FOTO / VIDEO; without it, photo only. */
  video?: { maxSeconds?: number; first?: boolean };
  /** The «Sonido» chip in video (the chat's). */
  soundChip?: boolean;
  /** The strip of recent photos over the shutter (the chat's; only if the gallery is already allowed). */
  recent?: boolean;
  /** The shot behind what `renderTaken` draws (a form reviews it); otherwise black. */
  showShot?: boolean;
  onGallery?: () => void;
  onClose: () => void;
  renderTaken: (taken: TakenMedia, retake: () => void) => ReactNode;
  /** Android's «back» inside what `renderTaken` drew (the crop of «Enviar»): true when it took the step. */
  takenBack?: { current: (() => boolean) | null };
};

const PHOTO_MIME = 'image/jpeg';
const VIDEO_MIME = 'video/mp4';
const MS_PER_SECOND = 1000;
const RECENT = 12;
const THUMB = 56;
const SHUTTER = 76;
const SIDE_BUTTON = 48;
const BLINK_IN_MS = 60;
const BLINK_OUT_MS = 160;
/** Held sideways the controls go to a column on the right (design cam-02). */
const SIDE_COLUMN = 124;
/** The chips sit under the top bar; the logo goes under the chips, not behind them. */
const CHIPS_BELOW = 56;
const CHIP_ROW = 44;
const ZOOM_EDGE = 16;
/** What the bottom panel takes, so the stamp sits above it: the shutter row, FOTO / VIDEO and the recent strip. */
const SHUTTER_ROW = 120;
const MODE_ROW = 52;
const RECENT_ROW = THUMB + 12;

export function Camera(props: CameraProps) {
  const back = useRef<(() => void) | null>(null);
  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => back.current?.()}>
      {/* An Android Modal needs its own gesture root, or the pinch to zoom never arrives. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <CameraBody {...props} backRef={back} />
      </GestureHandlerRootView>
    </Modal>
  );
}

type Frame = { width: number; height: number; bottomInset: number; topInset: number; rightInset: number };

function CameraBody(props: CameraProps & { backRef: { current: (() => void) | null } }) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const margins = useMargenes();
  const camera = useRef<CameraView>(null);
  const zoom = useCameraZoom();
  const [mode, setMode] = useState<CameraMode>(props.video?.first ? 'video' : 'picture');
  const [front, setFront] = useState(false);
  const [flash, setFlash] = useState<FlashMode>('auto');
  const [sound, setSound] = useState(true);
  const recent = useRecent(Boolean(props.recent));
  const look = useStampLook();
  const capture = useCapture(camera, sound, props.video?.maxSeconds, look);
  const { taken } = capture;
  props.backRef.current = () => backStep(props, capture);
  const shownRecent = props.recent && mode === 'picture' ? recent : [];
  const right = landscape ? SIDE_COLUMN : 0;
  const frame: Frame = { width: width - right, height, bottomInset: landscape ? margins.pie : panelHeight(margins.pie, Boolean(props.video), shownRecent.length > 0), topInset: margins.cabecera + CHIPS_BELOW + CHIP_ROW, rightInset: right };
  return (
    <View testID={props.testID} className="flex-1 bg-black">
      <Viewfinder camera={camera} taken={taken} showShot={Boolean(props.showShot)} shooting={capture.shooting} blink={capture.blink} mode={mode} front={front} flash={flash} sound={sound} zoom={zoom} />
      <StampLayer taken={taken} showShot={Boolean(props.showShot)} look={look} frame={frame} />
      <TopBar title={props.title} flash={taken ? null : flash} right={right} recording={capture.recording ? recordingLabel(capture.elapsedMs, props.video?.maxSeconds) : null} onClose={props.onClose} onFlash={() => setFlash((before) => NEXT_FLASH[before])} />
      {taken ? (
        props.renderTaken(taken, capture.retake)
      ) : (
        <>
          <CameraChips logoOn={look.logoOn} logoUrl={look.spaceLogo} precision={look.live.point?.precision ?? null} top={margins.cabecera + CHIPS_BELOW} sound={props.soundChip && mode === 'video' && !capture.recording ? { on: sound, onToggle: () => setSound((before) => !before) } : undefined} />
          <ZoomChips zoom={zoom.zoom} onZoom={zoom.setZoom} right={right + ZOOM_EDGE} />
          <Controls landscape={landscape} mode={mode} onMode={props.video ? setMode : undefined} recent={shownRecent} recording={capture.recording} shooting={capture.shooting} onPick={capture.pick} onShoot={() => void (mode === 'video' ? capture.record() : capture.shoot())} onFlip={() => setFront((before) => !before)} onGallery={props.onGallery} />
        </>
      )}
    </View>
  );
}

/** Android's «back», one step at a time: what the caller drew (the crop), the recording, the shot, and only then the camera. */
function backStep(props: CameraProps, capture: { recording: boolean; stopRecording: () => void; taken: TakenMedia | null; retake: () => void }): void {
  if (props.takenBack?.current?.()) return;
  if (capture.recording) return capture.stopRecording();
  if (capture.taken) return capture.retake();
  props.onClose();
}

/** What the bottom panel takes, so the stamp sits above it. */
const panelHeight = (pie: number, withModes: boolean, withRecent: boolean) => SHUTTER_ROW + pie + (withModes ? MODE_ROW : 0) + (withRecent ? RECENT_ROW : 0);

type ViewfinderProps = { camera: RefObject<CameraView | null>; taken: TakenMedia | null; showShot: boolean; shooting: boolean; blink: Animated.Value; mode: CameraMode; front: boolean; flash: FlashMode; sound: boolean; zoom: ReturnType<typeof useCameraZoom> };

/** The live camera (or the shot to review), black while it captures, and the shutter's white blink. */
function Viewfinder(props: ViewfinderProps) {
  const reviewing = Boolean(props.taken && props.showShot);
  return (
    <>
      {reviewing && props.taken ? <ShotPreview taken={props.taken} /> : (
        <GestureDetector gesture={props.zoom.pinch}>
          <CameraView ref={props.camera} style={{ flex: 1 }} mode={props.mode} facing={props.front ? 'front' : 'back'} flash={props.flash} mute={!props.sound} videoQuality="720p" videoBitrate={VIDEO_BITRATE} active={!props.taken} zoom={props.zoom.native} />
        </GestureDetector>
      )}
      {/* While it captures the preview goes transparent and would show the screen behind it. */}
      {props.shooting || (props.taken && !reviewing) ? <View pointerEvents="none" className="absolute inset-0 bg-black" /> : null}
      <Animated.View pointerEvents="none" className="absolute inset-0 bg-white" style={{ opacity: props.blink }} />
    </>
  );
}

/** The live stamp; over a shot under review, the one frozen at the shot; nothing behind «Enviar» (it draws its own). */
function StampLayer(props: { taken: TakenMedia | null; showShot: boolean; look: StampLook; frame: Frame }) {
  if (!props.taken) return <StampOverlay stamp={props.look.live.stamp} logoUrl={props.look.logoUrl} {...props.frame} />;
  if (!props.showShot || !props.taken.seen) return null;
  return <StampOverlay stamp={props.taken.seen.stamp} logoUrl={props.taken.seen.logoUrl} {...props.frame} />;
}

/** The stamp the camera draws now: its clock and GPS, and the space's logo when its chip is on. */
function useStampLook() {
  const live = useLiveStamp();
  const logoOn = useCameraLogo();
  const spaceLogo = useSpaceLogo(getCurrentSpaceId());
  const logoUrl = logoOn && spaceLogo ? spaceLogo : null;
  return { live, logoOn, spaceLogo, logoUrl };
}
type StampLook = ReturnType<typeof useStampLook>;

const stampAt = (point: GeoPoint | null, logo: boolean, takenAt: string): TimemarkStampAsked => ({ timemark: true, point, logo, takenAt });

/** The photo, the video, or a recent one picked from the strip; and the shutter's blink. */
function useCapture(camera: RefObject<CameraView | null>, sound: boolean, maxSeconds: number | undefined, look: StampLook) {
  const blink = useRef(new Animated.Value(0)).current;
  const [shooting, setShooting] = useState(false);
  const [taken, setTaken] = useState<TakenMedia | null>(null);
  const video = useVideoRecording(camera, sound, maxSeconds);
  const frozen = (takenAt: string) => ({ stamp: stampAt(look.live.point, Boolean(look.logoUrl), takenAt), seen: { stamp: look.live.stamp, logoUrl: look.logoUrl } });
  const shoot = async () => {
    if (shooting || !camera.current) return;
    setShooting(true);
    Animated.sequence([Animated.timing(blink, { toValue: 1, duration: BLINK_IN_MS, useNativeDriver: true }), Animated.timing(blink, { toValue: 0, duration: BLINK_OUT_MS, useNativeDriver: true })]).start();
    const takenAt = new Date().toISOString();
    const stamped = frozen(takenAt);
    try {
      // `quality: 1`: native and whole; the server shrinks it once while it burns the stamp.
      await camera.current.takePictureAsync({ quality: 1, onPictureSaved: (picture: CameraCapturedPicture) => (setTaken({ ...pictureOf(picture, takenAt), ...stamped }), setShooting(false)) });
    } catch (error) {
      reportarError('Camera.shoot', error);
      setShooting(false);
    }
  };
  const record = async () => {
    if (video.recording) return video.stop();
    const recorded = await video.start();
    if (recorded) setTaken({ uri: recorded.uri, mime: VIDEO_MIME, fileName: `video-${Date.now()}.mp4`, takenAt: recorded.startedAt, seconds: Math.round((Date.now() - Date.parse(recorded.startedAt)) / MS_PER_SECOND), ...frozen(recorded.startedAt) });
  };
  const pick = (asset: MediaLibrary.Asset) => setTaken({ uri: asset.uri, mime: PHOTO_MIME, fileName: asset.filename, width: asset.width, height: asset.height, takenAt: new Date(asset.creationTime).toISOString() });
  const retake = () => (setTaken(null), setShooting(false));
  return { blink, shooting, taken, recording: video.recording, elapsedMs: video.elapsedMs, stopRecording: video.stop, shoot, record, pick, retake };
}

const pictureOf = (picture: CameraCapturedPicture, takenAt: string) => ({ uri: picture.uri, mime: PHOTO_MIME, fileName: `foto-${Date.now()}.jpg`, width: picture.width, height: picture.height, takenAt });

/** The shot to review: the photo, or the video playing in a loop (designs cam-03/cam-06). */
function ShotPreview(props: { taken: TakenMedia }) {
  if (props.taken.mime.startsWith('video/')) return <VideoPreview uri={props.taken.uri} fit="cover" />;
  return <NativeImage source={{ uri: props.taken.uri }} style={{ flex: 1 }} resizeMode="cover" />;
}

/** ✕, the title (or the recording clock) and the flash; under the side column's left edge when sideways. */
function TopBar(props: { title: string; flash: FlashMode | null; right: number; recording: string | null; onClose: () => void; onFlash: () => void }) {
  const margins = useMargenes();
  return (
    <View className="absolute left-0 top-0 flex-row items-center gap-3 px-3" style={{ paddingTop: margins.cabecera, right: props.right }}>
      <Pressable testID="btn-cerrar-camara" accessibilityLabel="Cerrar la cámara" onPress={props.onClose} className="h-11 w-11 items-center justify-center rounded-full bg-black/45">
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
      {props.flash === null ? <View className="w-11" /> : (
        <Pressable testID="btn-flash" accessibilityLabel={`Flash: ${FLASH_LABEL[props.flash]}`} onPress={props.onFlash} className="h-11 flex-row items-center gap-1 rounded-full bg-black/45 px-3">
          {props.flash === 'off' ? <ZapOff size={20} color="white" /> : <Zap size={20} color="white" />}
          <Text className="text-[13px] font-semibold" style={{ color: 'white' }}>{FLASH_LABEL[props.flash]}</Text>
        </Pressable>
      )}
    </View>
  );
}

type ControlsProps = { landscape: boolean; mode: CameraMode; onMode?: (mode: CameraMode) => void; recent: MediaLibrary.Asset[]; recording: boolean; shooting: boolean; onPick: (asset: MediaLibrary.Asset) => void; onShoot: () => void; onFlip: () => void; onGallery?: () => void };

/** The recent photos, FOTO / VIDEO and the shutter row (design cam-04); a right column when sideways. */
function Controls(props: ControlsProps) {
  const margins = useMargenes();
  const modes = props.onMode && !props.recording ? <ModeSwitch vertical={props.landscape} mode={props.mode} onMode={props.onMode} /> : null;
  if (props.landscape) {
    return (
      <View testID="columna-de-camara" className="absolute bottom-0 right-0 top-0 items-center justify-center gap-6 bg-black/45" style={{ width: SIDE_COLUMN, paddingBottom: margins.pie }}>
        {modes}
        <ShutterRow vertical {...props} />
      </View>
    );
  }
  return (
    <View className="absolute bottom-0 left-0 right-0 bg-black/45 pt-3" style={{ paddingBottom: margins.pie + 12 }}>
      {props.recent.length && !props.recording ? <RecentStrip recent={props.recent} onPick={props.onPick} /> : null}
      {modes}
      <ShutterRow {...props} />
    </View>
  );
}

function ShutterRow(props: ControlsProps & { vertical?: boolean }) {
  const inner = SHUTTER - 16;
  const label = props.mode === 'video' ? (props.recording ? 'Detener el video' : 'Grabar video') : 'Tomar la foto';
  const spacer = <View style={{ width: SIDE_BUTTON, height: SIDE_BUTTON }} />;
  return (
    <View className={props.vertical ? 'items-center gap-6' : 'flex-row items-center justify-around'}>
      {props.onGallery && !props.recording ? (
        <Pressable testID="btn-galeria-camara" accessibilityLabel="Elegir de la galería" disabled={props.shooting} onPress={props.onGallery} className="items-center justify-center rounded-full bg-white/15" style={{ width: SIDE_BUTTON, height: SIDE_BUTTON }}>
          <GalleryIcon size={22} color="white" />
        </Pressable>
      ) : spacer}
      <Pressable testID="btn-disparar" accessibilityLabel={label} disabled={props.shooting} onPress={props.onShoot} className="items-center justify-center rounded-full border-4 border-white" style={{ width: SHUTTER, height: SHUTTER }}>
        {props.recording ? (
          <View className="rounded-md" style={{ width: inner / 2, height: inner / 2, backgroundColor: RECORD_RED }} />
        ) : (
          <View className={`rounded-full ${props.shooting ? 'opacity-60' : ''}`} style={{ width: inner, height: inner, backgroundColor: props.mode === 'video' ? RECORD_RED : 'white' }} />
        )}
      </Pressable>
      {props.recording ? spacer : (
        <Pressable testID="btn-girar-camara" accessibilityLabel="Girar la cámara" onPress={props.onFlip} className="items-center justify-center rounded-full bg-white/15" style={{ width: SIDE_BUTTON, height: SIDE_BUTTON }}>
          <RefreshCcw size={22} color="white" />
        </Pressable>
      )}
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

/** The latest photos of the gallery, ONLY if it is already allowed (the camera asks for nothing more). */
function useRecent(wanted: boolean): MediaLibrary.Asset[] {
  const [recent, setRecent] = useState<MediaLibrary.Asset[]>([]);
  useEffect(() => {
    if (!wanted) return;
    let alive = true;
    void loadRecent().then((assets) => alive && setRecent(assets));
    return () => {
      alive = false;
    };
  }, [wanted]);
  return recent;
}

async function loadRecent(): Promise<MediaLibrary.Asset[]> {
  try {
    const allowed = await MediaLibrary.getPermissionsAsync(false, ['photo']);
    if (!allowed.granted) return [];
    const page = await MediaLibrary.getAssetsAsync({ first: RECENT, mediaType: MediaLibrary.MediaType.photo, sortBy: [[MediaLibrary.SortBy.creationTime, false]] });
    return page.assets;
  } catch (error) {
    reportarError('Camera.recent', error);
    return [];
  }
}
