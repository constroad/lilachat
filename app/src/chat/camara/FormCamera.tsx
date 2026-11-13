import { useRef, useState } from 'react';
import { Animated, Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { CameraView, type CameraCapturedPicture } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Check, Image as ImageIcon, RefreshCw, RotateCcw, X, Zap, ZapOff } from 'lucide-react-native';
import type { TimemarkStampAsked, Timemark } from '@lilachat/shared';
import { Modal } from '../../ui/Modal';
import { reportarError } from '../../ui/reportarError';
import { useMargenes } from '../../ui/useMargenes';
import { getCurrentSpaceId, useSpaceLogo } from '../../spaces/currentSpace';
import { FLASH_LABEL, NEXT_FLASH, type FlashMode } from './flash';
import { StampOverlay } from './StampOverlay';
import { setCameraLogo, useCameraLogo } from './cameraLogoPref';
import { useLiveStamp } from './useLiveStamp';

export type CameraShot = { uri: string; mime: string };

export const CAMERA_DENIED = 'Permite la cámara para tomar la foto.';
/** Native and untouched: `uploadFormPhoto` makes it lighter once (Portal's standard, 28/10). */
const PHOTO_QUALITY = 1;
const PHOTO_MIME = 'image/jpeg';
const SHUTTER = 76;
const SIDE_BUTTON = 48;
const BLINK_IN_MS = 60;
const BLINK_OUT_MS = 140;
/** Where the controls sit, so the stamp stays above them. */
const BOTTOM_BAR = 120;
const SIDE_BAR = 110;

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

type Props = { title: string; onShot: (shot: CameraShot, stamp: TimemarkStampAsked) => void; onClose: () => void; onGallery?: () => void };

/**
 * The full-screen camera of every report and form photo (José 12/11, designs cam-01/02/03): the
 * Timemark-like stamp live (hour, date, weekday, address and GPS, never the person's name), the
 * «Logo» chip that puts the space's logo in it, and the photo reviewed before it is used. Held
 * sideways, the controls go to a column on the right and the stamp to the bottom left of that frame.
 * The server burns the same stamp with its own hour.
 */
export function FormCamera(props: Props) {
  const camera = useRef<CameraView>(null);
  const blink = useRef(new Animated.Value(0)).current;
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const [flash, setFlash] = useState<FlashMode>('auto');
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [shooting, setShooting] = useState(false);
  const [shot, setShot] = useState<CameraShot | null>(null);
  const live = useLiveStamp();
  const logoOn = useCameraLogo();
  const spaceLogo = useSpaceLogo(getCurrentSpaceId());
  const logoUrl = logoOn ? spaceLogo : null;
  const shoot = async () => {
    if (shooting || !camera.current) return;
    setShooting(true);
    Animated.sequence([Animated.timing(blink, { toValue: 1, duration: BLINK_IN_MS, useNativeDriver: true }), Animated.timing(blink, { toValue: 0, duration: BLINK_OUT_MS, useNativeDriver: true })]).start();
    try {
      await camera.current.takePictureAsync({ quality: PHOTO_QUALITY, onPictureSaved: (picture: CameraCapturedPicture) => (setShot({ uri: picture.uri, mime: PHOTO_MIME }), setShooting(false)) });
    } catch (error) {
      reportarError('FormCamera.shoot', error);
      setShooting(false);
    }
  };
  const use = () => shot && props.onShot(shot, { timemark: true, point: live.point, logo: Boolean(logoUrl) });
  const inset = landscape ? 0 : BOTTOM_BAR;
  return (
    <Modal visible animationType="fade" onRequestClose={shot ? () => setShot(null) : props.onClose}>
      <View testID="camara-formulario" className="flex-1 bg-black">
        {shot ? <Image source={{ uri: shot.uri }} style={{ flex: 1 }} resizeMode="cover" /> : <CameraView ref={camera} style={{ flex: 1 }} facing={facing} flash={flash} />}
        {/* While it captures the preview goes transparent and would show the form behind it. */}
        {shooting ? <View pointerEvents="none" className="absolute inset-0 bg-black" /> : null}
        <Animated.View pointerEvents="none" className="absolute inset-0 bg-white" style={{ opacity: blink }} />
        <StampOverlay stamp={live.stamp} logoUrl={logoUrl} width={width} height={height} bottomInset={inset} />
        <TopBar title={props.title} flash={flash} reviewing={Boolean(shot)} landscape={landscape} onClose={props.onClose} onFlash={() => setFlash((before) => NEXT_FLASH[before])} />
        {shot ? null : <Chips logoOn={logoOn} hasLogo={Boolean(spaceLogo)} logoUrl={spaceLogo} stamp={live.stamp} precision={live.point?.precision ?? null} />}
        {shot ? (
          <ReviewBar landscape={landscape} onRetake={() => setShot(null)} onUse={use} />
        ) : (
          <ShutterBar landscape={landscape} shooting={shooting} onShoot={() => void shoot()} onFlip={() => setFacing((before) => (before === 'back' ? 'front' : 'back'))} onGallery={props.onGallery} />
        )}
      </View>
    </Modal>
  );
}

