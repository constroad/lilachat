import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, MessagesSquare } from 'lucide-react';
import type { ClientWorkspace, ProspectView } from '@lilachat/shared';
import type { ChatAction } from '../../chat/menuDelChat';
import type { ChatSummary } from '../../chat/types';
import { SpaceTitleMenu, type WorkspaceLink } from '../SpaceTitleMenu';
import { DaliFunnel } from './DaliFunnel';
import { DaliInbox } from './DaliInbox';
import { DaliKnowledgeSheet } from './DaliKnowledgeSheet';
import { DaliPanel } from './DaliPanel';
import { DaliReview } from './DaliReview';
import { SheetInColumn } from './daliParts';
import { FollowUpsSheet } from './FollowUpsSheet';
import { ProspectSheet, type SheetProps } from './ProspectSheet';
import { useProspects } from './useProspects';

export type DaliTab = 'inbox' | 'funnel' | 'panel' | 'review';
const TABS: { key: DaliTab; label: string }[] = [
  { key: 'inbox', label: 'Bandeja' },
  { key: 'funnel', label: 'Embudo' },
  { key: 'panel', label: 'Panel' },
  { key: 'review', label: 'Revisión' },
];
const MINUTE_MS = 60_000;
/** The ficha takes the inbox's third column from this width; below, it opens from the strip. */
const SHEET_COLUMN_MIN_WIDTH = 1280;
/** The tab of each space survives going to a conversation and back on a phone (the column unmounts). */
const lastTab = new Map<string, DaliTab>();

type Side = { kind: 'sheet'; prospect: ProspectView } | { kind: 'knowledge' } | { kind: 'followups' } | null;

type Props = {
  jwt: string;
  space: ClientWorkspace;
  yo: string;
  chats: ChatSummary[] | null;
  selectedChatId: string | null;
  onOpenChat: (chatId: string) => void;
  onChatAction: (chat: ChatSummary, action: ChatAction) => void;
  /** Desktop: the open conversation, already with its strip. A phone shows it full screen, outside this column. */
  conversation?: ReactNode;
  phone: boolean;
  width: number;
  onSwitch: () => void;
  onWorkspace: (link: WorkspaceLink) => void;
  elsewhere?: number;
  onNotice: (text: string) => void;
};

/** Labels like «hace 6 min» move on without asking the server: a re-render a minute, no request. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), MINUTE_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * A Dali space (BOTS-API fase 2, José 16/11 «pierdo los tabs»): one header and ONE tab bar for the whole space —
 * Bandeja · Embudo · Panel · Revisión —, «Lo que Dali sabe» as a header button. On a computer the inbox is
 * master-detail (list, conversation, ficha) and the other tabs open the ficha, the follow-ups and what Dali knows in a
 * side panel under the bar. On a phone each of those goes full screen with ←.
 */
export function DaliSpace(props: Props) {
  const { space, phone } = props;
  const prospects = useProspects(props.jwt, space.id);
  const now = useNow();
  const [tab, setTabState] = useState<DaliTab>(() => lastTab.get(space.id) ?? 'inbox');
  const [service, setService] = useState<string | undefined>();
  const [side, setSide] = useState<Side>(null);
  const setTab = (next: DaliTab) => {
    lastTab.set(space.id, next);
    setTabState(next);
    setSide(null);
  };
  const me = prospects.list?.me ?? props.yo;
  const list = prospects.list;
  const selectedProspect = useMemo(() => list?.prospects.find((one) => one.chatId === props.selectedChatId) ?? null, [list, props.selectedChatId]);
  const openProspectChat = (prospect: ProspectView) => {
    setSide(null);
    if (tab !== 'inbox') setTab('inbox');
    props.onOpenChat(prospect.chatId);
  };
  const sheetProps = { jwt: props.jwt, spaceId: space.id, me, now, onChanged: prospects.replace, onStale: prospects.reload, onNotice: props.onNotice };
  const shared = { list, now, service, onService: setService, onOpenProspect: (prospect: ProspectView) => setSide({ kind: 'sheet', prospect }) };

  return (
    <div data-testid="espacio-dali" className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background">
      <DaliHeader {...props} tab={tab} onTab={setTab} onKnowledge={() => setSide({ kind: 'knowledge' })} />
      <div className="relative flex min-h-0 flex-1">
        {tab === 'inbox' ? (
          <InboxTab {...props} prospects={prospects} me={me} now={now} service={service} onService={setService} selectedProspect={selectedProspect} sheetProps={sheetProps} onFollowUps={() => setSide({ kind: 'followups' })} />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === 'funnel' ? <DaliFunnel {...shared} phone={phone} /> : null}
            {tab === 'panel' ? <DaliPanel list={list} now={now} phone={phone} /> : null}
            {tab === 'review' ? <DaliReview jwt={props.jwt} spaceId={space.id} list={list} now={now} phone={phone} onOpenProspect={shared.onOpenProspect} onOpenChat={props.onOpenChat} onNotice={props.onNotice} /> : null}
          </div>
        )}
        {side ? (
          <SidePanel phone={phone} onClose={() => setSide(null)}>
            {side.kind === 'sheet' ? <ProspectSheet {...sheetProps} prospect={list?.prospects.find((one) => one.id === side.prospect.id) ?? side.prospect} phone={phone} onClose={() => setSide(null)} onOpenConversation={() => openProspectChat(side.prospect)} /> : null}
            {side.kind === 'knowledge' ? <DaliKnowledgeSheet jwt={props.jwt} spaceId={space.id} list={list} now={now} phone={phone} onClose={() => setSide(null)} onNotice={props.onNotice} /> : null}
            {side.kind === 'followups' ? <FollowUpsSheet {...sheetProps} list={list} phone={phone} onOpenProspect={openProspectChat} onClose={() => setSide(null)} /> : null}
          </SidePanel>
        ) : null}
      </div>
    </div>
  );
}

