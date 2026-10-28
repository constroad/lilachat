import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Ellipse } from 'react-native-svg';
import { Clock, MapPin } from 'lucide-react-native';
import { precisionLabel, type GeoPoint } from '@lilachat/shared';

/** The box stands like a selfie (height over width), and never taller than this. */
const ASPECT = 4 / 3;
const MAX_HEIGHT = 380;
const CLOCK_TICK_MS = 15_000;
/** Native and untouched: `uploadFormPhoto` makes it lighter once (Portal's standard, 28/10). */
const PHOTO_QUALITY = 1;
const COORD_DECIMALS = 5;
const STAMP_FOREGROUND = '#ffffff';

export type LiveSelfieHandle = { capture: () => Promise<{ uri: string; mime: string } | null> };

/** «vie 24/10/2026 · 07:12», as the server will burn it (its own clock decides the real one). */
function stampDateLine(now: Date): string {
  const two = (value: number) => String(value).padStart(2, '0');
  const weekday = now.toLocaleDateString('es-PE', { weekday: 'short' }).replace('.', '');
  return `${weekday} ${two(now.getDate())}/${two(now.getMonth() + 1)}/${now.getFullYear()} · ${two(now.getHours())}:${two(now.getMinutes())}`;
}

/**
 * The selfie of a signing (pending 94, design e-32): the front camera live
 * inside the form, the face guide, the GPS precision and the two lines the
 * server will burn into it. The form's button takes the photo (`capture`):
 * there is no gallery and no photo taken before.
 */
export const LiveSelfie = forwardRef<LiveSelfieHandle, { label: string; width: number; location: GeoPoint | null; error?: string; testID?: string }>(function LiveSelfie(props, ref) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);
  useImperativeHandle(ref, () => ({
    capture: async () => {
      const shot = await camera.current?.takePictureAsync({ quality: PHOTO_QUALITY }).catch(() => undefined);
      return shot?.uri ? { uri: shot.uri, mime: 'image/jpeg' } : null;
    },
  }), []);
  const height = Math.min(MAX_HEIGHT, Math.round(props.width * ASPECT));
  const place = props.location ? `${props.location.lat.toFixed(COORD_DECIMALS)}, ${props.location.lng.toFixed(COORD_DECIMALS)} · ${precisionLabel(props.location)}` : 'Buscando tu ubicación…';
  return (
    <View testID={props.testID}>
      <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{props.label}</Text>
      <View className="overflow-hidden rounded-2xl bg-black" style={{ width: props.width, height }}>
        {permission?.granted ? (
          <CameraView ref={camera} style={{ flex: 1 }} facing="front" />
        ) : (
          <View className="flex-1 items-center justify-center gap-3 px-6">
            <Text className="text-center text-[15px]" style={{ color: STAMP_FOREGROUND }}>Para marcar, la cámara tiene que estar prendida.</Text>
            <Pressable onPress={() => void (permission?.canAskAgain === false ? Linking.openSettings() : requestPermission())} className="h-11 justify-center rounded-full bg-primary px-5">
              <Text className="text-[14px] font-semibold text-on-primary">{permission?.canAskAgain === false ? 'Abrir ajustes' : 'Permitir la cámara'}</Text>
            </Pressable>
          </View>
        )}
        {permission?.granted ? (
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <Svg width={props.width * 0.55} height={height * 0.62}>
              <Ellipse cx={(props.width * 0.55) / 2} cy={(height * 0.62) / 2} rx={(props.width * 0.55) / 2 - 2} ry={(height * 0.62) / 2 - 2} stroke={STAMP_FOREGROUND} strokeWidth={2} strokeDasharray="7 6" fill="none" />
            </Svg>
            <View className="absolute rounded-full bg-black/60 px-3 py-1" style={{ bottom: height * 0.27 }}>
              <Text className="text-[13px]" style={{ color: STAMP_FOREGROUND }}>Mira a la cámara</Text>
            </View>
          </View>
        ) : null}
        {props.location ? (
          <View pointerEvents="none" className="absolute right-3 top-3 flex-row items-center gap-1.5 rounded-full bg-en-linea px-2.5 py-1">
            <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STAMP_FOREGROUND }} />
            <Text className="text-[12px] font-bold" style={{ color: STAMP_FOREGROUND }}>{`GPS ${precisionLabel(props.location)}`}</Text>
          </View>
        ) : null}
        <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 gap-1 bg-black/70 px-3 py-2">
          <View className="flex-row items-center gap-2"><Clock size={13} color={STAMP_FOREGROUND} /><Text className="text-[13px]" style={{ color: STAMP_FOREGROUND, fontVariant: ['tabular-nums'] }}>{stampDateLine(now)}</Text></View>
          <View className="flex-row items-center gap-2"><MapPin size={13} color={STAMP_FOREGROUND} /><Text className="text-[13px]" style={{ color: STAMP_FOREGROUND, fontVariant: ['tabular-nums'] }}>{place}</Text></View>
        </View>
      </View>
      {props.error ? <Text className="mt-1 text-[13px] text-error">{props.error}</Text> : null}
    </View>
  );
});
