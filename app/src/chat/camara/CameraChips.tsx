import { Image, Pressable, Text, View } from 'react-native';
import { Check, ImageOff, Mic, MicOff } from 'lucide-react-native';
import { setCameraLogo } from './cameraLogoPref';

const LOGO_CHIP_SIDE = 18;
const DARK_TEXT = '#111';

type Props = { logoOn: boolean; logoUrl: string | null; precision: number | null; top: number; sound?: { on: boolean; onToggle: () => void } };

/**
 * The chips under the camera's top bar (designs cam-01 and cam-04): «Logo» turns the space's logo
 * on and off in the stamp, «GPS ±6 m» says how good the reading is, and in video «Sonido».
 */
export function CameraChips(props: Props) {
  return (
    <View className="absolute left-0 right-0 flex-row flex-wrap justify-center gap-2 px-3" style={{ top: props.top }}>
      {props.logoUrl ? (
        <Pressable testID="chip-logo" accessibilityRole="switch" accessibilityState={{ checked: props.logoOn }} onPress={() => setCameraLogo(!props.logoOn)} className={`h-9 flex-row items-center gap-1.5 rounded-full px-3 ${props.logoOn ? 'bg-white' : 'border border-white/70 bg-black/45'}`}>
          <Image source={{ uri: props.logoUrl }} style={{ width: LOGO_CHIP_SIDE, height: LOGO_CHIP_SIDE, borderRadius: 4 }} />
          <Text className="text-[14px] font-semibold" style={{ color: props.logoOn ? DARK_TEXT : 'white' }}>Logo</Text>
          {props.logoOn ? <Check size={15} color={DARK_TEXT} /> : null}
        </Pressable>
      ) : (
        // José 13/11: «no he visto la opción de prender o apagar el logo». A chat outside a space, or a
        // space with no logo, said nothing; now the chip says why there is none.
        <View testID="chip-sin-logo" accessibilityLabel="Este chat no tiene logo de espacio" className="h-9 flex-row items-center gap-1.5 rounded-full border border-white/40 bg-black/45 px-3">
          <ImageOff size={15} color="white" />
          <Text className="text-[14px] font-semibold" style={{ color: 'white', opacity: 0.8 }}>Sin logo</Text>
        </View>
      )}
      <View testID="chip-gps" className="h-9 flex-row items-center gap-1.5 rounded-full bg-black/45 px-3">
        <View className={`h-2 w-2 rounded-full ${props.precision === null ? 'bg-white/50' : 'bg-en-linea'}`} />
        <Text className="text-[14px] font-semibold" style={{ color: 'white' }}>{props.precision === null ? 'Buscando GPS…' : `GPS ±${Math.round(props.precision)} m`}</Text>
      </View>
      {props.sound ? (
        <Pressable testID="chip-sonido" accessibilityRole="switch" accessibilityState={{ checked: props.sound.on }} onPress={props.sound.onToggle} className="h-9 flex-row items-center gap-1.5 rounded-full bg-black/45 px-3">
          {props.sound.on ? <Mic size={16} color="white" /> : <MicOff size={16} color="white" />}
          <Text className="text-[14px] font-semibold" style={{ color: 'white' }}>{props.sound.on ? 'Sonido' : 'Sin sonido'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