function DaliHeader(props: Props & { tab: DaliTab; onTab: (tab: DaliTab) => void; onKnowledge: () => void }) {
  return (
    <header className="shrink-0 border-b border-outline/15 bg-surface">
      <div className="flex items-center gap-3 px-4 pt-3">
        <SpaceTitleMenu space={props.space} onOpen={props.onWorkspace} onSwitch={props.onSwitch} phone={props.phone} elsewhere={props.elsewhere} subtitle={props.phone ? '' : 'Prospectos de WhatsApp · Dali contesta primero'} />
        <button type="button" data-testid="lo-que-dali-sabe" aria-label="Lo que Dali sabe" onClick={props.onKnowledge} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-outline/30 px-3 text-[13px] font-semibold hover:bg-background">
          <BookOpen size={18} />
          {props.phone ? null : 'Lo que Dali sabe'}
        </button>
      </div>
      <nav role="tablist" aria-label="Secciones de Dali" className="mt-2 flex px-2">
        {TABS.map((tab) => (
          <button key={tab.key} type="button" role="tab" data-testid={`pestana-${tab.key}`} aria-selected={props.tab === tab.key} onClick={() => props.onTab(tab.key)} className={`h-11 min-w-0 flex-1 border-b-2 px-3 text-[14px] font-semibold sm:flex-none ${props.tab === tab.key ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

function InboxTab(props: Props & { prospects: ReturnType<typeof useProspects>; me: string; now: Date; service?: string; onService: (key: string | undefined) => void; selectedProspect: ProspectView | null; sheetProps: Omit<SheetProps, 'prospect'>; onFollowUps: () => void }) {
  const inbox = (
    <DaliInbox
      list={props.prospects.list}
      failed={props.prospects.failed}
      onRetry={props.prospects.reload}
      chats={props.chats}
      yo={props.yo}
      selectedChatId={props.selectedChatId}
      service={props.service}
      onService={props.onService}
      now={props.now}
      phone={props.phone}
      onOpenProspect={(prospect) => props.onOpenChat(prospect.chatId)}
      onOpenChat={(chat) => props.onOpenChat(chat.id)}
      onChatAction={props.onChatAction}
      onFollowUps={props.onFollowUps}
    />
  );
  if (props.phone) return <div className="min-h-0 flex-1 overflow-y-auto">{inbox}</div>;
  const sheetInColumn = props.width >= SHEET_COLUMN_MIN_WIDTH && props.selectedProspect !== null;
  return (
    <>
      <aside className="w-[380px] shrink-0 overflow-y-auto border-r border-outline/15 bg-list">{inbox}</aside>
      <div className="flex min-w-0 flex-1">
        <SheetInColumn.Provider value={sheetInColumn}>{props.conversation ?? <PickOne />}</SheetInColumn.Provider>
      </div>
      {sheetInColumn && props.selectedProspect ? (
        <aside data-testid="columna-ficha" className="w-[360px] shrink-0 border-l border-outline/15">
          <ProspectSheet {...props.sheetProps} prospect={props.selectedProspect} resultInHeader />
        </aside>
      ) : null}
    </>
  );
}

function PickOne() {
  return (
    <div className="grid min-w-0 flex-1 place-items-center px-6 text-center">
      <div>
        <MessagesSquare size={32} className="mx-auto text-on-surface-variant" />
        <p className="mt-2 text-sm font-semibold">Elige un prospecto</p>
        <p className="text-[13px] text-on-surface-variant">Su conversación y su ficha se abren aquí.</p>
      </div>
    </div>
  );
}

/** Under the tab bar on a computer (the content dimmed behind); full screen on a phone. */
function SidePanel({ phone, onClose, children }: { phone: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (phone) return createPortal(<div data-testid="panel-lateral-dali" className="fixed inset-0 z-30 flex flex-col bg-background">{children}</div>, document.body);
  return (
    <div className="absolute inset-0 z-20 flex justify-end bg-black/30" onClick={onClose}>
      <div data-testid="panel-lateral-dali" className="flex h-full w-full max-w-[440px] flex-col bg-background shadow-2xl" onClick={(event) => event.stopPropagation()}>{children}</div>
    </div>
  );
}
