import { Paperclip } from 'lucide-react';
import type { BotBlock } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { BlockChart } from './BlockChart';
import { BlockTank } from './BlockTank';
import { TONE } from './tones';

function Rows({ rows }: { rows: Extract<BotBlock, { type: 'rows' }>['rows'] }) {
  return (
    <div data-testid="bloque-filas" className="divide-y divide-outline/10">
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`} className="flex min-h-[44px] flex-col justify-center py-2">
          <div className="flex items-center gap-3 text-[14px]">
            <span className="min-w-0 flex-1 truncate">{row.label}</span>
            {row.bar !== undefined ? <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-variant"><span className={`block h-full rounded-full ${TONE[row.tone].bar}`} style={{ width: `${Math.round(row.bar * 100)}%` }} /></span> : null}
            <span className={`text-[13px] font-semibold tabular-nums ${row.tone === 'neutral' ? '' : TONE[row.tone].text}`}>{row.value}</span>
          </div>
          {row.sub ? <span className="mt-0.5 text-[12px] text-on-surface-variant">{row.sub}</span> : null}
        </div>
      ))}
    </div>
  );
}

function Block({ block }: { block: BotBlock }) {
  switch (block.type) {
    case 'metric':
      return (
        <div data-testid="bloque-cifra">
          {block.label ? <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{block.label}</p> : null}
          <p className={`text-[26px] font-bold tabular-nums ${block.tone === 'neutral' ? '' : TONE[block.tone].text}`}>{block.value}{block.unit ? <span className="ml-1 text-[15px] font-semibold text-on-surface-variant">{block.unit}</span> : null}</p>
        </div>
      );
    case 'chips':
      return (
        <div data-testid="bloque-chips" className="flex gap-1.5">
          {block.items.map((chip) => (
            <div key={chip.label} className={`flex flex-1 flex-col items-center rounded-lg border px-1 py-1.5 ${TONE[chip.tone].soft}`}>
              <span className={`text-[12px] font-semibold ${TONE[chip.tone].text}`}>{chip.label}</span>
              {chip.sub ? <span className={`truncate text-[11px] ${TONE[chip.tone].text}`}>{chip.sub}</span> : null}
            </div>
          ))}
        </div>
      );
    case 'chart':
      return <BlockChart chart={block} />;
    case 'progress': {
      const percent = Math.round((block.value / block.max) * 100);
      return (
        <div data-testid="bloque-progreso">
          {/* Without a label the card's title is the headline (design r155): only the share is left above the bar. */}
          <div className="flex items-baseline justify-between">{block.label ? <span className="text-[15px] font-semibold">{block.label}: <span className="text-primary">{block.value}</span> de {block.max}</span> : <span />}<span className="text-[12px] text-on-surface-variant">{percent} %</span></div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-variant"><div className={`h-full rounded-full ${TONE[block.tone === 'neutral' ? 'info' : block.tone].bar}`} style={{ width: `${percent}%` }} /></div>
        </div>
      );
    }
    case 'tank':
      return <BlockTank items={block.items} />;
    case 'text':
      // A warning or an error is a tinted box (design r155: «3 faltan: …»); the rest, a plain line.
      return <p data-testid="bloque-texto" className={`text-[13px] ${block.tone === 'neutral' ? 'text-on-surface-variant' : TONE[block.tone].text} ${block.tone === 'warn' || block.tone === 'error' ? `rounded-lg border px-2.5 py-1.5 ${TONE[block.tone].soft}` : ''}`}>{block.text}</p>;
    case 'rows':
      return <Rows rows={block.rows} />;
    case 'people':
      return (
        <div data-testid="bloque-personas" className="flex items-center">
          {block.names.map((name, index) => <span key={`${name}-${index}`} className={index ? '-ml-1.5' : ''}><Avatar name={name} size={26} /></span>)}
          {block.more ? <span className="ml-2 text-[12px] text-on-surface-variant">+{block.more}</span> : null}
        </div>
      );
    case 'attachments':
      return (
        <a data-testid="bloque-adjuntos" href={block.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-full border border-outline/20 px-3 text-[13px] font-semibold hover:bg-background">
          <Paperclip size={14} className="text-on-surface-variant" /> {block.label}
        </a>
      );
  }
}

/** The kit's blocks (§118.4), one under the other with the card's rhythm. */
export function BotBlocksView({ blocks }: { blocks: readonly BotBlock[] }) {
  return <div className="flex flex-col gap-3">{blocks.map((block, index) => <Block key={`${block.type}-${index}`} block={block} />)}</div>;
}
