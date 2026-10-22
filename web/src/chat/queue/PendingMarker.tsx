import { ClipboardCheck } from 'lucide-react';
import { usePendingInChat } from './pendingInChats';

/**
 * Something waits for me in this chat (José, 22/10): a late task, a poll to
 * vote, an event to answer, a reminder that rang. The list says so before
 * opening it; inside, the cards over the writing bar handle it.
 */
export function PendingMarker(props: { chatId: string }) {
  const count = usePendingInChat(props.chatId);
  if (count === 0) return null;
  return (
    <span data-testid={`pendiente-${props.chatId}`} title={`${count} ${count === 1 ? 'pendiente' : 'pendientes'} en este chat`} aria-label={`${count} ${count === 1 ? 'pendiente' : 'pendientes'} en este chat`} className="flex h-5 shrink-0 items-center gap-0.5 rounded-full border border-primary/40 bg-primary/10 px-1.5 text-[11px] font-bold text-primary">
      <ClipboardCheck size={12} />
      {count}
    </span>
  );
}
