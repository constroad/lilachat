import { BAR_V_MIN_COLUMN, barFractions, linePath, type BotBlock } from '@lilachat/shared';
import { TONE } from './tones';

type Chart = Extract<BotBlock, { type: 'chart' }>;
const BAR_V_HEIGHT = 96;
const LINE = { width: 260, height: 80 };
const shown = (point: Chart['points'][number], unit?: string) => point.display ?? `${point.value}${unit ? ` ${unit}` : ''}`;

function BarsH({ chart }: { chart: Chart }) {
  const fractions = barFractions(chart.points, chart.max);
  return (
    <div data-testid="bloque-grafico-barras-h" className="space-y-2">
      {chart.points.map((point, index) => (
        <div key={`${point.label}-${index}`}>
          <div className="flex items-baseline justify-between gap-2 text-[12px]">
            <span className="min-w-0 truncate">{point.label}{point.note ? <span className={`ml-2 text-[11px] font-bold ${TONE[point.tone].text}`}>{point.note}</span> : null}</span>
            <span className={`font-semibold tabular-nums ${point.tone === 'error' ? 'text-error' : ''}`}>{shown(point, chart.unit)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-variant">
            <div className={`h-full rounded-full ${TONE[point.tone].bar}`} style={{ width: `${Math.round(fractions[index]! * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function BarsV({ chart }: { chart: Chart }) {
  const fractions = barFractions(chart.points, chart.max);
  // A week shares the card's width; past BAR_V_MIN_COLUMN each (a month) it scrolls sideways (José, 23/10).
  return (
    <div data-testid="bloque-grafico-barras-v" className="overflow-x-auto">
      <div className="grid items-end" style={{ gridTemplateColumns: `repeat(${chart.points.length}, minmax(${BAR_V_MIN_COLUMN}px, 1fr))` }}>
        {chart.points.map((point, index) => (
          <div key={`${point.label}-${index}`} className="flex min-w-0 flex-col items-center">
            <span className={`max-w-full truncate text-[12px] font-bold tabular-nums ${TONE[point.tone].text}`}>{shown(point, chart.unit)}</span>
            <div className="flex w-full items-end justify-center" style={{ height: BAR_V_HEIGHT }}>
              <div className={`w-3/5 max-w-8 rounded-t-md ${TONE[point.tone].bar}`} style={{ height: Math.max(3, Math.round(fractions[index]! * BAR_V_HEIGHT)) }} />
            </div>
            <span className="mt-1 max-w-full truncate text-[12px] font-semibold">{point.label}</span>
            {point.note ? <span className="max-w-full truncate text-[11px] text-on-surface-variant">{point.note}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ chart }: { chart: Chart }) {
  const values = chart.points.map((point) => point.value);
  const path = linePath(values, LINE.width, LINE.height);
  const [lastX, lastY] = path.split(' ').pop()!.replace(/^[ML]/, '').split(',').map(Number);
  const top = Math.max(...values);
  const span = top - Math.min(...values) || 1;
  const thresholdY = chart.threshold ? ((top - chart.threshold.value) / span) * LINE.height : null;
  return (
    <div data-testid="bloque-grafico-linea">
      <svg viewBox={`-4 -4 ${LINE.width + 8} ${LINE.height + 8}`} preserveAspectRatio="none" className="h-24 w-full" role="img" aria-label={`${chart.points[0]!.label} a ${chart.points.at(-1)!.label}`}>
        {thresholdY !== null && thresholdY >= 0 && thresholdY <= LINE.height ? <line x1={0} x2={LINE.width} y1={thresholdY} y2={thresholdY} className="stroke-error" strokeDasharray="4 4" strokeWidth={1} /> : null}
        <path d={path} className="stroke-primary" strokeWidth={2} fill="none" />
        <circle cx={lastX} cy={lastY} r={4} className="fill-primary" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px]">
        <span className="text-on-surface-variant">{chart.points[0]!.label}</span>
        <span className="font-semibold">{chart.points.at(-1)!.label} · {shown(chart.points.at(-1)!, chart.unit)}</span>
      </div>
    </div>
  );
}

export function BlockChart({ chart }: { chart: Chart }) {
  if (chart.kind === 'bar-v') return <BarsV chart={chart} />;
  if (chart.kind === 'line') return <LineChart chart={chart} />;
  return <BarsH chart={chart} />;
}
