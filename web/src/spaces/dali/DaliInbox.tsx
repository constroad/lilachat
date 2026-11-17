import { useMemo, useState, type ReactNode } from 'react';
import { CalendarClock, ChevronDown, ChevronRight, FolderOpen, MessagesSquare } from 'lucide-react';
import { arrivedThisMonth, followUpsOf, inboxOf, type InboxView, type ProspectView } from '@lilachat/shared';
import { ChatRow } from '../../chat/FilaDeChat';
import type { ChatAction } from '../../chat/menuDelChat';
import type { ChatSummary } from '../../chat/types';
import { EmptyNote, Kicker, Segmented, SkeletonRows, TextButton } from './daliParts';
import { ProspectRow } from './ProspectRow';
import type { ProspectList } from './prospectsApi';

type Props = {
  list: ProspectList | null;
  failed: boolean;
  onRetry: () => void;
  /** The space's chats: the unread of each prospect, and the team's own chats folded at the foot. */
  chats: ChatSummary[] | null;
  yo: string;
  selectedChatId: string | null;
  service?: string;
  onService: (key: string | undefined) => void;
  now: Date;
  phone?: boolean;
  onOpenProspect: (prospect: ProspectView) => void;
  onOpenChat: (chat: ChatSummary) => void;
  onChatAction: (chat: ChatSummary, action: ChatAction) => void;
  onFollowUps: () => void;
};

/**
 * The inbox of a Dali space (dl-01 v3): on a phone, how many arrived this month (the header has no subtitle there); Míos · Sin asignar · Todos, the service filter (José 16/11), «Seguimientos de
 * hoy», the three sections, «Solo consultas» folded, and the team's own chats folded at the foot (a Dali space is
 * still a space: #general and the direct messages are not lost).
 */
export function DaliInbox(props: Props) {
  const { list, now } = props;
  const [chosen, setChosen] = useState<InboxView | null>(null);
  const prospects = useMemo(() => list?.prospects ?? [], [list]);
  const me = list?.me ?? props.yo;
  const view: InboxView = chosen ?? (inboxOf(prospects, { me, view: 'mine', service: props.service }, now).counts.mine > 0 ? 'mine' : 'all');
  const inbox = useMemo(() => inboxOf(prospects, { me, view, service: props.service }, now), [prospects, me, view, props.service, now]);
  const followUps = useMemo(() => followUpsOf(prospects, me, now), [prospects, me, now]);
  const unreadOf = useMemo(() => new Map((props.chats ?? []).map((chat) => [chat.id, chat.unread])), [props.chats]);
  const teamChats = useMemo(() => (props.chats ?? []).filter((chat) => !chat.prospect), [props.chats]);
  const row = (prospect: ProspectView) => <ProspectRow key={prospect.id} prospect={prospect} unread={unreadOf.get(prospect.chatId)} selected={prospect.chatId === props.selectedChatId} phone={props.phone} now={now} onOpen={() => props.onOpenProspect(prospect)} />;

  return (
    <div data-testid="bandeja-dali" className="space-y-4 px-4 py-4">
      {props.phone && list ? <p data-testid="llegados-mes" className="text-[13px] text-on-surface-variant">{`${arrivedThisMonth(prospects, now)} este mes · Dali contesta primero y te pasa los listos`}</p> : null}
      <Segmented
        testId="vista-bandeja"
        value={view}
        onChange={setChosen}
        segments={[
          { key: 'mine', label: 'Míos', count: inbox.counts.mine },
          { key: 'unassigned', label: 'Sin asignar', count: inbox.counts.unassigned },
          { key: 'all', label: 'Todos', count: inbox.counts.all },
        ]}
      />
      <ServiceFilter services={inbox.services} value={props.service} onChange={props.onService} />
      {followUps.items.length > 0 ? <FollowUpsCard count={followUps.items.length} late={followUps.overdue} onOpen={props.onFollowUps} /> : null}
      <InboxBody {...props} inbox={inbox} row={row} />
      <TeamChats chats={teamChats} yo={props.yo} selectedChatId={props.selectedChatId} onOpenChat={props.onOpenChat} onChatAction={props.onChatAction} />
    </div>
  );
}

