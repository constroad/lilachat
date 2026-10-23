import { createPortal } from 'react-dom';
import { formatClock, type BotCard } from '@lilachat/shared';
import { Overlay } from '../../ui/Overlay';
import { BotBlocksView } from './BotBlocksView';

/** A card's detail on the web (§118.4): the same blocks the app shows in its sheet, in the window's overlay. */
export function BotCardDetail({ card, onClose }: { card: BotCard; onClose: () => void }) {
  if (!card.detail) return null;
  return createPortal(
    <Overlay title={card.detail.title} onClose={onClose} wide>
      <div data-testid="detalle-tarjeta" className="space-y-1">
        {card.kicker || card.updatedAt ? <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{[card.kicker, card.updatedAt ? `Actualizado ${formatClock(card.updatedAt)}` : ''].filter(Boolean).join(' · ')}</p> : null}
        <BotBlocksView blocks={card.detail.blocks} />
      </div>
    </Overlay>,
    document.body
  );
}
