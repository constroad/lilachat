import { isFigure, type BotBlock } from '@lilachat/shared';

type StatBlock = Extract<BotBlock, { type: 'stat' }>;
type SectionBlock = Extract<BotBlock, { type: 'section' }>;
type TilesBlock = Extract<BotBlock, { type: 'tiles' }>;

const SMALL_CAPS = 'text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant';

/** The inset figure (Stitch a10): caption on top, label on the left, the big value on the right. */
export function BlockStat({ block }: { block: StatBlock }) {
  return (
    <div data-testid="bloque-estadistica" className="rounded-xl border border-outline/15 bg-background px-3 py-2.5">
      {block.caption ? <p className="break-words border-b border-outline/10 pb-2 text-[12px] text-on-surface-variant">{block.caption}</p> : null}
      <div className={`flex flex-wrap items-baseline justify-between gap-x-3 ${block.caption ? 'pt-2' : ''}`}>
        <span className={`break-words ${SMALL_CAPS}`}>{block.label}</span>
        <span className="text-[26px] font-bold leading-8 tabular-nums">{block.value}{block.unit ? <span className="ml-1 text-[15px] font-semibold text-on-surface-variant">{block.unit}</span> : null}</span>
      </div>
    </div>
  );
}

/** A section header; a figure on the right reads as a total, any other text as a note. */
export function BlockSection({ block }: { block: SectionBlock }) {
  const aside = block.aside;
  return (
    <div data-testid="bloque-seccion" className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-outline/10 pb-1.5">
      <span className={`break-words ${SMALL_CAPS}`}>{block.title}</span>
      {aside ? <span className={`break-words text-[12px] ${isFigure(aside) ? 'font-bold tabular-nums text-on-surface' : 'text-on-surface-variant'}`}>{aside}</span> : null}
    </div>
  );
}

/** Materials as a grid of two: the label over its value, so a long name wraps instead of being cut. */
export function BlockTiles({ block }: { block: TilesBlock }) {
  return (
    <div data-testid="bloque-casillas" className="grid grid-cols-2 gap-2">
      {block.items.map((tile, index) => (
        <div key={`${tile.label}-${index}`} className="min-w-0 rounded-lg border border-outline/15 px-2.5 py-2">
          <p className="break-words text-[12px] text-on-surface-variant">{tile.label}</p>
          <p className="break-words text-[15px] font-semibold tabular-nums">{tile.value}</p>
        </div>
      ))}
    </div>
  );
}