function InboxBody(props: Props & { inbox: ReturnType<typeof inboxOf>; row: (prospect: ProspectView) => ReactNode }) {
  const { list, inbox } = props;
  if (!list && props.failed) return <EmptyNote title="No se pudo cargar la bandeja." action={<TextButton testId="reintentar-bandeja" onClick={props.onRetry}>Reintentar</TextButton>} />;
  if (!list) return <SkeletonRows />;
  if (inbox.sections.length === 0 && inbox.consults.length === 0) {
    return <EmptyNote title={list.prospects.length ? 'Nada en esta vista.' : 'Todavía no hay prospectos.'}>{list.prospects.length ? 'Prueba con «Todos» o con otro servicio.' : 'Cuando alguien escriba por WhatsApp, Dali le contesta primero y aparece aquí.'}</EmptyNote>;
  }
  return (
    <>
      {inbox.sections.map((section) => (
        <section key={section.key} data-testid={`seccion-${section.key}`} className="space-y-2.5">
          <Kicker>{`${section.label} · ${section.items.length}`}</Kicker>
          {section.items.map(props.row)}
        </section>
      ))}
      <Folded testId="solo-consultas" icon={<FolderOpen size={20} />} title={`Solo consultas · ${inbox.consults.length}`} hint="Dali las atiende solo y no ocupan al equipo" hidden={inbox.consults.length === 0}>
        {inbox.consults.map(props.row)}
      </Folded>
    </>
  );
}

function ServiceFilter(props: { services: { key: string; name: string; count: number }[]; value?: string; onChange: (key: string | undefined) => void }) {
  if (props.services.length < 2 && !props.value) return null;
  return (
    <label className="flex items-center gap-2 text-[13px] text-on-surface-variant">
      <span className="shrink-0">Servicio</span>
      <select data-testid="filtro-servicio" value={props.value ?? ''} onChange={(event) => props.onChange(event.target.value || undefined)} className="h-9 min-w-0 flex-1 rounded-lg border border-outline/30 bg-surface px-2 text-[13px] text-on-surface">
        <option value="">Todos los servicios</option>
        {props.services.map((service) => (
          <option key={service.key} value={service.key}>{`${service.name} · ${service.count}`}</option>
        ))}
      </select>
    </label>
  );
}

/** «Seguimientos de hoy» (dl-01 → dl-05): «atrasados» are follow-ups past their hour («vencido» is the funnel's). */
function FollowUpsCard({ count, late, onOpen }: { count: number; late: number; onOpen: () => void }) {
  return (
    <button type="button" data-testid="seguimientos-de-hoy" onClick={onOpen} className="flex w-full items-center gap-3 rounded-xl border border-outline/15 bg-surface px-4 py-3 text-left shadow-[inset_0_3px_0_rgb(var(--c-primary))] hover:border-outline/30">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><CalendarClock size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold">Seguimientos de hoy</span>
        <span className="block text-[13px] text-on-surface-variant">
          {`${count} para hoy`}
          {late > 0 ? <span className="font-semibold text-error">{` · ${late} ${late === 1 ? 'atrasado' : 'atrasados'}`}</span> : null}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-on-surface-variant" />
    </button>
  );
}

function Folded(props: { testId: string; icon: ReactNode; title: string; hint?: string; hidden?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (props.hidden) return null;
  return (
    <section className="rounded-xl border border-outline/15 bg-surface-variant/30">
      <button type="button" data-testid={props.testId} aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="shrink-0 text-on-surface-variant">{props.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">{props.title}</span>
          {props.hint ? <span className="block text-[13px] text-on-surface-variant">{props.hint}</span> : null}
        </span>
        <ChevronDown size={18} className={`shrink-0 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <div className="space-y-2.5 px-3 pb-3">{props.children}</div> : null}
    </section>
  );
}

function TeamChats(props: { chats: ChatSummary[]; yo: string; selectedChatId: string | null; onOpenChat: (chat: ChatSummary) => void; onChatAction: (chat: ChatSummary, action: ChatAction) => void }) {
  const unread = props.chats.reduce((total, chat) => total + (chat.unread > 0 ? 1 : 0), 0);
  return (
    <Folded testId="chats-del-equipo" icon={<MessagesSquare size={20} />} title={`Chats del equipo · ${props.chats.length}`} hint={unread > 0 ? `${unread} con mensajes sin leer` : 'Canales y mensajes directos del espacio'} hidden={props.chats.length === 0}>
      <div className="-mx-3 overflow-hidden rounded-lg bg-list">
        {props.chats.map((chat) => (
          <ChatRow key={chat.id} chat={chat} yo={props.yo} seleccionado={chat.id === props.selectedChatId} onSelect={() => props.onOpenChat(chat)} onAccion={props.onChatAction} />
        ))}
      </div>
    </Folded>
  );
}
