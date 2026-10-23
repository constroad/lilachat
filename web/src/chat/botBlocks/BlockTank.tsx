import { tankFill, type TankItem } from '@lilachat/shared';
import { TONE } from './tones';

const BODY = { width: 44, height: 76 };
const FILL: Record<TankItem['tone'], string> = { ok: 'fill-en-linea', warn: 'fill-warning', error: 'fill-error', info: 'fill-primary', neutral: 'fill-primary' };

/** A tank drawn, not photographed (José, 23/10): the cylinder, its liquid at the real level and the dashed minimum. */
function TankDrawing({ tank, scale = 1 }: { tank: TankItem; scale?: number }) {
  const width = BODY.width * scale;
  const height = BODY.height * scale;
  const fill = tankFill(tank.level, height);
  const lid = 5 * scale;
  const minY = tank.min !== undefined ? height - tank.min * height : null;
  return (
    <svg width={width + 2} height={height + lid * 2 + 2} viewBox={`-1 ${-lid - 1} ${width + 2} ${height + lid * 2 + 2}`} role="img" aria-label={`${tank.name}: ${Math.round(tank.level * 100)} %`} className="shrink-0">
      <rect x={0} y={0} width={width} height={height} rx={4 * scale} className="fill-surface-variant stroke-outline" strokeWidth={1} />
      {fill.height > 0 ? <rect x={1} y={fill.y} width={width - 2} height={fill.height} rx={3 * scale} className={FILL[tank.tone]} /> : null}
      <ellipse cx={width / 2} cy={0} rx={width / 2} ry={lid} className="fill-surface stroke-outline" strokeWidth={1} />
      {minY !== null ? <line x1={-1} x2={width + 1} y1={minY} y2={minY} className="stroke-error" strokeWidth={1} strokeDasharray="3 3" /> : null}
    </svg>
  );
}

function TankFacts({ tank, big }: { tank: TankItem; big: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{tank.name}</p>
      <p className={`${big ? 'text-[26px]' : 'text-[15px]'} font-bold tabular-nums ${tank.tone === 'error' ? 'text-error' : ''}`}>{tank.value}</p>
      {tank.sub ? <p className="truncate text-[12px] text-on-surface-variant">{tank.sub}</p> : null}
      {tank.delta ? <span className={`mt-1 inline-block rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${TONE.neutral.soft}`}>{tank.delta}</span> : null}
    </div>
  );
}

export function BlockTank({ items }: { items: TankItem[] }) {
  if (items.length === 1) {
    return (
      <div data-testid="bloque-tanque" className="flex items-center gap-3">
        <TankDrawing tank={items[0]!} />
        <TankFacts tank={items[0]!} big />
      </div>
    );
  }
  return (
    <div data-testid="bloque-tanques" className="grid grid-cols-2 gap-2">
      {items.map((tank) => (
        <div key={tank.name} className={`flex items-center gap-2 rounded-xl border px-2 py-2 ${tank.tone === 'error' ? TONE.error.soft : 'border-outline/15'}`}>
          <TankDrawing tank={tank} scale={0.6} />
          <TankFacts tank={tank} big={false} />
        </div>
      ))}
    </div>
  );
}
