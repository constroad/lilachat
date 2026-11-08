import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl/dist/maplibre-gl-csp';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { STATION_DOT_PAINT, STATION_TEXT_LAYOUT, STATION_TEXT_PAINT, stationMarkCollection, type StationMark, NAMED_ROAD_LAYER, ROAD_SOURCE_LAYERS, tapBox, tapTolerancePx, WORK_MAP_PLANNED_COLOR, WORK_MAP_STYLE_URL, workMapCollection, type BasemapFeatureLike, type DischargePin, type TapFeatures, type WorkMapLine, type WorkMapPoint, type WorkMapView } from '@lilachat/shared';

maplibregl.setWorkerUrl(workerUrl);

const PLANNED = 'work-map-planned';
const DONE = 'work-map-done';
const STRETCH = 'work-map-stretch';
const STATIONS = 'work-map-stations';
const NO_STATIONS: StationMark[] = [];
const FIT = { padding: 56, maxZoom: 17, duration: 0 };
const LINE_ROUND = { 'line-cap': 'round', 'line-join': 'round' } as const;
const NO_PINS: DischargePin[] = [];

function addWorkLayers(map: maplibregl.Map) {
  map.addSource(PLANNED, { type: 'geojson', data: workMapCollection([]) });
  map.addSource(DONE, { type: 'geojson', data: workMapCollection([]) });
  map.addLayer({ id: PLANNED, type: 'line', source: PLANNED, layout: LINE_ROUND, paint: { 'line-color': WORK_MAP_PLANNED_COLOR, 'line-width': 5, 'line-dasharray': [1.2, 1.4] } });
  map.addLayer({ id: DONE, type: 'line', source: DONE, layout: LINE_ROUND, paint: { 'line-color': ['get', 'color'], 'line-width': 7 } });
  map.addSource(STRETCH, { type: 'geojson', data: workMapCollection([]) });
  map.addLayer({ id: STRETCH, type: 'line', source: STRETCH, layout: LINE_ROUND, paint: { 'line-color': ['get', 'color'], 'line-width': 11, 'line-opacity': 0.55 } });
  map.addSource(STATIONS, { type: 'geojson', data: stationMarkCollection([]) });
  map.addLayer({ id: `${STATIONS}-dot`, type: 'circle', source: STATIONS, paint: STATION_DOT_PAINT });
  map.addLayer({ id: `${STATIONS}-text`, type: 'symbol', source: STATIONS, layout: STATION_TEXT_LAYOUT as maplibregl.SymbolLayerSpecification['layout'], paint: STATION_TEXT_PAINT });
}

/** A numbered pin per unit (design o-07): an HTML marker, so no font of the style is needed. */
function pinElement(pin: DischargePin): HTMLElement {
  const element = document.createElement('div');
  element.dataset.testid = `pin-${pin.id}`;
  element.className = `flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface text-[11px] font-bold text-on-primary shadow ${pin.outside ? 'bg-error' : 'bg-primary'}`;
  element.textContent = pin.label;
  return element;
}

function usePins(map: maplibregl.Map | null, ready: boolean, pins: DischargePin[]) {
  useEffect(() => {
    if (!ready || !map) return undefined;
    const markers = pins.map((pin) => new maplibregl.Marker({ element: pinElement(pin) }).setLngLat([pin.lng, pin.lat]).addTo(map));
    return () => markers.forEach((marker) => marker.remove());
  }, [map, ready, pins]);
}

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
export default function WorkMapCanvas(props: { view: WorkMapView; expanded: boolean; pins?: DischargePin[]; stretches?: WorkMapLine[]; /** «0+100» on the road (audit item 10). */ stations?: StationMark[]; onTap?: (point: WorkMapPoint, roads: TapFeatures) => void }) {
  const { view, expanded } = props;
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const firstBounds = useRef(view.bounds);
  const [ready, setReady] = useState(false);
  const onTap = useRef(props.onTap);
  onTap.current = props.onTap;

  useEffect(() => {
    if (!holder.current) return undefined;
    const bounds = firstBounds.current ?? undefined;
    const created = new maplibregl.Map({ container: holder.current, style: WORK_MAP_STYLE_URL, bounds, fitBoundsOptions: FIT, attributionControl: { compact: true } });
    created.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    if (onTap.current) created.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, fitBoundsOptions: { maxZoom: 17 } }), 'bottom-right');
    created.on('click', (event) => onTap.current?.({ lat: event.lngLat.lat, lng: event.lngLat.lng }, roadsAt(created, event)));
    created.on('load', () => {
      addWorkLayers(created);
      setReady(true);
    });
    map.current = created;
    return () => {
      map.current = null;
      created.remove();
    };
  }, []);

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

  useEffect(() => {
    if (ready) (map.current?.getSource(STRETCH) as maplibregl.GeoJSONSource | undefined)?.setData(workMapCollection(props.stretches ?? []));
  }, [ready, props.stretches]);
  useEffect(() => {
    if (ready) (map.current?.getSource(STATIONS) as maplibregl.GeoJSONSource | undefined)?.setData(stationMarkCollection(props.stations ?? NO_STATIONS));
  }, [ready, props.stations]);
  usePins(map.current, ready, props.pins ?? NO_PINS);

  // MapLibre's stylesheet makes its container `relative`: on the holder itself `absolute` lost and the map measured 0 high.
  return (
    <div className="absolute inset-0">
      <div ref={holder} data-testid="mapa-lienzo" data-listo={ready} className="h-full w-full" />
    </div>
  );
}
