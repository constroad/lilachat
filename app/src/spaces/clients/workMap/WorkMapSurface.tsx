import { Camera, GeoJSONSource, Layer, Map as MapSurface } from '@maplibre/maplibre-react-native';
import { dischargePinCollection, WORK_MAP_PLANNED_COLOR, WORK_MAP_STYLE_URL, workMapCollection, type DischargePin, type WorkMapLine, type WorkMapView } from '@lilachat/shared';

const LINE_ENDS = { 'line-cap': 'round', 'line-join': 'round' } as const;
const EDGE = { top: 48, right: 48, bottom: 48, left: 48 };
/** The style's own font: OpenFreeMap serves it, the street names use it. */
const PIN_FONT = ['Noto Sans Bold'];
const NO_PINS: DischargePin[] = [];
const NO_LINES: WorkMapLine[] = [];

/**
 * The streets of the work over a literal map (José 06/11). `moves` is off inside the detail, whose
 * scroll would fight the finger; the full map moves. Texture: a surface view ignores rounded corners.
 */
export function WorkMapSurface(props: { view: WorkMapView; moves: boolean; pins?: DischargePin[]; stretches?: WorkMapLine[] }) {
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
      <GeoJSONSource id="work-map-stretch" data={workMapCollection(props.stretches ?? NO_LINES)}>
        <Layer id="work-map-stretch-line" type="line" layout={LINE_ENDS} paint={{ 'line-color': ['get', 'color'], 'line-width': 10, 'line-opacity': 0.55 }} />
      </GeoJSONSource>
      <GeoJSONSource id="work-map-pins" data={dischargePinCollection(props.pins ?? NO_PINS)}>
        <Layer id="work-map-pin-dot" type="circle" paint={{ 'circle-color': ['get', 'color'], 'circle-radius': 11, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 }} />
        <Layer id="work-map-pin-number" type="symbol" layout={{ 'text-field': ['get', 'label'], 'text-font': PIN_FONT, 'text-size': 12, 'text-allow-overlap': true }} paint={{ 'text-color': '#ffffff' }} />
      </GeoJSONSource>
    </MapSurface>
  );
}
