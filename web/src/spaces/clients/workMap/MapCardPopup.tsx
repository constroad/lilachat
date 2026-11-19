import { useEffect, useMemo, useRef, useState, type ReactPortal } from 'react';
import { createPortal } from 'react-dom';
import maplibregl from 'maplibre-gl/dist/maplibre-gl-csp';
import { mapCardOf, mapPickAnchor, mapPickOnMap, OBSERVATION_PIN_PAINT, observationMapCollection, type MapPick, type ViewableFile, type WorkMapMark, type WorkMapObservation } from '@lilachat/shared';
import { MapCardView } from './MapCardView';

export const OBSERVATIONS = 'work-map-observations';
const MARK_LAYERS = ['work-map-marks-fill', 'work-map-marks-line', 'work-map-marks-dot'];
const PICK_LAYERS = [...MARK_LAYERS, OBSERVATIONS];
const POPUP_OFFSET_PX = 14;
/** MapLibre's own box and tip go: the card draws itself with the app's tokens. */
const POPUP_CLASS = '[&_.maplibregl-popup-content]:!bg-transparent [&_.maplibregl-popup-content]:!p-0 [&_.maplibregl-popup-content]:!shadow-none [&_.maplibregl-popup-tip]:!hidden';
const HOVER_CLASS = 'pointer-events-none';
const NO_OBSERVATIONS: WorkMapObservation[] = [];

/** The observations over the drawings: a pin in the color of its state (José 19/11). */
export function addObservationLayer(map: maplibregl.Map) {
  map.addSource(OBSERVATIONS, { type: 'geojson', data: observationMapCollection([]) });
  map.addLayer({ id: OBSERVATIONS, type: 'circle', source: OBSERVATIONS, paint: OBSERVATION_PIN_PAINT as maplibregl.CircleLayerSpecification['paint'] });
}

export function useObservationData(map: maplibregl.Map | null, ready: boolean, observations: readonly WorkMapObservation[] = NO_OBSERVATIONS) {
  useEffect(() => {
    if (ready) (map?.getSource(OBSERVATIONS) as maplibregl.GeoJSONSource | undefined)?.setData(observationMapCollection(observations));
  }, [map, ready, observations]);
}

const pickOf = (feature: maplibregl.MapGeoJSONFeature | undefined): MapPick | null => {
  const id = feature?.properties?.id;
  return typeof id === 'string' ? { kind: feature?.layer.id === OBSERVATIONS ? 'observation' : 'mark', id } : null;
};
const samePick = (left: MapPick | null, right: MapPick | null) => left?.kind === right?.kind && left?.id === right?.id;

type PickHandlers = { onSelect: { current: ((pick: MapPick | null) => void) | undefined }; drawing: { current: unknown }; onMap: { current: (pick: MapPick) => MapPick } };

/** Hover shows the card; a click keeps it; a click on bare map lets it go. Drawing a street, taps stay the editor's. */
function usePickEvents(map: maplibregl.Map | null, ready: boolean, handlers: PickHandlers) {
  const [hovered, setHovered] = useState<MapPick | null>(null);
  useEffect(() => {
    if (!ready || !map) return undefined;
    const move = (event: maplibregl.MapLayerMouseEvent) => {
      const found = pickOf(event.features?.[0]);
      const pick = found && handlers.onMap.current(found);
      map.getCanvas().style.cursor = 'pointer';
      setHovered((before) => (samePick(before, pick) ? before : pick));
    };
    const leave = () => { map.getCanvas().style.cursor = ''; setHovered(null); };
    const click = (event: maplibregl.MapMouseEvent) => {
      if (handlers.drawing.current) return;
      const found = pickOf(map.queryRenderedFeatures(event.point, { layers: PICK_LAYERS.filter((id) => map.getLayer(id)) })[0]);
      handlers.onSelect.current?.(found && handlers.onMap.current(found));
    };
    PICK_LAYERS.forEach((id) => { map.on('mousemove', id, move); map.on('mouseleave', id, leave); });
    map.on('click', click);
    return () => {
      PICK_LAYERS.forEach((id) => { map.off('mousemove', id, move); map.off('mouseleave', id, leave); });
      map.off('click', click);
    };
  }, [map, ready, handlers]);
  return hovered;
}

type CardProps = { marks: readonly WorkMapMark[]; observations?: readonly WorkMapObservation[]; selected?: MapPick | null; onSelect?: (pick: MapPick | null) => void; onPhoto?: (photo: ViewableFile, all: ViewableFile[]) => void; drawing: boolean };

/**
 * The card of a drawing or an observation as a MapLibre popup (José 19/11): hovering shows it, a
 * click or a tap keeps it with its close button. React draws it inside the popup.
 */
export function useMapCardPopup(map: maplibregl.Map | null, ready: boolean, props: CardProps): ReactPortal | null {
  const onSelect = useRef(props.onSelect);
  onSelect.current = props.onSelect;
  const drawing = useRef<unknown>(props.drawing);
  drawing.current = props.drawing;
  const observations = props.observations ?? NO_OBSERVATIONS;
  // A pin right under a drawing opens the drawing's card, which carries the pin's photos (José 19/11).
  const onMap = useRef((pick: MapPick) => mapPickOnMap(pick, props.marks, observations));
  onMap.current = (pick: MapPick) => mapPickOnMap(pick, props.marks, observations);
  const handlers = useMemo(() => ({ onSelect, drawing, onMap }), []);
  const hovered = usePickEvents(map, ready, handlers);
  const [host] = useState(() => document.createElement('div'));
  const popup = useRef<maplibregl.Popup | null>(null);
  const shown = props.selected ?? hovered;
  const card = useMemo(() => (shown ? mapCardOf(shown, props.marks, observations) : null), [shown, props.marks, observations]);
  const anchor = useMemo(() => (shown ? mapPickAnchor(shown, props.marks, observations) : null), [shown, props.marks, observations]);
  const sticky = Boolean(props.selected);
  useEffect(() => {
    if (!ready || !map || !card || !anchor) { popup.current?.remove(); return; }
    popup.current ??= new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: 'none', offset: POPUP_OFFSET_PX, className: POPUP_CLASS });
    if (sticky) popup.current.removeClassName(HOVER_CLASS);
    else popup.current.addClassName(HOVER_CLASS);
    popup.current.setLngLat([anchor.lng, anchor.lat]).setDOMContent(host).addTo(map);
  }, [map, ready, card, anchor, sticky, host]);
  useEffect(() => () => { popup.current?.remove(); }, []);
  if (!card) return null;
  return createPortal(<MapCardView card={card} onClose={sticky ? () => props.onSelect?.(null) : undefined} onPhoto={props.onPhoto} />, host);
}
