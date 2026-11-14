import { routeTilesFor, type RoutePoint } from '@lilachat/shared';

const BOX = { width: 260, height: 160 };
const DOT = 18;

/**
 * A route on a card (Portal 13/11, visits: lv01). The OpenStreetMap tiles that fit every point,
 * a dotted line in the order they came, and each point with its label (or its number without one).
 */
/** One point: its number inside (or its label beside it); a saved one grey, the current one with a halo (lv02). */
function RouteDot(props: { index: number; left: number; top: number; label?: string; n: number; grey: boolean; halo: boolean }) {
  const fill = props.grey ? 'bg-on-surface-variant' : 'bg-primary';
  return (
    <span data-testid={`punto-ruta-${props.index + 1}`} className="absolute flex items-center gap-1" style={{ left: props.left - DOT / 2, top: props.top - DOT / 2 }}>
      <span className={`flex items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-on-primary shadow ${fill} ${props.halo ? 'ring-4 ring-primary/30' : ''}`} style={{ width: DOT, height: DOT }}>
        {props.label ? null : props.n}
      </span>
      {props.label ? <span className="whitespace-nowrap rounded bg-white/90 px-1 text-[10px] font-semibold text-black/80 shadow-sm">{props.label}</span> : null}
    </span>
  );
}

/** `numbered`: each point with its number inside (lv02), the saved ones grey and `current` in the accent with a halo. */
export function RouteMapWeb(props: { points: readonly (RoutePoint & { n?: number })[]; box?: { width: number; height: number }; numbered?: boolean; current?: number }) {
  const box = props.box ?? BOX;
  const map = routeTilesFor(props.points, box);
  const line = map.points.map((point) => `${point.left},${point.top}`).join(' ');
  return (
    <span data-testid="mapa-ruta" className="relative block overflow-hidden rounded-lg bg-background" style={{ width: box.width, height: box.height }}>
      {map.tiles.map((tile) => (
        <img key={tile.url} src={tile.url} alt="" referrerPolicy="strict-origin-when-cross-origin" loading="lazy" draggable={false} className="absolute max-w-none" style={{ left: tile.left, top: tile.top, width: 256, height: 256 }} />
      ))}
      <svg className="absolute inset-0 text-primary" width={box.width} height={box.height} aria-hidden="true">
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth={2.5} strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {map.points.map((point, index) => (
        <RouteDot key={`${point.left}-${point.top}-${index}`} index={index} left={point.left} top={point.top} label={props.numbered ? undefined : point.label} n={props.points[index]?.n ?? index + 1} grey={props.numbered === true && props.current !== undefined && index !== props.current} halo={index === props.current} />
      ))}
      <span className="absolute bottom-0 right-0 bg-white/80 px-1 text-[9px] text-black/70">© OpenStreetMap</span>
    </span>
  );
}
