import { Camera, GeoJSONSource, Layer, Map as MapSurface } from '@maplibre/maplibre-react-native';
import { WORK_MAP_PLANNED_COLOR, WORK_MAP_STYLE_URL, workMapCollection, type WorkMapView } from '@lilachat/shared';

const LINE_ENDS = { 'line-cap': 'round', 'line-join': 'round' } as const;
const EDGE = { top: 48, right: 48, bottom: 48, left: 48 };

/**
 * The streets of the work over a literal map (José 06/11). `moves` is off inside the detail, whose
 * scroll would fight the finger; the full map moves. Texture: a surface view ignores rounded corners.
 */
export function WorkMapSurface(props: { view: WorkMapView; moves: boolean }) {
  const { view, moves } = props;
  const corners = view.bounds;
  return (
    <MapSurface testID="mapa-lienzo" style={{ flex: 1 }} mapStyle={WORK_MAP_STYLE_URL} androidView="texture" logo={false} compass={false} dragPan={moves} touchZoom={moves} doubleTapZoom={moves} doubleTapHoldZoom={moves} touchRotate={false} touchPitch={false}>
      {corners ? <Camera bounds={[...corners[0], ...corners[1]]} padding={EDGE} duration={0} /> : null}
      <GeoJSONSource id="work-map-planned" data={workMapCollection(view.planned)}>
        <Layer id="work-map-planned-line" type="line" layout={LINE_ENDS} paint={{ 'line-color': WORK_MAP_PLANNED_COLOR, 'line-width': 4, 'line-dasharray': [1.2, 1.4] }} />
      </GeoJSONSource>
      <GeoJSONSource id="work-map-done" data={workMapCollection(view.done)}>
        <Layer id="work-map-done-line" type="line" layout={LINE_ENDS} paint={{ 'line-color': ['get', 'color'], 'line-width': 6 }} />
      </GeoJSONSource>
    </MapSurface>
  );
}
