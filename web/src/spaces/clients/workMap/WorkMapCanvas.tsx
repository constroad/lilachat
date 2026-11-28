import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl/dist/maplibre-gl-csp';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { addObservationLayer, useMapCardPopup, useObservationData } from './MapCardPopup';
import { useDarkClass } from '../../../ui/useDarkClass';
import { type MapPick, type ViewableFile, type WorkMapObservation, MARK_CHIP_PAINT, MARK_FILL_PAINT, MARK_GLYPH_PAINT, MARK_LINE_PAINT, MARK_TEXT_LAYOUT, MARK_TEXT_PAINT, mapMarkCollection, type WorkMapMark, PLACE_ZOOM, type MapFrame, STATION_DOT_PAINT, STATION_TEXT_LAYOUT, STATION_TEXT_PAINT, stationMarkCollection, type StationMark, NAMED_ROAD_LAYER, ROAD_SOURCE_LAYERS, tapBox, tapTolerancePx, WORK_MAP_PENDING_PAINT, LAYER_BASE_PAINT, LAYER_LABEL_LAYOUT, LAYER_LABEL_PAINT, LAYER_PLANNED_PAINT, STATION_MIN_ZOOM, workMapStyleFor, workMapCollection, type BasemapFeatureLike, type DischargePin, type StreetEnd, type StreetHandle, type TapFeatures, type WorkMapLine, type WorkMapPoint, type WorkMapView } from '@lilachat/shared';

maplibregl.setWorkerUrl(workerUrl);

/** The holder keeps its map: the tutorial recorder taps a street by its place (`tapMap`). */
export type MapHolder = HTMLDivElement & { workMap?: maplibregl.Map };
const PLANNED = 'work-map-planned';
const DONE = 'work-map-done';
const STRETCH = 'work-map-stretch';
const PENDING = 'work-map-pending';
const STATIONS = 'work-map-stations';
const BARE = 'work-map-bare';
const LABELS = 'work-map-layer-labels';
const MARKS = 'work-map-marks';
const NO_MARKS: WorkMapMark[] = [];
const NO_STATIONS: StationMark[] = [];
const FIT = { padding: 56, maxZoom: 17, duration: 0 };
const LINE_ROUND = { 'line-cap': 'round', 'line-join': 'round' } as const;
const NO_PINS: DischargePin[] = [];

/** Portal's drawings (gibas, manholes…) under the streets' lines, in Portal's croquis colors: chip, its dot, tag (José 19/11). */
function addMarkLayers(map: maplibregl.Map) {
  map.addSource(MARKS, { type: 'geojson', data: mapMarkCollection([]) });
  map.addLayer({ id: `${MARKS}-fill`, type: 'fill', source: MARKS, filter: ['==', ['geometry-type'], 'Polygon'], paint: MARK_FILL_PAINT as maplibregl.FillLayerSpecification['paint'] });
  map.addLayer({ id: `${MARKS}-line`, type: 'line', source: MARKS, filter: ['!=', ['geometry-type'], 'Point'], layout: LINE_ROUND, paint: MARK_LINE_PAINT as maplibregl.LineLayerSpecification['paint'] });
  map.addLayer({ id: `${MARKS}-dot`, type: 'circle', source: MARKS, filter: ['==', ['geometry-type'], 'Point'], paint: MARK_CHIP_PAINT as maplibregl.CircleLayerSpecification['paint'] });
  map.addLayer({ id: `${MARKS}-glyph`, type: 'circle', source: MARKS, filter: ['==', ['geometry-type'], 'Point'], paint: MARK_GLYPH_PAINT as maplibregl.CircleLayerSpecification['paint'] });
  map.addLayer({ id: `${MARKS}-text`, type: 'symbol', source: MARKS, layout: MARK_TEXT_LAYOUT as maplibregl.SymbolLayerSpecification['layout'], paint: MARK_TEXT_PAINT });
}

