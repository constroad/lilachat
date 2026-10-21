import type { ReactNode } from 'react';
import type { MensajeEnPantalla } from '../types';

/** Side of a sticker in the conversation, like the app (160) and WhatsApp Web. */
const SIDE_IN_CHAT = 160;

/**
 * A sticker on the web (20/10): the image alone, no bubble, with the sender's
 * name in a group. Time and checks go below, like the rest; keeping it or
 * making it a favorite is in the message menu.
 */
export function StickerMessage({ message, url, author, quote }: { message: MensajeEnPantalla; url: string; author: ReactNode; quote?: ReactNode }) {
  return (
    <div className={message.estado === 'fallido' ? 'opacity-70' : ''}>
      {author}
      {/* A sticker sent as a reply shows what it answers above it, as WhatsApp does (20/10). */}
      {quote ? <div className="mb-1 max-w-[260px] rounded-xl border border-outline/15 bg-surface p-1.5 text-on-surface empty:hidden">{quote}</div> : null}
      <img data-testid={`sticker-${message.clientKey}`} src={url} alt="Sticker" loading="lazy" width={SIDE_IN_CHAT} height={SIDE_IN_CHAT} className="object-contain drop-shadow-sm" style={{ width: SIDE_IN_CHAT, height: SIDE_IN_CHAT }} />
    </div>
  );
}
