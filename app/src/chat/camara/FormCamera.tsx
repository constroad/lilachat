import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Check, RotateCcw } from 'lucide-react-native';
import type { TimemarkStampAsked } from '@lilachat/shared';
import { reportarError } from '../../ui/reportarError';
import { useMargenes } from '../../ui/useMargenes';
import { Camera, type TakenMedia } from './Camera';

export type CameraShot = { uri: string; mime: string; /** A video's length, for the ticket's limit. */ seconds?: number };

export const CAMERA_DENIED = 'Permite la cámara para tomar la foto.';
/** The review buttons' column when the phone is held sideways. */
const REVIEW_COLUMN = 164;

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
 * The APK's one camera (`Camera`) for every report, form, observation and Drive shot (José 12/11,
 * designs cam-01…cam-06): the shot is reviewed with its stamp, then «Repetir» or «Usar foto».
 */
export function FormCamera(props: Props) {
  const use = (taken: TakenMedia) => props.onShot({ uri: taken.uri, mime: taken.mime, ...(taken.seconds === undefined ? {} : { seconds: taken.seconds }) }, taken.stamp ?? { timemark: true, point: null, logo: false, takenAt: taken.takenAt });
  return (
    <Camera
      testID="camara-formulario"
      title={props.title}
      showShot
      {...(props.video ? { video: props.video } : {})}
      {...(props.onGallery ? { onGallery: props.onGallery } : {})}
      onClose={props.onClose}
      renderTaken={(taken, retake) => <ReviewBar video={taken.mime.startsWith('video/')} onRetake={retake} onUse={() => use(taken)} />}
    />
  );
}

/** Designs cam-03/cam-06: the shot with its stamp, then «Repetir» or «Usar foto» / «Usar video». */
function ReviewBar(props: { video: boolean; onRetake: () => void; onUse: () => void }) {
  const margins = useMargenes();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  return (
    <View className={landscape ? 'absolute bottom-0 right-0 top-0 justify-center gap-3 px-3' : 'absolute bottom-0 left-0 right-0 flex-row gap-3 px-4 pt-3'} style={landscape ? { width: REVIEW_COLUMN } : { paddingBottom: margins.pie + 12 }}>
      <Pressable testID="btn-repetir-foto" onPress={props.onRetake} className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-2xl border-2 border-white bg-black/45" style={landscape ? { flex: 0 } : undefined}>
        <RotateCcw size={20} color="white" />
        <Text className="text-[16px] font-bold" style={{ color: 'white' }}>Repetir</Text>
      </Pressable>
      <Pressable testID="btn-usar-foto" onPress={props.onUse} className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-primary" style={landscape ? { flex: 0 } : undefined}>
        <Check size={20} color="white" />
        <Text className="text-[16px] font-bold text-on-primary">{props.video ? 'Usar video' : 'Usar foto'}</Text>
      </Pressable>
    </View>
  );
}
