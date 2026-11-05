import { createPortal } from 'react-dom';
import { formatClock, type BotCard } from '@lilachat/shared';
import { Overlay } from '../../ui/Overlay';
import { BotBlocksView } from './BotBlocksView';
import { CardCommandContext, useCardCommand } from './cardCommand';

/** A card's detail on the web (§118.4): the same blocks the app shows in its sheet, in the window's overlay. */
export function BotCardDetail({ card, onClose }: { card: BotCard; onClose: () => void }) {
  const run = useCardCommand();
  if (!card.detail) return null;
  // A row's answer lands in the chat, behind this overlay: it closes first.
  const closeAndRun = run ? (line: string) => { onClose(); run(line); } : null;
  return createPortal(
    <CardCommandContext.Provider value={closeAndRun}>
    <Overlay title={card.detail.title} onClose={onClose} wide>
      <div data-testid="detalle-tarjeta" className="space-y-1">
        {card.kicker || card.updatedAt ? <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{[card.kicker, card.updatedAt ? `Actualizado ${formatClock(card.updatedAt)}` : ''].filter(Boolean).join(' · ')}</p> : null}
        <BotBlocksView blocks={card.detail.blocks} detail />
      </div>
    </Overlay>
    </CardCommandContext.Provider>,
    document.body
  );
}
