import { BellOff, Pin } from 'lucide-react';
import { formatChatTimestamp, resolveChatPreview, textoDeAviso } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';
import { MenuDeChat } from './MenuDeChat';
import type { AccionDelChat } from './menuDelChat';
import type { ChatSummary } from './types';

/**
 * Una fila de la lista (W3a): avatar, nombre y hora; abajo la vista previa,
 * silenciado y lo sin leer. La flecha del menú va APARTE del botón de la fila
 * (un botón dentro de otro no es HTML válido y el lector de pantalla lo lee mal).
 */
export function FilaDeChat(props: { chat: ChatSummary; yo?: string; seleccionado: boolean; onSelect: () => void; onAccion: (chat: ChatSummary, accion: AccionDelChat) => void }) {
  const { chat } = props;
  const aviso = props.yo ? textoDelAviso(chat, props.yo) : '';
  const preview = resolveChatPreview({ typing: Boolean(chat.typingName), lastBody: aviso || chat.lastMessage?.body, lastKind: aviso ? 'text' : chat.lastMessage?.kind });
  return (
    <div className="group relative">
      <button
        type="button"
        data-testid={`chat-${chat.id}`}
        aria-current={props.seleccionado}
        onClick={props.onSelect}
        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${props.seleccionado ? 'bg-primary/10' : 'hover:bg-background'}`}
      >
        <Avatar name={chat.name ?? chat.phone} kind={chat.kind} online={chat.online} foto={chat.avatarUrl} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{chat.name ?? chat.phone ?? 'Conversación'}</span>
            {chat.pinned ? <Pin data-testid={`fijado-${chat.id}`} size={12} className="shrink-0 self-center text-on-surface-variant" /> : null}
            {chat.lastMessage ? (
              // El lugar de la flecha del menú: con el mouse o el foco encima, la hora le cede el espacio.
              <span className={`shrink-0 text-[11px] transition-opacity group-focus-within:opacity-0 group-hover:opacity-0 ${chat.unread > 0 ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}>
                {formatChatTimestamp(chat.lastMessage.at)}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className={`min-w-0 flex-1 truncate text-[13px] ${preview.style === 'typing' ? 'italic text-primary' : 'text-on-surface-variant'}`}>{preview.text}</span>
            {chat.muted ? <BellOff data-testid={`silenciado-${chat.id}`} size={14} className="shrink-0 text-on-surface-variant" /> : null}
            <MarcaDeSinLeer chat={chat} />
          </span>
        </span>
      </button>
      <div className="absolute right-3 top-2">
        <MenuDeChat chat={chat} onAccion={props.onAccion} />
      </div>
    </div>
  );
}

/** El número de sin leer, o el punto de «marcado como no leído» (sin número, como WhatsApp). */
function MarcaDeSinLeer({ chat }: { chat: ChatSummary }) {
  if (chat.unread > 0) {
    return (
      <span className={`grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full px-1.5 text-[11px] font-bold text-on-primary ${chat.muted ? 'bg-outline' : 'bg-primary'}`}>
        {chat.unread}
      </span>
    );
  }
  if (!chat.markedUnread) return null;
  return <span data-testid={`marca-no-leido-${chat.id}`} aria-label="Marcado como no leído" className="h-3 w-3 shrink-0 rounded-full bg-primary" />;
}

/**
 * La vista previa de un aviso («Fijaste un mensaje»), con el MISMO motor que
 * la conversación: el texto del server decía «902049935 fijó un mensaje».
 */
function textoDelAviso(chat: ChatSummary, yo: string): string {
  const ultimo = chat.lastMessage;
  if (ultimo?.kind !== 'system' || !ultimo.system) return '';
  const { system } = ultimo;
  const quien = ultimo.senderId !== yo && chat.kind === 'direct' ? chat.name : system.quien?.name ?? system.quien?.phone;
  return textoDeAviso({
    quien: quien ?? 'Alguien',
    esMio: ultimo.senderId === yo,
    evento: system.evento,
    aQuien: system.aQuien?.name ?? system.aQuien?.phone,
    aMi: system.targetId === yo,
    valor: system.valor,
  });
}
