import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { RotateCcw, X } from 'lucide-react-native';
import { useMargenes } from '../../ui/useMargenes';
import { useColores } from '../../ui/tema';
import { reportarError } from '../../ui/reportarError';
import type { FotoElegida } from '../envioDeFotos';
import { aspectCrop, dragCrop, fitContain, handleAt, nextRotation, toFraction, type Handle, type Rect, type Rotation } from './cropMath';
import { cropPhoto, loadCropPreview, type CropPreview } from './cropPhoto';
import { CropFrame } from './CropFrame';

/** How far from a corner or an edge a finger still grabs it (a fingertip is ~44 dp). */
const REACH = 24;
const MIN_SIZE = 64;
/** Room around the photo so the corners can be grabbed at the border. */
const PADDING = 20;
const RATIOS: { label: string; aspect: number | null }[] = [
  { label: 'Libre', aspect: null },
  { label: 'Cuadrado', aspect: 1 },
  { label: '4:3', aspect: 4 / 3 },
  { label: '3:4', aspect: 3 / 4 },
  { label: '16:9', aspect: 16 / 9 },
];

/**
 * Crop and turn a photo before sending it, like WhatsApp (José 01/11). Over
 * «Enviar fotos», in the same screen: two Android modals do not stack well.
 */
export function CropEditor(props: { photo: FotoElegida; onCancel: () => void; onDone: (photo: FotoElegida) => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const [preview, setPreview] = useState<CropPreview | null>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [aspect, setAspect] = useState<number | null>(null);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let loaded: CropPreview | null = null;
    loadCropPreview(props.photo)
      .then((result) => (alive ? setPreview((loaded = result)) : result.release()))
      .catch((error: unknown) => {
        reportarError('CropEditor.preview', error);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
      loaded?.release();
    };
  }, [props.photo]);

  const sideways = rotation % 180 !== 0;
  const bounds = useMemo(() => {
    if (!preview || !box) return null;
    const fitted = fitContain(sideways ? preview.height : preview.width, sideways ? preview.width : preview.height, box.width - PADDING * 2, box.height - PADDING * 2);
    return { ...fitted, x: fitted.x + PADDING, y: fitted.y + PADDING };
  }, [preview, box, sideways]);
  useEffect(() => {
    if (bounds) setCrop(aspectCrop(bounds, aspect));
  }, [bounds, aspect]);

  const live = useRef({ crop, bounds, aspect });
  live.current = { crop, bounds, aspect };
  const grab = useRef<{ handle: Handle; start: Rect } | null>(null);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) => {
          const handle = live.current.crop ? handleAt(live.current.crop, event.nativeEvent.locationX, event.nativeEvent.locationY, REACH) : null;
          grab.current = handle && live.current.crop ? { handle, start: live.current.crop } : null;
          return grab.current !== null;
        },
        onPanResponderMove: (_event, gesture) => {
          const { bounds: area, aspect: ratio } = live.current;
          if (grab.current && area) setCrop(dragCrop(grab.current.start, grab.current.handle, gesture.dx, gesture.dy, area, { minSize: MIN_SIZE, aspect: ratio }));
        },
        onPanResponderRelease: () => (grab.current = null),
        onPanResponderTerminate: () => (grab.current = null),
      }),
    [],
  );

  const reset = () => {
    setRotation(0);
    setAspect(null);
    if (bounds && rotation === 0) setCrop(aspectCrop(bounds, null));
  };
  const finish = async () => {
    if (!crop || !bounds || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      props.onDone(await cropPhoto(props.photo, toFraction(crop, bounds), rotation));
    } catch (error) {
      reportarError('CropEditor.finish', error);
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <View className="absolute inset-0 bg-black" testID="pantalla-recortar">
      <View className="flex-row items-center px-3 pb-2" style={{ paddingTop: margins.cabecera }}>
        <Pressable testID="btn-cancelar-recorte" accessibilityLabel="Cancelar el recorte" onPress={props.onCancel} className="h-11 w-11 items-center justify-center">
          <X size={24} color="white" />
        </Pressable>
        <Text className="flex-1 text-base font-semibold" style={{ color: 'white' }}>Recortar</Text>
        <Pressable testID="btn-restablecer-recorte" onPress={reset} className="h-11 justify-center px-3">
          <Text className="text-[15px] font-semibold" style={{ color: 'white' }}>Restablecer</Text>
        </Pressable>
        <Pressable testID="btn-girar-foto" accessibilityLabel="Girar a la izquierda" onPress={() => setRotation(nextRotation)} className="h-11 w-11 items-center justify-center">
          <RotateCcw size={22} color="white" />
        </Pressable>
      </View>

      <View testID="area-de-recorte" className="flex-1" onLayout={(event) => setBox({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })} {...responder.panHandlers}>
        {preview && bounds ? <TurnedPhoto preview={preview} bounds={bounds} rotation={rotation} /> : <ActivityIndicator color="white" style={{ flex: 1 }} />}
        {crop && bounds ? <CropFrame crop={crop} bounds={bounds} /> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
        {RATIOS.map((ratio) => {
          const chosen = ratio.aspect === aspect;
          return (
            <Pressable key={ratio.label} testID={`proporcion-${ratio.label}`} accessibilityState={{ selected: chosen }} onPress={() => setAspect(ratio.aspect)} className="min-h-[36px] justify-center rounded-full px-4" style={{ backgroundColor: chosen ? 'white' : 'rgba(255,255,255,0.15)' }}>
              <Text className="text-[14px] font-semibold" style={{ color: chosen ? 'black' : 'white' }}>{ratio.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="flex-row items-center px-4 pt-1" style={{ paddingBottom: margins.pie + 8 }}>
        <Text className="flex-1 text-[13px]" style={{ color: failed ? colors.error : 'rgba(255,255,255,0.7)' }}>
          {failed ? 'No se pudo recortar. Inténtalo de nuevo.' : busy ? 'Recortando…' : 'Arrastra las esquinas para recortar'}
        </Text>
        <Pressable testID="btn-listo-recorte" disabled={!crop || busy} onPress={() => void finish()} className="min-h-[44px] items-center justify-center rounded-full bg-primary px-6" style={{ opacity: !crop || busy ? 0.6 : 1 }}>
          <Text className="text-[15px] font-semibold" style={{ color: colors['on-primary'] }}>Listo</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** The preview turned in place: the bounds are already the turned shape, so a sideways photo swaps its sides. */
function TurnedPhoto(props: { preview: CropPreview; bounds: Rect; rotation: Rotation }) {
  const { bounds, rotation } = props;
  const sideways = rotation % 180 !== 0;
  const width = sideways ? bounds.height : bounds.width;
  const height = sideways ? bounds.width : bounds.height;
  return (
    <Image
      source={props.preview.image}
      pointerEvents="none"
      style={{ position: 'absolute', left: bounds.x + (bounds.width - width) / 2, top: bounds.y + (bounds.height - height) / 2, width, height, transform: [{ rotate: `${rotation}deg` }] }}
      contentFit="fill"
    />
  );
}
