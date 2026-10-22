import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CornerUpLeft, MessagesSquare } from 'lucide-react';
import { ACTIVITY_TABS, activityDaySections, formatChatTimestamp, formatPhoneDisplay, type ActivityItem, type ActivityType } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';
import { FieldError, Overlay } from '../ui/Overlay';
import { TextoDelMensaje } from '../chat/TextoDelMensaje';
import { spaceActivity } from '../spaces/spacesApi';

const EMPTY: Record<ActivityType, string> = { mentions: 'Nadie te mencionó todavía.', threads: 'Todavía no estás en ningún hilo.', reactions: 'Todavía nadie reaccionó a tus mensajes.' };
const NO_NAMES: ReadonlyMap<string, string> = new Map();
const nameOf = (person: { name?: string; phone?: string }) => person.name?.trim() || (person.phone ? formatPhoneDisplay(person.phone) : 'Alguien');
const chatLabel = (item: ActivityItem) => (item.chat.channel ? `#${item.chat.name ?? ''}` : (item.chat.name ?? (item.chat.phone ? formatPhoneDisplay(item.chat.phone) : 'Conversación')));
const keyOf = (item: ActivityItem) => `${item.chatId}-${item.seq}`;

/**
 * «Menciones y actividad» of a space (design `e-19-menciones-actividad`):
 * Menciones · Hilos · Reacciones with what is new, by day; each card says who,
 * where and when, the message with its mentions, and opens the chat there.
 */
export function ActivityDialog(props: { spaceId: string; spaceName: string; jwt: string; myUserId: string; initialTab: ActivityType; onOpen: (item: ActivityItem) => void; onClose: () => void }) {
  const [tab, setTab] = useState<ActivityType>(props.initialTab);
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [unread, setUnread] = useState({ mentions: 0, threads: 0 });
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const response = await spaceActivity(props.jwt, props.spaceId, { type: tab });
    if (!response.ok) return setError(response.message);
    setError('');
    setItems(response.data.items);
    setUnread(response.data.unread);
  }, [props.jwt, props.spaceId, tab]);
  useEffect(() => {
    setItems(null);
    void load();
  }, [load]);
  const counts: Partial<Record<ActivityType, number>> = { mentions: unread.mentions, threads: unread.threads };

  return (
    <Overlay title={`Menciones y actividad · ${props.spaceName}`} onClose={props.onClose} wide>
      <div role="tablist" className="flex rounded-xl border border-outline/20 p-1">
        {ACTIVITY_TABS.map((option) => (
          <button key={option.type} type="button" role="tab" data-testid={`actividad-${option.type}`} aria-selected={tab === option.type} onClick={() => setTab(option.type)} className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold ${tab === option.type ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-background'}`}>
            {option.label}
            {counts[option.type] ? <span className={`rounded-full px-1.5 text-[11px] ${tab === option.type ? 'bg-on-primary/20' : 'bg-primary/10 text-primary'}`}>{counts[option.type]}</span> : null}
          </button>
        ))}
      </div>
      <FieldError>{error}</FieldError>
      {items === null && !error ? [0, 1].map((index) => <div key={index} className="mt-3 h-28 animate-pulse rounded-xl bg-background" />) : null}
      {items !== null && items.length === 0 ? <p className="mt-10 text-center text-sm text-on-surface-variant">{EMPTY[tab]}</p> : null}
      {activityDaySections(items ?? [], new Date()).map((section) => (
        <section key={section.title}>
          <div className="mb-2 mt-4 flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{section.title}</p>
            {section.items.some((item) => item.unread) ? <span className="rounded-full border border-primary/30 px-2 text-[11px] font-semibold text-primary">{`${section.items.filter((item) => item.unread).length} nuevas`}</span> : null}
          </div>
          {section.items.map((item) => (
            <article key={keyOf(item)} data-testid={`actividad-item-${keyOf(item)}`} className={`mb-3 rounded-xl border p-4 ${item.unread ? 'border-primary/40' : 'border-outline/15'}`}>
              <div className="flex items-start gap-3">
                <Avatar name={nameOf(item.author)} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="font-bold">{nameOf(item.author)}</span>
                    <span className="text-on-surface-variant">en</span>
                    <span className="rounded-md bg-primary/10 px-1.5 font-semibold text-primary">{chatLabel(item)}</span>
                    <span className="ml-auto text-[12px] text-on-surface-variant">{formatChatTimestamp(item.at)}</span>
                    {item.unread ? <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-label="Nueva" /> : null}
                  </p>
                  {item.body ? <div className="mt-1 text-sm"><TextoDelMensaje clave={`actividad-${keyOf(item)}`} texto={item.body} menciones={item.menciones} nombres={NO_NAMES} yo={props.myUserId} mio={false} /></div> : null}
                  {item.reactions?.length ? <p className="mt-2 flex flex-wrap gap-2">{item.reactions.map((reaction) => <span key={reaction.emoji} className="rounded-full border border-outline/20 px-2 text-sm">{`${reaction.emoji} ${reaction.count}`}</span>)}</p> : null}
                  <button type="button" data-testid={`responder-${keyOf(item)}`} onClick={() => props.onOpen(item)} className="mt-3 flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary">
                    {tab === 'threads' ? <MessagesSquare size={15} /> : <CornerUpLeft size={15} />}
                    {tab === 'threads' ? `${item.thread?.replies ?? 0} respuestas · Ver hilo` : tab === 'reactions' ? 'Ver en el chat' : 'Responder en el chat'}
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ))}
    </Overlay>
  );
}
