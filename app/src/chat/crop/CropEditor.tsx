import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ActivityIndicator, PanResponder, View } from 'react-native';
import { Image } from 'expo-image';
import { reportarError } from '../../ui/reportarError';
import type { FotoElegida } from '../envioDeFotos';
import { aspectCrop, dragCrop, fitContain, handleAt, nextRotation, toFraction, type Handle, type Rect, type Rotation } from './cropMath';
import { cropPhoto, loadCropPreview, type CropPreview } from './cropPhoto';
import { CropFrame } from './CropFrame';
import { CropFooter, CropHeader, RatioBar } from './CropControls';

/** How far from a corner or an edge a finger still grabs it (a fingertip is ~44 dp). */
const REACH = 24;
const MIN_SIZE = 64;
/** Room above and below the photo so the corners can be grabbed at the border. */
const PADDING_Y = 20;
/**
 * Room at the sides: wider than Android's back gesture (24–40 dp by its
 * sensitivity). At 20 dp a finger on a left corner closed the crop (emulator, 01/11).
 */
const PADDING_X = 40;

/**
 * Crop and turn a photo before sending it, like WhatsApp (José 01/11). Over
 * «Enviar fotos», in the same screen: two Android modals do not stack well.
 */
export function CropEditor(props: { photo: FotoElegida; onCancel: () => void; onDone: (photo: FotoElegida) => void }) {
  const { preview, failed: previewFailed } = useCropPreview(props.photo);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [aspect, setAspect] = useState<number | null>(null);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const sideways = rotation % 180 !== 0;
  const bounds = useMemo(() => {
    if (!preview || !box) return null;
    const fitted = fitContain(sideways ? preview.height : preview.width, sideways ? preview.width : preview.height, box.width - PADDING_X * 2, box.height - PADDING_Y * 2);
    return { ...fitted, x: fitted.x + PADDING_X, y: fitted.y + PADDING_Y };
  }, [preview, box, sideways]);
  useEffect(() => {
    if (bounds) setCrop(aspectCrop(bounds, aspect));
  }, [bounds, aspect]);
  const area = useRef<View>(null);
  const gesture = useCropGesture({ crop, bounds, aspect }, setCrop, area);

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
      <CropHeader onCancel={props.onCancel} onReset={reset} onRotate={() => setRotation(nextRotation)} />
      <View
        ref={area}
        testID="area-de-recorte"
        className="flex-1"
        collapsable={false}
        onLayout={(event) => {
          setBox({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height });
          gesture.locate();
        }}
        {...gesture.handlers}
      >
        {preview && bounds ? <TurnedPhoto preview={preview} bounds={bounds} rotation={rotation} /> : <ActivityIndicator color="white" style={{ flex: 1 }} />}
        {crop && bounds ? <CropFrame crop={crop} bounds={bounds} /> : null}
      </View>
      <RatioBar aspect={aspect} onPick={setAspect} />
      <CropFooter failed={failed || previewFailed} busy={busy} ready={crop !== null} onDone={() => void finish()} />
    </View>
  );
}

/** The small copy the screen draws, released when the editor closes. */
function useCropPreview(photo: FotoElegida): { preview: CropPreview | null; failed: boolean } {
  const [preview, setPreview] = useState<CropPreview | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    let loaded: CropPreview | null = null;
    loadCropPreview(photo)
      .then((result) => (alive ? setPreview((loaded = result)) : result.release()))
      .catch((error: unknown) => {
        reportarError('CropEditor.preview', error);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
      loaded?.release();
    };
  }, [photo]);
  return { preview, failed };
}

/**
 * The finger on a corner, an edge or inside the frame; read from a ref so the
 * responder is made once. Measured from the root view: `locationX` is relative
 * to the view under the finger, and expo-image ignores `pointerEvents`, so the
 * photo took the touch and no corner was ever grabbed (emulator, 01/11).
 */
function useCropGesture(state: { crop: Rect | null; bounds: Rect | null; aspect: number | null }, setCrop: (crop: Rect) => void, area: RefObject<View | null>) {
  const live = useRef(state);
  live.current = state;
  const grab = useRef<{ handle: Handle; start: Rect } | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  // Same frame as a touch's pageX/pageY; again on every touch, in case the screen moved since the layout.
  const locate = useCallback(() => area.current?.measure((_x, _y, _width, _height, pageX, pageY) => (origin.current = { x: pageX, y: pageY })), [area]);
  const tracker = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) => {
          const { crop } = live.current;
          const handle = crop ? handleAt(crop, event.nativeEvent.pageX - origin.current.x, event.nativeEvent.pageY - origin.current.y, REACH) : null;
          grab.current = handle && crop ? { handle, start: crop } : null;
          return grab.current !== null;
        },
        onStartShouldSetPanResponderCapture: () => {
          locate();
          return false;
        },
        onPanResponderMove: (_event, move) => {
          const { bounds, aspect } = live.current;
          if (grab.current && bounds) setCrop(dragCrop(grab.current.start, grab.current.handle, move.dx, move.dy, bounds, { minSize: MIN_SIZE, aspect }));
        },
        onPanResponderRelease: () => (grab.current = null),
        onPanResponderTerminate: () => (grab.current = null),
      }),
    [setCrop, locate],
  );
  return { handlers: tracker.panHandlers, locate };
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
