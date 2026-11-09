import { useMemo, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Camera } from 'lucide-react-native';
import { photoLayerFiles, photoPinsOfDay, photoSpotsOf, type MapPhoto, type WorkMap } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { useFileViewer } from '../useFileViewer';

const NO_PHOTOS: MapPhoto[] = [];

/**
 * The «Fotos» layer (José 08/11): every field photo lands on its street and chainage; a marker per
 * spot, and a marker opens that spot's photos and videos in the viewer every map already has.
 */
export function usePhotoLayer(map: WorkMap, photos: MapPhoto[] = NO_PHOTOS, days: string[] = []) {
  const [shown, setShown] = useState(false);
  const spots = useMemo(() => photoSpotsOf(map, photos), [map, photos]);
  const pins = useMemo(() => photoPinsOfDay(spots, days), [spots, days]);
  const files = useFileViewer();
  const openPin = (pinId: string) => {
    const opened = photoLayerFiles(spots, pinId);
    if (opened) files.open(opened.first, opened.all);
  };
  return { available: photos.length > 0, shown, setShown, pins, openPin, viewer: files.viewer, count: photos.length };
}

/** «Fotos · 12» over the map, pressed while the layer shows. */
export function PhotoToggle(props: { shown: boolean; count: number; onToggle: () => void; style?: { bottom?: number; top?: number } }) {
  const colors = useColores();
  return (
    <Pressable testID="mapa-fotos" accessibilityRole="button" accessibilityState={{ selected: props.shown }} onPress={props.onToggle} style={props.style} className={`absolute self-center h-11 flex-row items-center gap-2 rounded-full border px-4 ${props.shown ? 'border-primary bg-primary' : 'border-outline/20 bg-surface'}`}>
      <Camera size={16} color={props.shown ? colors['on-primary'] : colors['on-surface']} />
      <Text className={`text-[14px] font-semibold ${props.shown ? 'text-on-primary' : 'text-on-surface'}`}>Fotos · {props.count}</Text>
    </Pressable>
  );
}
