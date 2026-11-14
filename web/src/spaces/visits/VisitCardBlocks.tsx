import { ClipboardList, MapPin } from 'lucide-react';
import { figureParts, type BotBlock } from '@lilachat/shared';
import { TONE } from '../../chat/botBlocks/tones';

type TextBlock = Extract<BotBlock, { type: 'text' }>;
type TilesBlock = Extract<BotBlock, { type: 'tiles' }>;

/** «6 de 10»: the count bold, «de 10» small and grey (lv01). */
function FigureValue({ value, accent }: { value: string; accent: boolean }) {
  const { count, rest } = figureParts(value);
  const tone = accent ? 'text-primary' : 'text-on-surface';
  if (!rest) return <p className={`mt-0.5 break-words text-[20px] font-bold tabular-nums ${tone}`}>{value}</p>;
  return <p className={`mt-0.5 text-[20px] font-bold tabular-nums ${tone}`}>{count} <span className="font-mono text-[13px] font-normal text-on-surface-variant">{rest}</span></p>;
}

/**
 * A visit card's lines (Stitch lv01): the address with its pin under the title, and what is missing
 * as one line with «Pendiente» on its right. Any other tone stays a plain line.
 */
export function VisitText({ block }: { block: TextBlock }) {
  if (block.tone === 'warn' || block.tone === 'error') {
    return (
      <div data-testid="visita-falta" className="flex items-center gap-2 border-t border-outline/10 pt-2.5 text-[13px] text-on-surface-variant">
        <ClipboardList size={16} className={`shrink-0 ${TONE[block.tone].text}`} aria-hidden />
        <p className="min-w-0 flex-1 break-words">{block.text}</p>
        <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${TONE[block.tone].soft} ${TONE[block.tone].text}`}>Pendiente</span>
      </div>
    );
  }
  return (
    <p className="-mt-1 flex items-start gap-1.5 text-[13px] text-on-surface-variant">
      <MapPin size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden />
      <span data-testid="visita-direccion" className="min-w-0 break-words">{block.text}</span>
    </p>
  );
}

/** The figures in one bordered row, split by thin lines (lv01): kicker on top, the number under it. */
export function VisitFigures({ block }: { block: TilesBlock }) {
  return (
    <div data-testid="visita-cifras" className="flex divide-x divide-outline/15 rounded-[8px] bg-surface-variant/60">
      {block.items.map((tile, index) => (
        <div key={`${tile.label}-${index}`} className="min-w-0 flex-1 px-2 py-2.5 text-center">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">{tile.label}</p>
          <FigureValue value={tile.value} accent={/^puntos$/i.test(tile.label)} />
        </div>
      ))}
    </div>
  );
}
