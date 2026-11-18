import { fieldGeoMapOf, type FieldGeo } from '@lilachat/shared';

const BOX = { width: 300, height: 160 };
const PIN = 12;

/** Where a field read from a KML sits (fase 3): the lot's outline filled and the named points. A still map. */
export function FieldGeoMap({ geo, testId }: { geo: FieldGeo; testId?: string }) {
  const map = fieldGeoMapOf(geo, BOX);
  const outline = map.outline.map((point) => `${point.left},${point.top}`).join(' ');
  return (
    <span data-testid={testId} className="relative mt-2 block max-w-full overflow-hidden rounded-lg border border-outline/20 bg-background" style={{ width: BOX.width, height: BOX.height }}>
      {map.tiles.map((tile) => (
        <img key={tile.url} src={tile.url} alt="" referrerPolicy="strict-origin-when-cross-origin" loading="lazy" draggable={false} className="absolute max-w-none" style={{ left: tile.left, top: tile.top, width: 256, height: 256 }} />
      ))}
      <svg className="absolute inset-0 text-primary" width={BOX.width} height={BOX.height} aria-hidden="true">
        {outline ? <polygon points={outline} fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" /> : null}
      </svg>
      {map.pins.map((pin, index) => (
        <span key={`${pin.left}-${pin.top}-${index}`} className="absolute flex items-center gap-1" style={{ left: pin.left - PIN / 2, top: pin.top - PIN / 2 }}>
          <span className="rounded-full border-2 border-white bg-primary" style={{ width: PIN, height: PIN }} />
          {pin.label ? <span className="rounded bg-white/90 px-1 text-[10px] font-semibold text-black/80">{pin.label}</span> : null}
        </span>
      ))}
      <span className="absolute bottom-0 right-0 bg-white/80 px-1 text-[9px] text-black/70">© OpenStreetMap</span>
    </span>
  );
}