function addWorkLayers(map: maplibregl.Map) {
  addMarkLayers(map);
  map.addSource(BARE, { type: 'geojson', data: workMapCollection([]) });
  map.addLayer({ id: BARE, type: 'line', source: BARE, layout: LINE_ROUND, paint: LAYER_BASE_PAINT as maplibregl.LineLayerSpecification['paint'] });
  map.addSource(PLANNED, { type: 'geojson', data: workMapCollection([]) });
  map.addSource(DONE, { type: 'geojson', data: workMapCollection([]) });
  map.addLayer({ id: PLANNED, type: 'line', source: PLANNED, layout: LINE_ROUND, paint: LAYER_PLANNED_PAINT as maplibregl.LineLayerSpecification['paint'] });
  // Suggested and waiting stretches under the done line: the chosen work's color stays on top (José 09/11).
  map.addSource(STRETCH, { type: 'geojson', data: workMapCollection([]) });
  map.addLayer({ id: STRETCH, type: 'line', source: STRETCH, layout: LINE_ROUND, paint: { 'line-color': ['get', 'color'], 'line-width': 11, 'line-opacity': 0.55 } });
  map.addLayer({ id: DONE, type: 'line', source: DONE, layout: LINE_ROUND, paint: { 'line-color': ['get', 'color'], 'line-width': 7 } });
  // What waits for approval: thin and dashed in its work's color, over the approved line (José 28/11).
  map.addSource(PENDING, { type: 'geojson', data: workMapCollection([]) });
  map.addLayer({ id: PENDING, type: 'line', source: PENDING, layout: { 'line-join': 'round' }, paint: WORK_MAP_PENDING_PAINT as maplibregl.LineLayerSpecification['paint'] });
  map.addSource(STATIONS, { type: 'geojson', data: stationMarkCollection([]) });
  // «0+000» only zoomed in (José 28/11: they covered every street).
  map.addLayer({ id: `${STATIONS}-dot`, type: 'circle', source: STATIONS, minzoom: STATION_MIN_ZOOM, paint: STATION_DOT_PAINT });
  map.addLayer({ id: `${STATIONS}-text`, type: 'symbol', source: STATIONS, minzoom: STATION_MIN_ZOOM, layout: STATION_TEXT_LAYOUT as maplibregl.SymbolLayerSpecification['layout'], paint: STATION_TEXT_PAINT });
  // The selected layer's «42 %» beside each street (design ma01).
  map.addSource(LABELS, { type: 'geojson', data: stationMarkCollection([]) });
  map.addLayer({ id: LABELS, type: 'symbol', source: LABELS, layout: LAYER_LABEL_LAYOUT as maplibregl.SymbolLayerSpecification['layout'], paint: LAYER_LABEL_PAINT });
  addObservationLayer(map);
}

/** Lucide's camera and film, inline: a marker is plain DOM, outside React. */
const PIN_ICONS = {
  photo: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  video: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
} as const;

