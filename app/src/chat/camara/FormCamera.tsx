import { useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { CameraView, type CameraCapturedPicture } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { X, Zap, ZapOff } from 'lucide-react-native';
import { Modal } from '../../ui/Modal';
import { reportarError } from '../../ui/reportarError';
import { useMargenes } from '../../ui/useMargenes';
import { FLASH_LABEL, NEXT_FLASH, type FlashMode } from './flash';

export type CameraShot = { uri: string; mime: string };

export const CAMERA_DENIED = 'Permite la cámara para tomar la foto.';
/** Native and untouched: `uploadFormPhoto` makes it lighter once (Portal's standard, 28/10). */
const PHOTO_QUALITY = 1;
const PHOTO_MIME = 'image/jpeg';
const SHUTTER = 76;
const BLINK_IN_MS = 60;
const BLINK_OUT_MS = 140;

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

/**
 * The camera of a form's photo (José 06/11: seconds went by between the camera
 * and the photo showing up in the app). The phone's own camera had to start, show
 * the shot and wait for its confirmation. This one is ready when it opens and hands
 * the photo over at the shutter, like `CamaraDelChat` did for the chat on 20/10.
 */
export function FormCamera(props: { title: string; onShot: (shot: CameraShot) => void; onClose: () => void }) {
  const margins = useMargenes();
  const camera = useRef<CameraView>(null);
  const blink = useRef(new Animated.Value(0)).current;
  const [flash, setFlash] = useState<FlashMode>('auto');
  const [shooting, setShooting] = useState(false);
  const shoot = async () => {
    if (shooting || !camera.current) return;
    setShooting(true);
    Animated.sequence([Animated.timing(blink, { toValue: 1, duration: BLINK_IN_MS, useNativeDriver: true }), Animated.timing(blink, { toValue: 0, duration: BLINK_OUT_MS, useNativeDriver: true })]).start();
    try {
      await camera.current.takePictureAsync({ quality: PHOTO_QUALITY, onPictureSaved: (picture: CameraCapturedPicture) => props.onShot({ uri: picture.uri, mime: PHOTO_MIME }) });
    } catch (error) {
      reportarError('FormCamera.shoot', error);
      setShooting(false);
    }
  };
  return (
    <Modal visible animationType="fade" onRequestClose={props.onClose}>
      <View testID="camara-formulario" className="flex-1 bg-black">
        <CameraView ref={camera} style={{ flex: 1 }} facing="back" flash={flash} />
        {/* While it captures the preview goes transparent and would show the form behind it. */}
        {shooting ? <View pointerEvents="none" className="absolute inset-0 bg-black" /> : null}
        <Animated.View pointerEvents="none" className="absolute inset-0 bg-white" style={{ opacity: blink }} />
        <View className="absolute left-0 right-0 top-0 flex-row items-center justify-between gap-3 px-3" style={{ paddingTop: margins.cabecera }}>
          <Pressable testID="btn-cerrar-camara-formulario" accessibilityLabel="Cerrar la cámara" onPress={props.onClose} className="h-11 w-11 items-center justify-center rounded-full bg-black/40">
            <X size={24} color="white" />
          </Pressable>
          <Text className="min-w-0 flex-1 text-center text-[15px] font-semibold" style={{ color: 'white' }} numberOfLines={1}>{props.title}</Text>
          <Pressable testID="btn-flash-formulario" accessibilityLabel={`Flash: ${FLASH_LABEL[flash]}`} onPress={() => setFlash((before) => NEXT_FLASH[before])} className="h-11 flex-row items-center gap-1 rounded-full bg-black/40 px-3">
            {flash === 'off' ? <ZapOff size={20} color="white" /> : <Zap size={20} color="white" />}
            <Text className="text-[13px] font-semibold" style={{ color: 'white' }}>{FLASH_LABEL[flash]}</Text>
          </Pressable>
        </View>
        <View className="absolute bottom-0 left-0 right-0 items-center bg-black/55 pt-4" style={{ paddingBottom: margins.pie + 12 }}>
          <Pressable testID="btn-disparar-formulario" accessibilityLabel="Tomar la foto" disabled={shooting} onPress={() => void shoot()} className="items-center justify-center rounded-full border-4 border-white" style={{ width: SHUTTER, height: SHUTTER }}>
            <View className={`rounded-full bg-white ${shooting ? 'opacity-60' : ''}`} style={{ width: SHUTTER - 16, height: SHUTTER - 16 }} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
