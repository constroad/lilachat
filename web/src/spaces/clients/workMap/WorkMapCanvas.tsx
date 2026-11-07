import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl/dist/maplibre-gl-csp';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { WORK_MAP_PLANNED_COLOR, WORK_MAP_STYLE_URL, workMapCollection, type WorkMapView } from '@lilachat/shared';

maplibregl.setWorkerUrl(workerUrl);

const PLANNED = 'work-map-planned';
const DONE = 'work-map-done';
const FIT = { padding: 56, maxZoom: 17, duration: 0 };
const LINE_ROUND = { 'line-cap': 'round', 'line-join': 'round' } as const;

function addWorkLayers(map: maplibregl.Map) {
  map.addSource(PLANNED, { type: 'geojson', data: workMapCollection([]) });
  map.addSource(DONE, { type: 'geojson', data: workMapCollection([]) });
  map.addLayer({ id: PLANNED, type: 'line', source: PLANNED, layout: LINE_ROUND, paint: { 'line-color': WORK_MAP_PLANNED_COLOR, 'line-width': 5, 'line-dasharray': [1.2, 1.4] } });
  map.addLayer({ id: DONE, type: 'line', source: DONE, layout: LINE_ROUND, paint: { 'line-color': ['get', 'color'], 'line-width': 7 } });
}

/** The streets of the work over a literal map (José 06/11). Lazy: its library weighs more than the chat. */
export default function WorkMapCanvas(props: { view: WorkMapView; expanded: boolean }) {
  const { view, expanded } = props;
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const firstBounds = useRef(view.bounds);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!holder.current) return undefined;
    const bounds = firstBounds.current ?? undefined;
    const created = new maplibregl.Map({ container: holder.current, style: WORK_MAP_STYLE_URL, bounds, fitBoundsOptions: FIT, attributionControl: { compact: true } });
    created.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
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

  // MapLibre's stylesheet makes its container `relative`: on the holder itself `absolute` lost and the map measured 0 high.
  return (
    <div className="absolute inset-0">
      <div ref={holder} data-testid="mapa-lienzo" data-listo={ready} className="h-full w-full" />
    </div>
  );
}
