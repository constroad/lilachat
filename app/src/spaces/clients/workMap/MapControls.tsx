import { useEffect, useState, type RefObject } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LocateFixed, Minus, Plus } from 'lucide-react-native';
import type { CameraRef, MapRef } from '@maplibre/maplibre-react-native';
import { useCurrentLocation } from '../../../chat/location/useCurrentLocation';
import { useColores } from '../../../ui/tema';

/** Street level is enough to tell one side of the road from the other; past it the tiles run out. */
const ZOOM_MIN = 3;
const ZOOM_MAX = 19;
const ZOOM_STEP_MS = 200;
const LOCATE_ZOOM = 17;
const BUTTON = 'h-11 w-11 items-center justify-center bg-surface';

const zoomWithin = (zoom: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));

/**
 * Design o-01 and o-02: zoom in, zoom out and «mi ubicación» over the map (side-by-side audit 07/11:
 * the APK had none). The location is asked only when the person taps it, and only while in use.
 */
export function MapControls(props: { map: RefObject<MapRef | null>; camera: RefObject<CameraRef | null> }) {
  const colors = useColores();
  const [locating, setLocating] = useState(false);
  const { current } = useCurrentLocation(locating);
  useEffect(() => {
    if (!locating || current.state === 'locating') return;
    if (current.state === 'ready') props.camera.current?.easeTo({ center: [current.location.lng, current.location.lat], zoom: LOCATE_ZOOM, duration: ZOOM_STEP_MS });
    setLocating(false);
  }, [locating, current, props.camera]);
  const zoomBy = async (step: number) => {
    const map = props.map.current;
    if (!map) return;
    const view = await Promise.all([map.getCenter(), map.getZoom()]).catch((failure: Error) => {
      console.warn('work map: zoom unread', failure.name);
      return null;
    });
    if (view) props.camera.current?.easeTo({ center: view[0], zoom: zoomWithin(view[1] + step), duration: ZOOM_STEP_MS });
  };
  return (
    <View pointerEvents="box-none" className="absolute bottom-4 right-3 gap-2">
      <View className="overflow-hidden rounded-xl border border-outline/20">
        <Pressable testID="mapa-acercar" accessibilityLabel="Acercar" onPress={() => void zoomBy(1)} className={`${BUTTON} border-b border-outline/15`}><Plus size={18} color={colors['on-surface']} /></Pressable>
        <Pressable testID="mapa-alejar" accessibilityLabel="Alejar" onPress={() => void zoomBy(-1)} className={BUTTON}><Minus size={18} color={colors['on-surface']} /></Pressable>
      </View>
      <Pressable testID="mapa-ubicarme" accessibilityLabel="Mi ubicación" onPress={() => setLocating(true)} className={`${BUTTON} rounded-xl border border-outline/20`}>
        {locating ? <Text className="text-[11px] text-on-surface-variant">…</Text> : <LocateFixed size={18} color={colors.primary} />}
      </Pressable>
    </View>
  );
}
