import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { Camera, GeoJSONSource, Images, Layer, Map as MapSurface, ViewAnnotation, type CameraRef, type MapRef, type StyleSpecification } from '@maplibre/maplibre-react-native';
import { MapControls } from './MapControls';
import { PLACE_ZOOM, type MapFrame, dischargePinCollection, tapBox, tapTolerancePx, WORK_MAP_PLANNED_COLOR, WORK_MAP_STYLE, workMapCollection, type BasemapFeatureLike, type DischargePin, type StreetEnd, type StreetHandle, type TapFeatures, type WorkMapLine, type WorkMapPoint, type WorkMapView , STATION_DOT_PAINT, STATION_TEXT_LAYOUT, STATION_TEXT_PAINT, stationMarkCollection, type StationMark } from '@lilachat/shared';

const LINE_ENDS = { 'line-cap': 'round', 'line-join': 'round' } as const;
const EDGE = { top: 48, right: 48, bottom: 48, left: 48 };
/** The style's own font: OpenFreeMap serves it, the street names use it. */
const PIN_FONT = ['Noto Sans Bold'];
const NO_STATIONS: StationMark[] = [];
const NO_PINS: DischargePin[] = [];
const NO_LINES: WorkMapLine[] = [];
/** Close enough to tell one side of the street from the other while drawing (o-02). */
const DRAW_ZOOM = 17;

/**
 * The streets of the work over a literal map (José 06/11). `moves` is off inside the detail, whose
 * scroll would fight the finger; the full map moves. Texture: a surface view ignores rounded corners.
 */
/** A road of the tiles carries its `class`; boundaries and the work's own lines do not. */
const isTileRoad = (feature: BasemapFeatureLike): boolean => typeof feature?.properties?.class === 'string';

/**
 * The roads at a tap (audit 07/11): what is drawn under the finger, and the named roads in view.
 * The native map has no tiles to read, only what it draws, so the names come from the labels shown.
 */
async function roadsAt(map: MapRef | null, point: [number, number], tap: WorkMapPoint): Promise<TapFeatures> {
  if (!map) return { underFinger: [], nearby: [], tap };
  const [x, y] = point;
  const [under, inView] = await Promise.all([map.queryRenderedFeatures(tapBox({ x, y }, tapTolerancePx(true))), map.queryRenderedFeatures()]);
  const roads = (features: unknown[]) => (features as BasemapFeatureLike[]).filter(isTileRoad);
  return { underFinger: roads(under), nearby: roads(inView).filter((feature) => typeof feature.properties?.name === 'string'), tap };
}

const NO_HANDLES: StreetHandle[] = [];

/** A draggable end of a picked street (José 08/11): a ring with its chainage under it. */
function EndHandle(props: { handle: StreetHandle; onDrop?: (handle: StreetEnd, point: WorkMapPoint) => void }) {
  const { handle } = props;
  return (
    <ViewAnnotation id={`extremo-${handle.handle}`} lngLat={[handle.point.lng, handle.point.lat]} anchor="top" offset={[0, -16]} draggable onDragEnd={(event) => { const [lng, lat] = event.nativeEvent.lngLat; props.onDrop?.(handle.handle, { lat, lng }); }}>
      <View testID={`editor-extremo-${handle.handle}`} className="items-center">
        <View className="h-8 w-8 rounded-full border-4 border-primary bg-surface" />
        <Text className="mt-0.5 rounded-md bg-surface px-1.5 font-mono text-[11px] font-bold text-on-surface">{handle.label}</Text>
      </View>
    </ViewAnnotation>
  );
}

const PIN_IMAGES = { 'pin-photo': require('../../../../assets/map/camera.png') as number, 'pin-video': require('../../../../assets/map/video.png') as number };

