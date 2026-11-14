import { routeTilesFor, type RoutePoint } from '@lilachat/shared';

const BOX = { width: 260, height: 160 };
const DOT = 18;

/**
 * A route on a card (Portal 13/11, visits: lv01). The OpenStreetMap tiles that fit every point,
 * a dotted line in the order they came, and each point with its label (or its number without one).
 */
export function RouteMapWeb(props: { points: readonly RoutePoint[] }) {
  const map = routeTilesFor(props.points, BOX);
  const line = map.points.map((point) => `${point.left},${point.top}`).join(' ');
  return (
    <span data-testid="mapa-ruta" className="relative block overflow-hidden rounded-lg bg-background" style={{ width: BOX.width, height: BOX.height }}>
      {map.tiles.map((tile) => (
        <img key={tile.url} src={tile.url} alt="" loading="lazy" draggable={false} className="absolute max-w-none" style={{ left: tile.left, top: tile.top, width: 256, height: 256 }} />
      ))}
      <svg className="absolute inset-0 text-primary" width={BOX.width} height={BOX.height} aria-hidden="true">
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth={2.5} strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {map.points.map((point, index) => (
        <span key={`${point.left}-${point.top}-${index}`} data-testid={`punto-ruta-${index + 1}`} className="absolute flex items-center gap-1" style={{ left: point.left - DOT / 2, top: point.top - DOT / 2 }}>
          <span className="flex items-center justify-center rounded-full border-2 border-white bg-primary text-[10px] font-bold text-on-primary shadow" style={{ width: DOT, height: DOT }}>
            {point.label ? null : index + 1}
          </span>
          {point.label ? <span className="whitespace-nowrap rounded bg-white/90 px-1 text-[10px] font-semibold text-black/80 shadow-sm">{point.label}</span> : null}
        </span>
      ))}
      <span className="absolute bottom-0 right-0 bg-white/80 px-1 text-[9px] text-black/70">© OpenStreetMap</span>
    </span>
  );
}