function TopBar(props: { title: string; flash: FlashMode; reviewing: boolean; landscape: boolean; onClose: () => void; onFlash: () => void }) {
  const margins = useMargenes();
  return (
    <View className="absolute left-0 top-0 flex-row items-center gap-3 px-3" style={{ paddingTop: margins.cabecera, right: props.landscape ? SIDE_BAR : 0 }}>
      <Pressable testID="btn-cerrar-camara-formulario" accessibilityLabel="Cerrar la cámara" onPress={props.onClose} className="h-11 w-11 items-center justify-center rounded-full bg-black/45">
        <X size={24} color="white" />
      </Pressable>
      {/* Audit 12/11: white on a bright frame (the sun on site) vanished; it sits on its own dark pill. */}
      <View className="min-w-0 flex-1 items-center">
        <Text className="max-w-full rounded-full bg-black/55 px-3 py-1.5 text-center text-[15px] font-semibold" style={{ color: 'white' }} numberOfLines={1}>{props.title}</Text>
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

/** «Logo» turns the space's logo on and off in the stamp; «GPS ±6 m» says how good the reading is. */
function Chips(props: { logoOn: boolean; hasLogo: boolean; logoUrl: string | null; stamp: Timemark; precision: number | null }) {
  const margins = useMargenes();
  return (
    <View className="absolute left-0 right-0 flex-row justify-center gap-2" style={{ top: margins.cabecera + 56 }}>
      {props.hasLogo ? (
        <Pressable testID="chip-logo" accessibilityRole="switch" accessibilityState={{ checked: props.logoOn }} onPress={() => setCameraLogo(!props.logoOn)} className={`h-9 flex-row items-center gap-1.5 rounded-full px-3 ${props.logoOn ? 'bg-white' : 'border border-white/70 bg-black/45'}`}>
          {props.logoUrl ? <Image source={{ uri: props.logoUrl }} style={{ width: 18, height: 18, borderRadius: 4 }} /> : null}
          <Text className="text-[14px] font-semibold" style={{ color: props.logoOn ? '#111' : 'white' }}>Logo</Text>
          {props.logoOn ? <Check size={15} color="#111" /> : null}
        </Pressable>
      ) : null}
      <View testID="chip-gps" className="h-9 flex-row items-center gap-1.5 rounded-full bg-black/45 px-3">
        <View className={`h-2 w-2 rounded-full ${props.precision === null ? 'bg-white/50' : 'bg-en-linea'}`} />
        <Text className="text-[14px] font-semibold" style={{ color: 'white' }}>{props.precision === null ? 'Buscando GPS…' : `GPS ±${Math.round(props.precision)} m`}</Text>
      </View>
    </View>
  );
}

function ShutterBar(props: { landscape: boolean; shooting: boolean; onShoot: () => void; onFlip: () => void; onGallery?: () => void }) {
  const margins = useMargenes();
  const along = props.landscape ? 'absolute bottom-0 right-0 top-0 items-center justify-around py-6' : 'absolute bottom-0 left-0 right-0 flex-row items-center justify-around pt-4';
  return (
    <View className={along} style={props.landscape ? { width: SIDE_BAR, paddingRight: margins.pie } : { paddingBottom: margins.pie + 12 }}>
      {props.onGallery ? (
        <Pressable testID="btn-galeria-formulario" accessibilityLabel="Elegir de la galería" disabled={props.shooting} onPress={props.onGallery} className="items-center justify-center rounded-xl bg-white/15" style={{ width: SIDE_BUTTON, height: SIDE_BUTTON }}>
          <ImageIcon size={22} color="white" />
        </Pressable>
      ) : <View style={{ width: SIDE_BUTTON, height: SIDE_BUTTON }} />}
      <Pressable testID="btn-disparar-formulario" accessibilityLabel="Tomar la foto" disabled={props.shooting} onPress={props.onShoot} className="items-center justify-center rounded-full border-4 border-white" style={{ width: SHUTTER, height: SHUTTER }}>
        <View className={`rounded-full bg-white ${props.shooting ? 'opacity-60' : ''}`} style={{ width: SHUTTER - 16, height: SHUTTER - 16 }} />
      </Pressable>
      <Pressable testID="btn-girar-camara" accessibilityLabel="Cambiar de cámara" onPress={props.onFlip} className="items-center justify-center rounded-full bg-black/45" style={{ width: SIDE_BUTTON, height: SIDE_BUTTON }}>
        <RefreshCw size={22} color="white" />
      </Pressable>
    </View>
  );
}

/** Design cam-03: the photo with its stamp, then «Repetir» or «Usar foto». */
function ReviewBar(props: { landscape: boolean; onRetake: () => void; onUse: () => void }) {
  const margins = useMargenes();
  return (
    <View className={props.landscape ? 'absolute bottom-0 right-0 top-0 justify-center gap-3 px-3' : 'absolute bottom-0 left-0 right-0 flex-row gap-3 px-4 pt-3'} style={props.landscape ? { width: SIDE_BAR + 40 } : { paddingBottom: margins.pie + 12 }}>
      <Pressable testID="btn-repetir-foto" onPress={props.onRetake} className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-2xl border-2 border-white bg-black/45" style={props.landscape ? { flex: 0 } : undefined}>
        <RotateCcw size={20} color="white" />
        <Text className="text-[16px] font-bold" style={{ color: 'white' }}>Repetir</Text>
      </Pressable>
      <Pressable testID="btn-usar-foto" onPress={props.onUse} className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-primary" style={props.landscape ? { flex: 0 } : undefined}>
        <Check size={20} color="white" />
        <Text className="text-[16px] font-bold text-on-primary">Usar foto</Text>
      </Pressable>
    </View>
  );
}
