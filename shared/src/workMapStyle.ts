/**
 * The base map of the work map (José 09/11: «se ve feo, no se parece en nada a tus diseños»).
 *
 * The Stitch design (o-01) draws a quiet plan: white blocks on a light ground, wide pale
 * streets, parks in soft green and the street names in Spanish and in capitals, so the work's
 * colored lines are what stands out. OpenFreeMap's positron was washed-out gray and named the
 * streets in English. Same tiles (free: no token, no card, data from
 * OpenStreetMap), our own style. The road layers keep their OpenMapTiles names: a tap on a
 * street reads them (`ROAD_SOURCE_LAYERS`). MapLibre paint cannot read CSS variables, so the
 * colors are literal HSL here, one place for the web and the APK.
 */
export type MapStyleLayer = {
  id: string;
  type: 'background' | 'fill' | 'line' | 'symbol';
  source?: string;
  'source-layer'?: string;
  minzoom?: number;
  filter?: unknown[];
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
};

export type MapStyle = {
  version: 8;
  name: string;
  sources: Record<string, { type: 'vector'; url: string }>;
  glyphs: string;
  layers: MapStyleLayer[];
};

const TILES = 'openmaptiles';
const FONT_BOLD = ['Noto Sans Bold'];
const FONT_REGULAR = ['Noto Sans Regular'];

const GROUND = 'hsl(222, 20%, 94%)';
const BLOCK = 'hsl(0, 0%, 100%)';
const BLOCK_EDGE = 'hsl(222, 16%, 86%)';
const PARK = 'hsl(142, 52%, 91%)';
const PARK_EDGE = 'hsl(142, 40%, 76%)';
const PARK_TEXT = 'hsl(142, 55%, 28%)';
const WATER = 'hsl(204, 70%, 87%)';
const ROAD = 'hsl(0, 0%, 100%)';
const ROAD_EDGE = 'hsl(222, 14%, 82%)';
const MAJOR_ROAD = 'hsl(45, 90%, 88%)';
const MAJOR_EDGE = 'hsl(40, 55%, 72%)';
const LABEL = 'hsl(222, 12%, 38%)';
const PLACE_LABEL = 'hsl(222, 14%, 30%)';
const HALO = 'hsl(0, 0%, 100%)';

/** The local name, which in Peru is the Spanish one («Jirón Moquegua»), in capitals. */
const SPANISH_NAME = ['upcase', ['coalesce', ['get', 'name'], ['get', 'name:latin']]];
const MAJOR = ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary'], true, false];
const STREETS = ['match', ['get', 'class'], ['tertiary', 'minor', 'service', 'track'], true, false];

/** Width that grows with the zoom: a block-level street is wide, like the design. */
const width = (atBlock: number) => ['interpolate', ['exponential', 1.6], ['zoom'], 12, atBlock * 0.15, 15, atBlock * 0.55, 18, atBlock * 2.4];

const roadLayers = (id: string, filter: unknown[], fill: string, edge: string, atBlock: number): MapStyleLayer[] => [
  { id: `${id}-edge`, type: 'line', source: TILES, 'source-layer': 'transportation', filter, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': edge, 'line-width': width(atBlock + 2) } },
  { id, type: 'line', source: TILES, 'source-layer': 'transportation', filter, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': fill, 'line-width': width(atBlock) } },
];

const groundLayers: MapStyleLayer[] = [
  { id: 'ground', type: 'background', paint: { 'background-color': GROUND } },
  { id: 'water', type: 'fill', source: TILES, 'source-layer': 'water', paint: { 'fill-color': WATER } },
  { id: 'park', type: 'fill', source: TILES, 'source-layer': 'park', paint: { 'fill-color': PARK, 'fill-outline-color': PARK_EDGE } },
  { id: 'green', type: 'fill', source: TILES, 'source-layer': 'landcover', filter: ['match', ['get', 'class'], ['grass', 'wood'], true, false], paint: { 'fill-color': PARK } },
  { id: 'block', type: 'fill', source: TILES, 'source-layer': 'building', minzoom: 14, paint: { 'fill-color': BLOCK, 'fill-outline-color': BLOCK_EDGE } },
];

const labelLayers: MapStyleLayer[] = [
  {
    id: 'street-name',
    type: 'symbol',
    source: TILES,
    'source-layer': 'transportation_name',
    minzoom: 14,
    layout: { 'symbol-placement': 'line', 'text-field': SPANISH_NAME, 'text-font': FONT_BOLD, 'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 18, 13], 'text-letter-spacing': 0.12, 'text-max-angle': 30 },
    paint: { 'text-color': LABEL, 'text-halo-color': HALO, 'text-halo-width': 1.6 },
  },
  {
    id: 'park-name',
    type: 'symbol',
    source: TILES,
    'source-layer': 'park',
    minzoom: 15,
    layout: { 'text-field': SPANISH_NAME, 'text-font': FONT_BOLD, 'text-size': 11, 'text-letter-spacing': 0.1, 'text-max-width': 8 },
    paint: { 'text-color': PARK_TEXT, 'text-halo-color': HALO, 'text-halo-width': 1.2 },
  },
  {
    id: 'place-name',
    type: 'symbol',
    source: TILES,
    'source-layer': 'place',
    filter: ['match', ['get', 'class'], ['city', 'town', 'suburb', 'neighbourhood', 'quarter'], true, false],
    layout: { 'text-field': SPANISH_NAME, 'text-font': FONT_REGULAR, 'text-size': ['interpolate', ['linear'], ['zoom'], 10, 11, 16, 14], 'text-letter-spacing': 0.15, 'text-max-width': 9 },
    paint: { 'text-color': PLACE_LABEL, 'text-halo-color': HALO, 'text-halo-width': 1.6 },
  },
];

export const WORK_MAP_STYLE: MapStyle = {
  version: 8,
  name: 'Lilachat · mapa de obra',
  sources: { [TILES]: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  layers: [...groundLayers, ...roadLayers('street', STREETS, ROAD, ROAD_EDGE, 9), ...roadLayers('avenue', MAJOR, MAJOR_ROAD, MAJOR_EDGE, 13), ...labelLayers],
};
