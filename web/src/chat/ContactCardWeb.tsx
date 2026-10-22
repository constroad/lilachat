import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { formatPhoneDisplay, type SharedContact } from '@lilachat/shared';
import { api } from '../api';
import { Avatar } from '../ui/Avatar';
import { openChatFromAnywhere } from './rutaDelChat';

/**
 * A contact shared in the chat (pending 9, José 20/10), like WhatsApp Web: the
 * name and phone, and «Enviar mensaje» when that number is on Lilachat. Adding
 * it to the phone book is the phone's: the web has no phone book.
 */
export function ContactCardWeb(props: { contact: SharedContact; mio: boolean; jwt: string; yo: string }) {
  const { contact } = props;
  const [error, setError] = useState('');
  const canWrite = Boolean(contact.userId) && contact.userId !== props.yo;
  const write = async () => {
    const chat = await api<{ chatId: string }>('/chats', { jwt: props.jwt, body: { kind: 'direct', memberIds: [contact.userId] } });
    if (chat.ok) openChatFromAnywhere(chat.data.chatId);
    else setError(chat.message);
  };
  return (
    <div data-testid="tarjeta-contacto" className="min-w-[220px]">
      <div className="flex items-center gap-3 py-1">
        <Avatar name={contact.name} size={40} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{contact.name}</p>
          <p className={`truncate text-[12px] ${props.mio ? 'opacity-80' : 'text-on-surface-variant'}`}>{formatPhoneDisplay(contact.phone) || contact.phone}</p>
        </div>
      </div>
      {canWrite ? (
        <button type="button" data-testid="contacto-enviar-mensaje" onClick={() => void write()} className={`mt-1 flex h-10 w-full items-center justify-center gap-1.5 border-t text-[13px] font-semibold ${props.mio ? 'border-white/20' : 'border-outline/15 text-primary'}`}>
          <MessageCircle size={15} />
          Enviar mensaje
        </button>
      ) : null}
      {error ? <p role="alert" className="text-[12px] text-error">{error}</p> : null}
    </div>
  );
}
