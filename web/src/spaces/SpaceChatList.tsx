import { useMemo, useState } from 'react';
import { Archive, AtSign, ChevronDown, ChevronRight, Copy, Hash, Inbox, Lock, MessagesSquare, PanelLeftClose, Plus, Search, Settings, Settings2, UserCog, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { canManageMembers, formatChatTimestamp, membersLabel, spaceSections, spaceSubtitle, splitArchived, type ActivityType, type ClientWorkspace, type SpaceSectionKey } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';
import { ChatRow } from '../chat/FilaDeChat';
import { copiarTexto } from '../chat/copiarTexto';
import type { ChatAction } from '../chat/menuDelChat';
import type { ChatSummary } from '../chat/types';
import { SpaceLogo } from './SpaceLogo';
import { PendingMarker } from '../chat/queue/PendingMarker';
import { AppsSection } from './apps/AppsSection';
import { SpaceQuickActions } from './apps/SpaceQuickActions';
import type { SpaceApps } from './apps/useSpaceApps';

export type WorkspaceLink = 'directory' | 'members' | 'requests' | 'settings';

type Props = {
  space: ClientWorkspace;
  /** `null` while the first load is on its way. */
  chats: ChatSummary[] | null;
  failed: boolean;
  onRetry: () => void;
  yo: string;
  me: { name?: string | null; phone: string };
  selectedChatId: string | null;
  onOpenChat: (chat: ChatSummary) => void;
  onAccion: (chat: ChatSummary, accion: ChatAction) => void;
  onSwitch: () => void;
  onChannels: () => void;
  onInvite: () => void;
  onWorkspace: (link: WorkspaceLink) => void;
  onNewDirect: () => void;
  /** New mentions and threads, and «Menciones y actividad» (design e-19). */
  activity?: { mentions: number; threads: number };
  onActivity?: (tab: ActivityType) => void;
  /** The foot with me and «Ajustes»: only without the rail. */
  onSettings?: () => void;
  width?: number;
  onCollapse?: () => void;
  /** «Apps» (design e-23) and its directory. */
  apps?: SpaceApps;
  /** The ⚡ of the header (design e-30) asks the space's apps for their actions. */
  jwt?: string;
};

/**
 * The left panel inside a company space, like Slack (design
 * `s-03-lista-con-secciones`): the space's name opens the switcher, CANALES as
 * short rows with «Agregar canal», GRUPOS and MENSAJES DIRECTOS as in the
 * personal list, each section folded with its arrow, and the code to copy at
 * the foot. The design's Hilos and Menciones chips come with the mentions tab.
 */
export function SpaceChatList(props: Props) {
  const { space, chats } = props;
  const [query, setQuery] = useState('');
  const [folded, setFolded] = useState<ReadonlySet<SpaceSectionKey>>(new Set());
  const [copied, setCopied] = useState(false);
  const [openArchived, setOpenArchived] = useState(false);
  // An archived chat leaves the sections, like in the personal list; «Archivados» shows them.
  const split = useMemo(() => splitArchived(chats ?? [], openArchived), [chats, openArchived]);
  const sections = useMemo(() => {
    const text = query.trim().toLowerCase();
    const visible = split.shown.filter((chat) => !text || (chat.name ?? chat.phone ?? '').toLowerCase().includes(text));
    return spaceSections(visible.map((chat) => ({ ...chat, lastAt: chat.lastMessage?.at })));
  }, [split, query]);
  const toggle = (key: SpaceSectionKey) => setFolded((before) => {
    const next = new Set(before);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const copyCode = async () => {
    if (space.joinCode && (await copiarTexto(space.joinCode))) setCopied(true);
  };

  return (
    <aside data-testid="panel-espacio" className={`flex h-full w-full min-w-0 flex-col bg-surface ${props.width ? 'shrink-0' : 'border-r border-outline/15 md:w-[340px] md:shrink-0 lg:w-[400px]'}`} style={props.width ? { width: props.width } : undefined}>
      <header className="flex items-center gap-2 px-4 py-3">
        <button type="button" data-testid="titulo-espacio" aria-label="Cambiar de espacio" onClick={props.onSwitch} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left">
          <SpaceLogo space={space} size={36} />
          <span className="min-w-0">
            <span className="flex items-center gap-1"><span className="truncate text-base font-extrabold tracking-tight">{space.name}</span><ChevronDown size={16} className="shrink-0 text-on-surface-variant" /></span>
            <span className="block truncate text-[12px] text-on-surface-variant">{spaceSubtitle(space, { membersFirst: true })}</span>
          </span>
        </button>
        {props.jwt ? <SpaceQuickActions jwt={props.jwt} spaceId={space.id} spaceName={space.name} /> : null}
        <button type="button" data-testid="btn-invitar-espacio" aria-label="Invitar personas" title="Invitar personas" onClick={props.onInvite} className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-background">
          <UserPlus size={18} />
        </button>
        {props.onCollapse ? (
          <button type="button" aria-label="Plegar la lista" title="Plegar la lista" onClick={props.onCollapse} className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-background">
            <PanelLeftClose size={18} />
          </button>
        ) : null}
      </header>
      <div className="px-3 pb-2">
        <label className="flex items-center gap-2 rounded-full bg-background px-3 py-2">
          <Search size={16} className="shrink-0 text-on-surface-variant" />
          <input data-testid="buscar-en-espacio" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Buscar en ${space.name}`} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-on-surface-variant" />
        </label>
      </div>
      {props.onActivity ? (
        <div className="flex gap-2 px-3 pb-2">
          <ActivityChip testId="chip-hilos" Icon={MessagesSquare} label="Hilos" count={props.activity?.threads ?? 0} onClick={() => props.onActivity?.('threads')} />
          <ActivityChip testId="chip-menciones" Icon={AtSign} label="Menciones" count={props.activity?.mentions ?? 0} onClick={() => props.onActivity?.('mentions')} />
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        <WorkspaceLinks space={space} onOpen={props.onWorkspace} />
        {props.failed && chats === null ? (
          <button type="button" onClick={props.onRetry} className="mx-3 mt-2 w-[calc(100%-24px)] rounded-xl bg-error/10 px-4 py-3 text-left text-[13px] text-error">No se pudo cargar el espacio. Toca para reintentar.</button>
        ) : null}
        {chats === null && !props.failed ? <div data-testid="espacio-cargando" className="space-y-2 px-3 pt-1">{[0, 1, 2, 3].map((index) => <div key={index} className="h-10 animate-pulse rounded-lg bg-background" />)}</div> : null}
        {chats !== null && chats.length === 0 && !query ? (
          <div data-testid="espacio-vacio" className="mx-3 mt-2 rounded-xl border border-outline/15 p-4">
            <p className="font-bold">{`Bienvenido a ${space.name}`}</p>
            <p className="mt-1 text-[13px] text-on-surface-variant">Únete a un canal o crea el primero, e invita a tu equipo.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" data-testid="espacio-ver-canales" onClick={props.onChannels} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-on-primary"><Hash size={15} /> Canales</button>
              <button type="button" data-testid="espacio-invitar" onClick={props.onInvite} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-outline/25 text-sm font-semibold"><UserPlus size={15} className="text-primary" /> Invitar</button>
            </div>
          </div>
        ) : null}
        {chats !== null && (chats.length > 0 || query)
          ? sections.map((section) => section.key === 'apps' ? (
              props.apps ? <AppsSection key="apps" chats={section.chats} apps={props.apps} folded={folded.has('apps')} onToggle={() => toggle('apps')} selectedChatId={props.selectedChatId} onOpenChat={props.onOpenChat} /> : null
            ) : (
              <section key={section.key} data-testid={`seccion-${section.key}`} className="pt-1">
                <div className="flex items-center pr-2">
                  <button type="button" data-testid={`plegar-${section.key}`} aria-expanded={!folded.has(section.key)} onClick={() => toggle(section.key)} className="flex h-10 flex-1 items-center gap-1.5 px-4 text-left">
                    {folded.has(section.key) ? <ChevronRight size={14} className="text-on-surface-variant" /> : <ChevronDown size={14} className="text-on-surface-variant" />}
                    <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{section.title}</span>
                    <span className="text-[11px] text-on-surface-variant">{section.chats.length}</span>
                  </button>
                  {section.key === 'groups' ? null : (
                    <button type="button" data-testid={`nuevo-${section.key}`} aria-label={NEW_IN_SECTION[section.key]} title={NEW_IN_SECTION[section.key]} onClick={section.key === 'channels' ? props.onChannels : props.onNewDirect} className="grid h-8 w-8 place-items-center rounded-full text-on-surface-variant hover:bg-background"><Plus size={16} /></button>
                  )}
                </div>
                {folded.has(section.key)
                  ? null
                  : section.chats.map((chat) =>
                      section.key === 'channels' ? (
                        <ChannelRow key={chat.id} chat={chat} open={chat.id === props.selectedChatId} onOpen={() => props.onOpenChat(chat)} />
                      ) : (
                        <ChatRow key={chat.id} chat={chat} yo={props.yo} seleccionado={chat.id === props.selectedChatId} onSelect={() => props.onOpenChat(chat)} onAccion={props.onAccion} />
                      )
                    )}
                {section.key === 'channels' && !folded.has('channels') ? (
                  <button type="button" data-testid="agregar-canal" onClick={props.onChannels} className="flex h-10 w-full items-center gap-3 px-4 text-sm text-on-surface-variant hover:bg-background"><Plus size={16} /> Agregar canal</button>
                ) : null}
              </section>
            ))
          : null}
        {split.archived > 0 ? (
          <button type="button" data-testid="espacio-archivados" onClick={() => setOpenArchived((open) => !open)} className="flex h-10 w-full items-center gap-2.5 border-t border-outline/10 px-4 text-left text-sm text-on-surface-variant hover:bg-background">
            <Archive size={16} />
            {openArchived ? 'Volver a los chats del espacio' : `Archivados (${split.archived})`}
          </button>
        ) : null}
      </div>
      {space.joinCode ? (
        <div className="flex items-center gap-2 border-t border-outline/15 px-4 py-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Código</span>
          <span data-testid="codigo-del-espacio" className="rounded-md border border-outline/20 px-2 py-0.5 font-mono text-[13px] font-semibold text-primary">{space.joinCode}</span>
          <button type="button" data-testid="copiar-codigo-del-espacio" onClick={() => void copyCode()} className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-primary hover:bg-background"><Copy size={14} /> {copied ? 'Copiado' : 'Copiar'}</button>
        </div>
      ) : null}
      {props.onSettings ? (
      <footer className="flex items-center gap-3 border-t border-outline/15 bg-primary/5 px-4 py-3">
        <Avatar name={props.me.name ?? props.me.phone} size={36} />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{props.me.name ?? props.me.phone}</p>
        <button type="button" aria-label="Ajustes" onClick={props.onSettings} className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-surface"><Settings size={18} /></button>
      </footer>
      ) : null}
    </aside>
  );
}

function ActivityChip(props: { testId: string; Icon: LucideIcon; label: string; count: number; onClick: () => void }) {
  return (
    <button type="button" data-testid={props.testId} onClick={props.onClick} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-outline/20 text-sm font-semibold hover:bg-background">
      <props.Icon size={15} className="text-primary" />
      {props.label}
      {props.count > 0 ? <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary">{props.count}</span> : null}
    </button>
  );
}

/** A space creates channels, not groups (pending 109, José 28/10): the groups section has no «+». */
const NEW_IN_SECTION: Record<Exclude<SpaceSectionKey, 'groups'>, string> = { channels: 'Agregar canal', directs: 'Nuevo mensaje directo', apps: 'Agregar apps' };

/**
 * «Espacio de trabajo» on top of the list (desktop designs `e1-05`, `e1-06`):
 * the directory for everyone; members and roles, requests (with how many
 * wait) and the settings for those who manage the space.
 */
function WorkspaceLinks(props: { space: ClientWorkspace; onOpen: (link: WorkspaceLink) => void }) {
  const admin = canManageMembers(props.space.role);
  const pending = props.space.pendingRequests ?? 0;
  const row = (link: WorkspaceLink, Icon: LucideIcon, label: string, trailing?: string, highlight?: boolean) => (
    <button key={link} type="button" data-testid={`espacio-${link}`} onClick={() => props.onOpen(link)} className="flex h-10 w-full items-center gap-2.5 px-4 text-left text-sm hover:bg-background">
      <Icon size={16} className={highlight ? 'text-primary' : 'text-on-surface-variant'} />
      <span className={`min-w-0 flex-1 truncate ${highlight ? 'font-bold' : ''}`}>{label}</span>
      {trailing ? <span className={highlight ? 'grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary' : 'text-[11px] text-on-surface-variant'}>{trailing}</span> : null}
    </button>
  );
  return (
    <section data-testid="seccion-espacio-de-trabajo" className="pb-1">
      <p className="px-4 pb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Espacio de trabajo</p>
      {row('directory', Users, 'Directorio de equipo', membersLabel(props.space.members))}
      {admin ? row('members', UserCog, 'Miembros y roles') : null}
      {admin && pending > 0 ? row('requests', Inbox, 'Solicitudes', String(pending), true) : null}
      {admin ? row('settings', Settings2, 'Ajustes del espacio') : null}
    </section>
  );
}

/** A channel as a short row (design `s-03`): «# name», bold with something new, and its count or time. */
function ChannelRow(props: { chat: ChatSummary; open: boolean; onOpen: () => void }) {
  const { chat } = props;
  const unread = chat.unread > 0;
  const Icon = chat.channel?.visibility === 'private' ? Lock : Hash;
  return (
    <button type="button" data-testid={`canal-fila-${chat.id}`} aria-current={props.open} onClick={props.onOpen} className={`flex h-10 w-full items-center gap-2.5 px-4 text-left ${props.open ? 'bg-primary/10 text-primary' : 'hover:bg-background'}`}>
      <Icon size={16} className={unread || props.open ? 'text-primary' : 'text-on-surface-variant'} />
      <span className={`min-w-0 flex-1 truncate text-sm ${unread ? 'font-bold' : ''}`}>{chat.name}</span>
      <PendingMarker chatId={chat.id} />
      {unread ? (
        <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary">{chat.unread}</span>
      ) : chat.lastMessage ? (
        <span className="text-[11px] text-on-surface-variant">{formatChatTimestamp(chat.lastMessage.at)}</span>
      ) : null}
    </button>
  );
}
