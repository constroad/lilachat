import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { summaryHeadline, type PreviewReply } from '@lilachat/shared';
import { BotBlocksView } from '../botBlocks/BotBlocksView';

/** The app's summary by the button: one line with its figure and warnings; a click opens it, scrolling inside (Wilson 02/11: «el resumen tapa casi todo»). */
export function FormSummary({ blocks }: { blocks: PreviewReply['blocks'] }) {
  const [open, setOpen] = useState(false);
  const headline = summaryHeadline(blocks);
  const warns = headline.includes('aviso');
  return (
    <section data-testid="formulario-resumen" className="mb-3 rounded-2xl border border-outline/15">
      <button type="button" data-testid="formulario-resumen-abrir" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-11 w-full items-center gap-2 px-3 text-left">
        <span className={`min-w-0 flex-1 truncate text-[13px] font-semibold ${warns ? 'text-warning' : 'text-on-surface'}`}>{headline}</span>
        <ChevronDown size={16} className={`shrink-0 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <div className="max-h-[35vh] overflow-y-auto px-3 pb-3"><BotBlocksView blocks={blocks} /></div> : null}
    </section>
  );
}
