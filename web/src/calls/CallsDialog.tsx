import { useEffect, useState } from 'react';
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video, type LucideIcon } from 'lucide-react';
import { callDirection, callHistoryLabel, formatChatTimestamp, leerValorDeLlamada, type CallDirection, type CallHistoryEntry } from '@lilachat/shared';
import { api } from '../api';
import { FieldError, Overlay } from '../ui/Overlay';
import { Avatar } from '../ui/Avatar';
import type { ChatSummary } from '../chat/types';
import { useCalls } from './CallProvider';

const ARROW: Record<CallDirection, { Icon: LucideIcon; tone: string }> = {
  outgoing: { Icon: PhoneOutgoing, tone: 'text-on-surface-variant' },
  incoming: { Icon: PhoneIncoming, tone: 'text-on-surface-variant' },
  unanswered: { Icon: PhoneOutgoing, tone: 'text-on-surface-variant' },
  missed: { Icon: PhoneMissed, tone: 'text-error' },
};

/** The last answer, per session: reopening paints it at once and refreshes behind (another session never sees it). */
let remembered: { jwt: string; calls: CallHistoryEntry[] } | null = null;

/**
 * «Llamadas» from the web's rail (pending 38, José 21/10, like WhatsApp
 * Web): each chat's call lines, newest first. A row opens its chat; the
 * button on the right calls back with the same kind (voice or video).
 */
export function CallsDialog(props: { jwt: string; chatName: (line: CallHistoryEntry) => string; onOpen: (chatId: string) => void; onCall: (chatId: string, name: string, video: boolean) => void; onClose: () => void }) {
  const [calls, setCalls] = useState<CallHistoryEntry[] | null>(() => (remembered?.jwt === props.jwt ? remembered.calls : null));
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    void api<{ calls: CallHistoryEntry[] }>('/calls/history', { jwt: props.jwt }).then((response) => {
      if (!alive) return;
      if (response.ok) {
        remembered = { jwt: props.jwt, calls: response.data.calls };
        setCalls(response.data.calls);
      } else setError(response.message);
    });
    return () => {
      alive = false;
    };
  }, [props.jwt]);

  return (
    <Overlay title="Llamadas" onClose={props.onClose}>
      <FieldError>{error}</FieldError>
      {calls === null && !error ? [0, 1, 2].map((index) => <div key={index} className="mb-2 h-14 animate-pulse rounded-xl bg-background" />) : null}
      {calls?.length === 0 ? <p className="mt-10 text-center text-sm text-on-surface-variant">Todavía no hay llamadas.</p> : null}
      {calls?.map((line) => {
        const direction = callDirection(line);
        if (!direction) return null;
        const name = props.chatName(line);
        const video = leerValorDeLlamada(line.valor)?.video ?? false;
        const { Icon, tone } = ARROW[direction];
        return (
          <div key={`${line.chatId}-${line.seq}`} className="flex min-h-[60px] items-center gap-3 border-b border-outline/10">
            <button type="button" data-testid={`llamada-${line.chatId}-${line.seq}`} onClick={() => props.onOpen(line.chatId)} className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left hover:bg-background">
              <Avatar name={name} size={40} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-semibold ${direction === 'missed' ? 'text-error' : ''}`}>{name}</span>
                <span className="flex items-center gap-1 truncate text-[12px] text-on-surface-variant">
                  <Icon size={13} className={`shrink-0 ${tone}`} aria-hidden />
                  {callHistoryLabel(line)} · {formatChatTimestamp(line.at)}
                </span>
              </span>
            </button>
            <button type="button" data-testid={`llamar-${line.chatId}-${line.seq}`} aria-label={`${video ? 'Videollamada' : 'Llamar'} a ${name}`} title={`${video ? 'Videollamada' : 'Llamar'} a ${name}`} onClick={() => props.onCall(line.chatId, name, video)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary hover:bg-primary/10">
              {video ? <Video size={19} /> : <Phone size={19} />}
            </button>
          </div>
        );
      })}
    </Overlay>
  );
}

/** The dialog as the shell mounts it: names from the chats it has, calls through the session's call provider. */
export function CallsHistory(props: { jwt: string; chats: readonly ChatSummary[]; onOpen: (chatId: string) => void; onClose: () => void }) {
  const { call } = useCalls();
  // The list's name first (it knows the phone book); the server's while the list is not here yet.
  const chatName = (line: CallHistoryEntry) => {
    const chat = props.chats.find((one) => one.id === line.chatId);
    return chat?.name ?? line.title ?? chat?.phone ?? line.phone ?? 'Conversación';
  };
  return <CallsDialog jwt={props.jwt} chatName={chatName} onOpen={props.onOpen} onCall={call} onClose={props.onClose} />;
}