function iconPin(pin: DischargePin & { icon: 'photo' | 'video' }, element: HTMLElement) {
  element.className = `relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface text-on-primary shadow-md ${pin.outside ? 'bg-error' : 'bg-primary'}`;
  // A photo is filled with its day's color when the work has several days (José 09/11); off the work it stays red.
  if (pin.dayColor && !pin.outside) element.style.backgroundColor = pin.dayColor;
  element.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PIN_ICONS[pin.icon]}</svg>`;
  const count = document.createElement('span');
  count.className = 'absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-surface bg-surface px-1 text-[10px] font-bold text-primary';
  count.textContent = pin.label;
  element.append(count);
}

/**
 * A pin over the map (design o-07). A unit: its number and its plate under it. A spot of
 * «Fotos»: a camera or a film with how many it holds (José 09/11: bare numbers confused).
 */
function pinElement(pin: DischargePin, onPin: { current: ((id: string) => void) | undefined }): HTMLElement {
  const element = document.createElement(onPin.current ? 'button' : 'div');
  element.dataset.testid = `pin-${pin.id}`;
  if (pin.icon) {
    iconPin({ ...pin, icon: pin.icon }, element);
  } else {
    element.className = 'flex flex-col items-center';
    const dot = document.createElement('span');
    dot.className = `flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-surface px-1 text-[11px] font-bold text-on-primary shadow ${pin.outside ? 'bg-error' : 'bg-primary'}`;
    dot.textContent = pin.label;
    // An observation brings its own fill: red pending, green lifted (design `ob-01`).
    if (pin.fill) dot.style.backgroundColor = pin.fill;
    // A unit wears its day as a thicker ring (José 09/11).
    if (pin.dayColor) { dot.style.borderColor = pin.dayColor; dot.style.borderWidth = '4px'; }
    element.append(dot);
    if (pin.caption) {
      const plate = document.createElement('span');
      plate.className = 'mt-0.5 rounded-md bg-surface px-1.5 font-mono text-[10px] font-bold text-on-surface shadow';
      plate.textContent = pin.caption;
      element.append(plate);
    }
  }
  if (onPin.current) {
    // A photo marker (José 08/11): the click opens its photos and does not reach the map.
    element.setAttribute('aria-label', `${pin.label} ${pin.icon === 'video' ? 'videos' : 'fotos'} aquí`);
    element.addEventListener('click', (event) => { event.stopPropagation(); onPin.current?.(pin.id); });
  }
  return element;
}

function usePins(map: maplibregl.Map | null, ready: boolean, pins: DischargePin[], onPin: { current: ((id: string) => void) | undefined }) {
  useEffect(() => {
    if (!ready || !map) return undefined;
    const markers = pins.map((pin) => new maplibregl.Marker({ element: pinElement(pin, onPin) }).setLngLat([pin.lng, pin.lat]).addTo(map));
    return () => markers.forEach((marker) => marker.remove());
  }, [map, ready, pins, onPin]);
}

/** A draggable end of a picked street (José 08/11): a ring with its chainage under it. */
function handleElement(handle: StreetHandle): HTMLElement {
  const element = document.createElement('div');
  element.dataset.testid = `editor-extremo-${handle.handle}`;
  element.className = 'flex cursor-grab flex-col items-center active:cursor-grabbing';
  const ring = document.createElement('span');
  ring.className = 'h-7 w-7 rounded-full border-4 border-primary bg-surface shadow-md';
  const label = document.createElement('span');
  label.className = 'mt-0.5 rounded-md bg-surface px-1.5 font-mono text-[11px] font-bold text-on-surface shadow';
  label.textContent = handle.label;
  element.append(ring, label);
  return element;
}

type HandleDrop = (handle: StreetEnd, point: WorkMapPoint) => void;

function useHandles(map: maplibregl.Map | null, ready: boolean, handles: StreetHandle[], onDrop: { current: HandleDrop | undefined }) {
  useEffect(() => {
    if (!ready || !map) return undefined;
    const markers = handles.map((handle) => {
      const marker = new maplibregl.Marker({ element: handleElement(handle), draggable: true, anchor: 'top', offset: [0, -14] }).setLngLat([handle.point.lng, handle.point.lat]).addTo(map);
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLngLat();
        onDrop.current?.(handle.handle, { lat, lng });
      });
      return marker;
    });
    return () => markers.forEach((marker) => marker.remove());
  }, [map, ready, handles, onDrop]);
}

const NO_HANDLES: StreetHandle[] = [];

const isCoarsePointer = (): boolean => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

/**
 * The roads at a tap (audit 07/11): what is drawn under the finger, and the named roads of the
 * loaded tiles, where the name always is (labels are drawn only every few blocks).
 */
function roadsAt(map: maplibregl.Map, event: maplibregl.MapMouseEvent): TapFeatures {
  const style = map.getStyle();
  const layers = (style?.layers ?? []).filter((layer) => ROAD_SOURCE_LAYERS.includes((layer as { 'source-layer'?: string })['source-layer'] ?? '')).map((layer) => layer.id);
  const underFinger = layers.length ? (map.queryRenderedFeatures(tapBox(event.point, tapTolerancePx(isCoarsePointer())), { layers }) as unknown as BasemapFeatureLike[]) : [];
  const vectorSources = Object.entries(style?.sources ?? {}).filter(([, source]) => source.type === 'vector').map(([id]) => id);
  const nearby = vectorSources.flatMap((id) => {
    try {
      return map.querySourceFeatures(id, { sourceLayer: NAMED_ROAD_LAYER }) as unknown as BasemapFeatureLike[];
    } catch {
      // A source without that layer belongs to another style: it has no road names to give.
      return [];
    }
  });
  return { underFinger, nearby, tap: { lat: event.lngLat.lat, lng: event.lngLat.lng } };
}

/** The streets of the work over a literal map (José 06/11). Lazy: its library weighs more than the chat. */
/** `onTap`: drawing a street (design o-02), each tap is a bend; the map also offers «ubicarme» when there is nothing to frame. */
/** A place found by the search flies there; a street picked whole frames both of its ends. */
function useCameraMoves(map: maplibregl.Map | null, ready: boolean, focus: WorkMapPoint | null | undefined, frame: MapFrame | null | undefined) {
  useEffect(() => {
    if (ready && focus) map?.flyTo({ center: [focus.lng, focus.lat], zoom: PLACE_ZOOM, duration: 600 });
  }, [map, ready, focus]);
  useEffect(() => {
    if (ready && frame) map?.fitBounds(frame, { ...FIT, duration: 600 });
  }, [map, ready, frame]);
}

type SourceData = Parameters<maplibregl.GeoJSONSource['setData']>[0];
const NO_LINES: WorkMapLine[] = [];

/** Keeps one of the map's sources in step with what it draws once the map is ready; `build` is a module function. */
function useSourceData<T>(map: maplibregl.Map | null, ready: boolean, source: string, input: T, build: (input: T) => SourceData) {
  useEffect(() => {
    if (ready) (map?.getSource(source) as maplibregl.GeoJSONSource | undefined)?.setData(build(input));
  }, [map, ready, source, input, build]);
}

export default function WorkMapCanvas(props: { view: WorkMapView; expanded: boolean; /** The selected layer's «42 %» beside each street (design ma01). */ labels?: StationMark[]; pins?: DischargePin[]; stretches?: WorkMapLine[]; /** What waits for approval (José 28/11). */ pending?: WorkMapLine[]; /** «0+100» on the road (audit item 10). */ stations?: StationMark[]; /** The part of a street without a stretch (audit item 15). */ bare?: WorkMapLine[]; onTap?: (point: WorkMapPoint, roads: TapFeatures, zoom?: number) => void; /** Draggable ends of a picked street (José 08/11). */ handles?: StreetHandle[]; onHandleDrop?: HandleDrop; /** A tap on a pin (the «Fotos» layer, José 08/11). */ onPin?: (id: string) => void; /** A place found by the search: the map flies there (José 08/11). */ focus?: WorkMapPoint | null; /** A street just picked whole: the map shows both of its ends. */ frame?: MapFrame | null; /** Portal's drawings (José 19/11). */ marks?: readonly WorkMapMark[]; /** Portal's observations, as pins (José 19/11). */ observations?: readonly WorkMapObservation[]; /** The drawing or observation whose card stays open. */ selected?: MapPick | null; onSelect?: (pick: MapPick | null) => void; /** A thumbnail of a card: the photo full size. */ onCardPhoto?: (photo: ViewableFile, all: ViewableFile[]) => void }) {
  const { view, expanded } = props;
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const firstBounds = useRef(view.bounds);
  const [ready, setReady] = useState(false);
  const dark = useDarkClass();
  const firstDark = useRef(dark);
  const onTap = useRef(props.onTap);
  onTap.current = props.onTap;
  const onPin = useRef(props.onPin);
  onPin.current = props.onPin;
  const onHandleDrop = useRef(props.onHandleDrop);
  onHandleDrop.current = props.onHandleDrop;

  useEffect(() => {
    if (!holder.current) return undefined;
    const bounds = firstBounds.current ?? undefined;
    const created = new maplibregl.Map({ container: holder.current, style: workMapStyleFor(firstDark.current) as unknown as maplibregl.StyleSpecification, bounds, fitBoundsOptions: FIT, attributionControl: { compact: true } });
    created.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    // «Mi ubicación» on every map (José 20/11, design mapa-v2): the browser asks only when it is pressed.
    created.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, fitBoundsOptions: { maxZoom: 17 } }), 'bottom-right');
    created.on('click', (event) => onTap.current?.({ lat: event.lngLat.lat, lng: event.lngLat.lng }, roadsAt(created, event), created.getZoom()));
    created.on('load', () => {
      addWorkLayers(created);
      setReady(true);
    });
    map.current = created;
    (holder.current as MapHolder).workMap = created;
    return () => {
      map.current = null;
      created.remove();
    };
  }, []);

  // The theme switched while the map is open: same layer ids, so only the base paint changes.
  useEffect(() => {
    const current = map.current;
    if (!current || !ready) return;
    for (const layer of workMapStyleFor(dark).layers) {
      for (const [property, value] of Object.entries(layer.paint ?? {})) current.setPaintProperty(layer.id, property, value);
    }
  }, [dark, ready]);

  useEffect(() => {
    const current = map.current;
    if (!ready || !current) return;
    (current.getSource(PLANNED) as maplibregl.GeoJSONSource | undefined)?.setData(workMapCollection(view.planned));
    (current.getSource(DONE) as maplibregl.GeoJSONSource | undefined)?.setData(workMapCollection(view.done));
    if (view.bounds) current.fitBounds(view.bounds, FIT);
  }, [ready, view]);

  useEffect(() => {
    map.current?.resize();
  }, [expanded]);

  useCameraMoves(map.current, ready, props.focus, props.frame);

  useSourceData(map.current, ready, STRETCH, props.stretches ?? NO_LINES, workMapCollection);
  useSourceData(map.current, ready, PENDING, props.pending ?? NO_LINES, workMapCollection);
  useSourceData(map.current, ready, BARE, props.bare ?? NO_LINES, workMapCollection);
  useSourceData(map.current, ready, MARKS, props.marks ?? NO_MARKS, mapMarkCollection);
  useSourceData(map.current, ready, STATIONS, props.stations ?? NO_STATIONS, stationMarkCollection);
  useSourceData(map.current, ready, LABELS, props.labels ?? NO_STATIONS, stationMarkCollection);
  useObservationData(map.current, ready, props.observations);
  const card = useMapCardPopup(map.current, ready, { marks: props.marks ?? NO_MARKS, observations: props.observations, selected: props.selected, onSelect: props.onSelect, onPhoto: props.onCardPhoto, drawing: Boolean(props.onTap) });
  usePins(map.current, ready, props.pins ?? NO_PINS, onPin);
  useHandles(map.current, ready, props.handles ?? NO_HANDLES, onHandleDrop);

  // MapLibre's stylesheet makes its container `relative`: on the holder itself `absolute` lost and the map measured 0 high.
  return (
    <div className="absolute inset-0">
      <div ref={holder} data-testid="mapa-lienzo" data-listo={ready} className="h-full w-full" />
      {card}
    </div>
  );
}