/** The photo spots as a source: their icon, how many they hold and the color of where they are. */
const iconPinCollection = (pins: DischargePin[]) => {
  const base = dischargePinCollection(pins.filter((pin) => pin.icon).map((pin) => ({ ...pin, icon: undefined })));
  const icons = new Map(pins.map((pin) => [pin.id, pin.icon]));
  // A photo is filled with its day's color (José 09/11); one off the work keeps its red.
  const fills = new Map(pins.flatMap((pin) => (pin.dayColor && !pin.outside ? [[pin.id, pin.dayColor] as const] : [])));
  return { ...base, features: base.features.map((feature) => ({ ...feature, properties: { ...feature.properties, color: fills.get(feature.properties.id) ?? feature.properties.color, icon: `pin-${icons.get(feature.properties.id) ?? 'photo'}` } })) };
};

/** `onTap` draws a street (o-02): each tap is a bend. `near` frames where the phone is when there is nothing drawn yet. */
export function WorkMapSurface(props: { view: WorkMapView; moves: boolean; pins?: DischargePin[]; stretches?: WorkMapLine[]; /** «0+100» on the road (audit item 10). */ stations?: StationMark[]; /** The part of a street without a stretch (audit item 15). */ bare?: WorkMapLine[]; onTap?: (point: WorkMapPoint, roads: TapFeatures) => void; near?: WorkMapPoint | null; /** Draggable ends of a picked street (José 08/11). */ handles?: StreetHandle[]; onHandleDrop?: (handle: StreetEnd, point: WorkMapPoint) => void; /** A tap on a pin (the «Fotos» layer, José 08/11). */ onPin?: (id: string) => void; /** A place found by the search: the map flies there (José 08/11). */ focus?: WorkMapPoint | null; /** A street just picked whole: the map shows both of its ends. */ frame?: MapFrame | null; /** Room for the system bar under a full-screen map. */ controlsInset?: number }) {
  const { view, moves } = props;
  const map = useRef<MapRef>(null);
  const camera = useRef<CameraRef>(null);
  useEffect(() => {
    if (props.focus) camera.current?.flyTo({ center: [props.focus.lng, props.focus.lat], zoom: PLACE_ZOOM, duration: 600 });
  }, [props.focus]);
  useEffect(() => {
    if (props.frame) camera.current?.fitBounds([...props.frame[0], ...props.frame[1]], { padding: EDGE, duration: 600 });
  }, [props.frame]);
  const press = async (lngLat: [number, number], point: [number, number]) => {
    const tap = { lat: lngLat[1], lng: lngLat[0] };
    const roads = await roadsAt(map.current, point, tap).catch(() => ({ underFinger: [], nearby: [], tap }));
    props.onTap?.(tap, roads);
  };
  const corners = view.bounds;
  return (
    <View style={{ flex: 1 }}>
    <MapSurface ref={map} testID="mapa-lienzo" style={{ flex: 1 }} mapStyle={WORK_MAP_STYLE as unknown as StyleSpecification} androidView="texture" logo={false} compass={false} dragPan={moves} touchZoom={moves} doubleTapZoom={moves} doubleTapHoldZoom={moves} touchRotate={false} touchPitch={false} onPress={props.onTap ? (event) => void press(event.nativeEvent.lngLat as [number, number], event.nativeEvent.point as [number, number]) : undefined}>
      {corners ? <Camera ref={camera} bounds={[...corners[0], ...corners[1]]} padding={EDGE} duration={0} /> : props.near ? <Camera ref={camera} center={[props.near.lng, props.near.lat]} zoom={DRAW_ZOOM} duration={0} /> : <Camera ref={camera} />}
      <GeoJSONSource id="work-map-bare" data={workMapCollection(props.bare ?? NO_LINES)}>
        <Layer id="work-map-bare-line" type="line" layout={LINE_ENDS} paint={{ 'line-color': ['get', 'color'], 'line-width': 3 }} />
      </GeoJSONSource>
      <GeoJSONSource id="work-map-planned" data={workMapCollection(view.planned)}>
        <Layer id="work-map-planned-line" type="line" layout={LINE_ENDS} paint={{ 'line-color': WORK_MAP_PLANNED_COLOR, 'line-width': 4, 'line-dasharray': [1.2, 1.4] }} />
      </GeoJSONSource>
      {/* Suggested and waiting stretches under the done line: the chosen work's color stays on top (José 09/11). */}
      <GeoJSONSource id="work-map-stretch" data={workMapCollection(props.stretches ?? NO_LINES)}>
        <Layer id="work-map-stretch-line" type="line" layout={LINE_ENDS} paint={{ 'line-color': ['get', 'color'], 'line-width': 10, 'line-opacity': 0.55 }} />
      </GeoJSONSource>
      <GeoJSONSource id="work-map-done" data={workMapCollection(view.done)}>
        <Layer id="work-map-done-line" type="line" layout={LINE_ENDS} paint={{ 'line-color': ['get', 'color'], 'line-width': 6 }} />
      </GeoJSONSource>
      <GeoJSONSource id="work-map-stations" data={stationMarkCollection(props.stations ?? NO_STATIONS)}>
        <Layer id="work-map-station-dot" type="circle" paint={STATION_DOT_PAINT} />
        <Layer id="work-map-station-text" type="symbol" layout={STATION_TEXT_LAYOUT as never} paint={STATION_TEXT_PAINT} />
      </GeoJSONSource>
      <GeoJSONSource id="work-map-pins" data={dischargePinCollection(props.pins ?? NO_PINS)} onPress={props.onPin ? (event) => { const id = event.nativeEvent.features[0]?.properties?.id; if (typeof id === 'string') props.onPin?.(id); } : undefined}>
        {/* The day's color as a ring when the work has several days (José 09/11). */}
        <Layer id="work-map-pin-dot" type="circle" paint={{ 'circle-color': ['get', 'color'], 'circle-radius': 11, 'circle-stroke-color': ['get', 'ring'], 'circle-stroke-width': ['get', 'ringWidth'] }} />
        <Layer id="work-map-pin-number" type="symbol" layout={{ 'text-field': ['get', 'label'], 'text-font': PIN_FONT, 'text-size': 12, 'text-allow-overlap': true }} paint={{ 'text-color': '#ffffff' }} />
        {/* The unit's plate under its number (José 09/11): which unit was where. */}
        <Layer id="work-map-pin-plate" type="symbol" layout={{ 'text-field': ['get', 'caption'], 'text-font': PIN_FONT, 'text-size': 11, 'text-offset': [0, 1.7], 'text-allow-overlap': true }} paint={{ 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 2 }} />
      </GeoJSONSource>
      {/* Photo spots (José 09/11: a camera, not a bare number). Drawn by the map itself: a view over
          the map does not take taps on Android, a layer does. */}
      <Images images={PIN_IMAGES} />
      <GeoJSONSource id="work-map-icon-pins" data={iconPinCollection(props.pins ?? NO_PINS)} onPress={props.onPin ? (event) => { const id = event.nativeEvent.features[0]?.properties?.id; if (typeof id === 'string') props.onPin?.(id); } : undefined}>
        <Layer id="work-map-icon-pin-dot" type="circle" paint={{ 'circle-color': ['get', 'color'], 'circle-radius': 17, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 }} />
        <Layer id="work-map-icon-pin-glyph" type="symbol" layout={{ 'icon-image': ['get', 'icon'], 'icon-size': 0.5, 'icon-allow-overlap': true }} />
        <Layer id="work-map-icon-pin-badge" type="circle" paint={{ 'circle-color': '#ffffff', 'circle-radius': 8, 'circle-translate': [14, -14] }} />
        <Layer id="work-map-icon-pin-count" type="symbol" layout={{ 'text-field': ['get', 'label'], 'text-font': PIN_FONT, 'text-size': 10, 'text-offset': [1.4, -1.4], 'text-allow-overlap': true }} paint={{ 'text-color': '#6d28d9' }} />
      </GeoJSONSource>
      {(props.handles ?? NO_HANDLES).map((handle) => <EndHandle key={`${handle.handle}-${handle.label}`} handle={handle} onDrop={props.onHandleDrop} />)}
    </MapSurface>
    <MapControls map={map} camera={camera} bottomInset={props.controlsInset} />
    </View>
  );
}
