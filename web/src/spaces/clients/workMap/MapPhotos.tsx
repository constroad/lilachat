import { useMemo, useState } from 'react';
import { Camera } from 'lucide-react';
import { photoLayerFiles, photoPinsOfDay, photoSpotsOf, type MapPhoto, type WorkMap } from '@lilachat/shared';
import { usePortalFileViewer } from '../PortalFileViewer';

const NO_PHOTOS: MapPhoto[] = [];

/**
 * The «Fotos» layer (José 08/11): every field photo lands on its street and chainage; a marker per
 * spot, and a marker opens that spot's photos and videos in the viewer every map already has.
 */
export function usePhotoLayer(map: WorkMap, photos: MapPhoto[] = NO_PHOTOS, days: string[] = []) {
  const [shown, setShown] = useState(false);
  const spots = useMemo(() => photoSpotsOf(map, photos), [map, photos]);
  const pins = useMemo(() => photoPinsOfDay(spots, days), [spots, days]);
  const viewer = usePortalFileViewer();
  const openPin = (pinId: string) => {
    const opened = photoLayerFiles(spots, pinId);
    if (opened) viewer.open(opened.first, opened.all);
  };
  return { available: photos.length > 0, shown, toggle: () => setShown((before) => !before), pins, openPin, viewer: viewer.viewer, count: photos.length };
}

/** The button over the map: «Fotos · 12», pressed while the layer shows. */
export function PhotoToggle(props: { shown: boolean; count: number; onToggle: () => void }) {
  return (
    <button type="button" data-testid="mapa-fotos" aria-pressed={props.shown} onClick={props.onToggle} className={`absolute bottom-8 left-1/2 z-10 flex h-10 -translate-x-1/2 items-center gap-2 rounded-full border px-3 text-[13px] font-semibold shadow ${props.shown ? 'border-primary bg-primary text-on-primary' : 'border-outline/20 bg-surface text-on-surface'}`}>
      <Camera size={16} />Fotos · {props.count}
    </button>
  );
}
