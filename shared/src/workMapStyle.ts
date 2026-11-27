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

/** The colors of the base map: the light plan of o-01 and the dark one of mapa-v2 (audit 20/11). */
export type MapPalette = {
  ground: string; block: string; blockEdge: string; park: string; parkEdge: string; parkText: string; water: string;
  road: string; roadEdge: string; majorRoad: string; majorEdge: string; label: string; placeLabel: string; halo: string;
};

export const LIGHT_MAP_PALETTE: MapPalette = {
  ground: 'hsl(222, 20%, 94%)', block: 'hsl(0, 0%, 100%)', blockEdge: 'hsl(222, 16%, 86%)',
  park: 'hsl(142, 52%, 91%)', parkEdge: 'hsl(142, 40%, 76%)', parkText: 'hsl(142, 55%, 28%)', water: 'hsl(204, 70%, 87%)',
  road: 'hsl(0, 0%, 100%)', roadEdge: 'hsl(222, 14%, 82%)', majorRoad: 'hsl(45, 90%, 88%)', majorEdge: 'hsl(40, 55%, 72%)',
  label: 'hsl(222, 12%, 38%)', placeLabel: 'hsl(222, 14%, 30%)', halo: 'hsl(0, 0%, 100%)',
};

/**
 * Same tiles, same layers: only the paint turns dark, so the work's colors keep standing out. José 27/11: like Portal's
 * night map (Portal 9abf42a49, `DARK_WORK_MAP_COLORS`), a navigation app at night — navy land, roads as clearly lighter
 * slate lines (avenues brighter), green parks with green names, darker water and light names on a dark halo.
 */
export const DARK_MAP_PALETTE: MapPalette = {
  ground: 'hsl(218, 24%, 16%)', block: 'hsl(218, 20%, 20%)', blockEdge: 'hsl(218, 18%, 24%)',
  park: 'hsl(148, 36%, 25%)', parkEdge: 'hsl(148, 34%, 31%)', parkText: 'hsl(146, 45%, 62%)', water: 'hsl(214, 42%, 11%)',
  road: 'hsl(216, 27%, 33%)', roadEdge: 'hsl(218, 26%, 21%)', majorRoad: 'hsl(214, 30%, 45%)', majorEdge: 'hsl(216, 28%, 26%)',
  label: 'hsl(214, 25%, 88%)', placeLabel: 'hsl(0, 0%, 96%)', halo: 'hsl(220, 30%, 10%)',
};

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

const groundLayers = (c: MapPalette): MapStyleLayer[] => [
  { id: 'ground', type: 'background', paint: { 'background-color': c.ground } },
  { id: 'water', type: 'fill', source: TILES, 'source-layer': 'water', paint: { 'fill-color': c.water } },
  { id: 'park', type: 'fill', source: TILES, 'source-layer': 'park', paint: { 'fill-color': c.park, 'fill-outline-color': c.parkEdge } },
  { id: 'green', type: 'fill', source: TILES, 'source-layer': 'landcover', filter: ['match', ['get', 'class'], ['grass', 'wood'], true, false], paint: { 'fill-color': c.park } },
  { id: 'block', type: 'fill', source: TILES, 'source-layer': 'building', minzoom: 14, paint: { 'fill-color': c.block, 'fill-outline-color': c.blockEdge } },
];

const labelLayers = (c: MapPalette): MapStyleLayer[] => [
  {
    id: 'street-name',
    type: 'symbol',
    source: TILES,
    'source-layer': 'transportation_name',
    minzoom: 14,
    layout: { 'symbol-placement': 'line', 'text-field': SPANISH_NAME, 'text-font': FONT_BOLD, 'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 18, 13], 'text-letter-spacing': 0.12, 'text-max-angle': 30 },
    paint: { 'text-color': c.label, 'text-halo-color': c.halo, 'text-halo-width': 1.6 },
  },
  {
    id: 'park-name',
    type: 'symbol',
    source: TILES,
    'source-layer': 'park',
    minzoom: 15,
    layout: { 'text-field': SPANISH_NAME, 'text-font': FONT_BOLD, 'text-size': 11, 'text-letter-spacing': 0.1, 'text-max-width': 8 },
    paint: { 'text-color': c.parkText, 'text-halo-color': c.halo, 'text-halo-width': 1.2 },
  },
  {
    id: 'place-name',
    type: 'symbol',
    source: TILES,
    'source-layer': 'place',
    filter: ['match', ['get', 'class'], ['city', 'town', 'suburb', 'neighbourhood', 'quarter'], true, false],
    layout: { 'text-field': SPANISH_NAME, 'text-font': FONT_REGULAR, 'text-size': ['interpolate', ['linear'], ['zoom'], 10, 11, 16, 14], 'text-letter-spacing': 0.15, 'text-max-width': 9 },
    paint: { 'text-color': c.placeLabel, 'text-halo-color': c.halo, 'text-halo-width': 1.6 },
  },
];

/** The base map in the given palette; the layer ids never change, so a theme switch only repaints. */
export function workMapStyle(palette: MapPalette = LIGHT_MAP_PALETTE): MapStyle {
  return {
    version: 8,
    name: 'Lilachat · mapa de obra',
    sources: { [TILES]: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    layers: [...groundLayers(palette), ...roadLayers('street', STREETS, palette.road, palette.roadEdge, 9), ...roadLayers('avenue', MAJOR, palette.majorRoad, palette.majorEdge, 13), ...labelLayers(palette)],
  };
}

export const WORK_MAP_STYLE: MapStyle = workMapStyle(LIGHT_MAP_PALETTE);
export const WORK_MAP_DARK_STYLE: MapStyle = workMapStyle(DARK_MAP_PALETTE);

/** The base map that matches the theme on screen (mapa-v2: dark map in dark mode). */
export const workMapStyleFor = (dark: boolean): MapStyle => (dark ? WORK_MAP_DARK_STYLE : WORK_MAP_STYLE);
