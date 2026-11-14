import { Building2 } from 'lucide-react';
import { routeTilesFor, type RoutePoint } from '@lilachat/shared';

const BOX = { width: 260, height: 160 };
const DOT = 18;

/**
 * A route on a card (Portal 13/11, visits: lv01). The OpenStreetMap tiles that fit every point,
 * a dotted line in the order they came, and each point with its label (or its number without one).
 */
/** One point: its number inside (or its label beside it); a saved one grey, the current one with a halo (lv02). */
function RouteDot(props: { index: number; left: number; top: number; label?: string; n: number | string; grey: boolean; halo: boolean; size: number }) {
  const fill = props.grey ? 'bg-on-surface-variant' : 'bg-primary';
  return (
    <span data-testid={`punto-ruta-${props.index + 1}`} className="absolute flex items-center gap-1" style={{ left: props.left - props.size / 2, top: props.top - props.size / 2 }}>
      <span className={`flex items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-on-primary shadow ${fill} ${props.halo ? 'ring-4 ring-primary/30' : ''}`} style={{ width: props.size, height: props.size }}>
        {props.label ? null : props.n}
      </span>
      {props.label ? <span className="whitespace-nowrap rounded bg-white/90 px-1 text-[10px] font-semibold text-black/80 shadow-sm">{props.label}</span> : null}
    </span>
  );
}

/** The visit's place (lv01): a building in the accent, never a number; the route starts there. */
function PlaceDot(props: { left: number; top: number }) {
  return (
    <span data-testid="mapa-lugar" className="absolute flex items-center gap-1" style={{ left: props.left - 12, top: props.top - 12 }}>
      <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-primary text-on-primary shadow"><Building2 size={13} aria-hidden /></span>
      <span className="rounded bg-black/80 px-1 text-[9px] font-bold uppercase leading-3 text-white">Lugar</span>
    </span>
  );
}

/**
 * `numbered`: each point with its number inside (lv02), the saved ones grey and `current` in the accent with a halo.
 * `place`: where the visit is (lv01), drawn apart from the points so it is never «1».
 */
/** lv01's look: bigger dots, a fine dotted line, a border and «GPS ACTIVO · ±m» on the map. */
type VisitLook = { dot: number; badge?: string; maxZoom?: number };

export function RouteMapWeb(props: { points: readonly (RoutePoint & { n?: number | string })[]; box?: { width: number; height: number }; numbered?: boolean; current?: number; place?: RoutePoint; look?: VisitLook }) {
  const box = props.box ?? BOX;
  const map = routeTilesFor(props.place ? [props.place, ...props.points] : props.points, box, props.look?.maxZoom);
  const placeAt = props.place ? map.points[0] : undefined;
  const dots = props.place ? map.points.slice(1) : map.points;
  const line = map.points.map((point) => `${point.left},${point.top}`).join(' ');
  return (
    <span data-testid="mapa-ruta" className={`relative block overflow-hidden bg-background ${props.look ? 'rounded-[8px] border border-outline/20' : 'rounded-lg'}`} style={{ width: box.width, height: box.height }}>
      {map.tiles.map((tile) => (
        <img key={tile.url} src={tile.url} alt="" referrerPolicy="strict-origin-when-cross-origin" loading="lazy" draggable={false} className="absolute max-w-none" style={{ left: tile.left, top: tile.top, width: 256, height: 256 }} />
      ))}
      <svg className="absolute inset-0 text-primary" width={box.width} height={box.height} aria-hidden="true">
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth={props.look ? 2 : 2.5} strokeDasharray={props.look ? '1 5' : '6 5'} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {placeAt ? <PlaceDot left={placeAt.left} top={placeAt.top} /> : null}
      {dots.map((point, index) => (
        <RouteDot key={`${point.left}-${point.top}-${index}`} index={index} left={point.left} top={point.top} label={props.numbered ? undefined : point.label} n={props.points[index]?.n ?? index + 1} grey={props.numbered === true && props.current !== undefined && index !== props.current} halo={index === props.current} size={props.look?.dot ?? DOT} />
      ))}
      {props.look?.badge ? <span data-testid="mapa-gps" className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-black/80 shadow-sm"><span className="h-1.5 w-1.5 rounded-full bg-en-linea" aria-hidden />{props.look.badge}</span> : null}
      <span className="absolute bottom-0 right-0 bg-white/80 px-1 text-[9px] text-black/70">© OpenStreetMap</span>
    </span>
  );
}
