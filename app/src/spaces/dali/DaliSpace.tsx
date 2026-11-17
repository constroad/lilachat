import { memo, useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import type { ClientWorkspace, ProspectView } from '@lilachat/shared';
import type { ChatSummary } from '../../api/client';
import { openChatNow } from '../../chat/openChatNow';
import { useColores } from '../../ui/tema';
import { useAlVolver } from '../../ui/useAlVolver';
import { useDisposicion } from '../../ui/useDisposicion';
import { fetchSpaceChats, spaceChatsCache, useCached } from '../spaceCache';
import { findSpaceChat } from '../spacesApi';
import { useSpaceChatsLive } from '../useSpaceChatsLive';
import { DaliFunnel } from './DaliFunnel';
import { DaliInbox } from './DaliInbox';
import { DaliKnowledgeScreen } from './DaliKnowledgeScreen';
import { DaliPanel } from './DaliPanel';
import { DaliReview } from './DaliReview';
import { EmptyNote, TextButton, useNow } from './daliParts';
import { FollowUpsScreen } from './FollowUpsScreen';
import { ProspectSheetScreen } from './ProspectSheetScreen';
import { useProspects, type Prospects } from './useProspects';

export type DaliTab = 'inbox' | 'funnel' | 'panel' | 'review';
const TABS: { key: DaliTab; label: string }[] = [
  { key: 'inbox', label: 'Bandeja' },
  { key: 'funnel', label: 'Embudo' },
  { key: 'panel', label: 'Panel' },
  { key: 'review', label: 'Revisión' },
];
/** The tab of each space survives opening a conversation and coming back. */
const lastTab = new Map<string, DaliTab>();

type Overlay = { kind: 'sheet'; prospect: ProspectView } | { kind: 'knowledge' } | { kind: 'followups' } | null;

type Props = { space: ClientWorkspace; jwt: string; myUserId: string; active: boolean; openChatId: string | null; onOpenChat: (chat: ChatSummary) => void };

/** «Lo que Dali sabe» lives in the shell's header (dl-01 v3): the button only knocks; the space opens the screen. */
const knowledgeKnocks = new Set<(spaceId: string) => void>();

export function DaliKnowledgeButton({ spaceId }: { spaceId: string }) {
  const colors = useColores();
  return (
    <Pressable testID="lo-que-dali-sabe" accessibilityRole="button" accessibilityLabel="Lo que Dali sabe" onPress={() => knowledgeKnocks.forEach((knock) => knock(spaceId))} className="h-11 w-11 items-center justify-center">
      <BookOpen size={22} color={colors['on-surface-variant']} />
    </Pressable>
  );
}

function useKnowledgeKnock(spaceId: string, open: () => void): void {
  useEffect(() => {
    const knock = (target: string) => {
      if (target === spaceId) open();
    };
    knowledgeKnocks.add(knock);
    return () => {
      knowledgeKnocks.delete(knock);
    };
  }, [spaceId, open]);
}

/**
 * The space's chats (the unread of each prospect, and the team's own chats folded at the inbox's foot): the same
 * cache and live events as the space's list, which a Dali space shows instead.
 */
function useSpaceChats(jwt: string, spaceId: string, myUserId: string, active: boolean) {
  const key = `${spaceId}:chats`;
  const { dosPaneles } = useDisposicion();
  const page = useCached(spaceChatsCache, key, fetchSpaceChats(jwt, spaceId), true, () => openChatNow() !== null && !dosPaneles);
  const load = useCallback(async () => {
    await spaceChatsCache.revalidate(key, fetchSpaceChats(jwt, spaceId), { force: true });
  }, [key, jwt, spaceId]);
  const { refresh } = page;
  useAlVolver(active, () => refresh());
  useSpaceChatsLive(key, myUserId, load);
  return { chats: page.value?.chats ?? null, load };
}

/**
 * A Dali space on the APK (BOTS-API fase 2, prototype v3): the shell keeps its header and bottom bar, and the Chats
 * tab becomes ONE tab bar — Bandeja · Embudo · Panel · Revisión. A prospect's row opens its conversation (dl-02);
 * the ficha, the follow-ups and what Dali knows open full screen with ←.
 */
export function DaliSpace(props: Props) {
  const { space, jwt } = props;
  const prospects = useProspects(jwt, space.id);
  const now = useNow(props.active);
  const [tab, setTabState] = useState<DaliTab>(() => lastTab.get(space.id) ?? 'inbox');
  const [service, setService] = useState<string | undefined>();
  const [overlay, setOverlay] = useState<Overlay>(null);
  const { chats, load } = useSpaceChats(jwt, space.id, props.myUserId, props.active);
  const close = useCallback(() => setOverlay(null), []);
  useKnowledgeKnock(space.id, useCallback(() => setOverlay({ kind: 'knowledge' }), []));
  const setTab = (next: DaliTab) => {
    lastTab.set(space.id, next);
    setTabState(next);
  };
  const me = prospects.list?.me ?? props.myUserId;
  const list = prospects.list;
  const openConversation = async (prospect: ProspectView) => {
    setOverlay(null);
    const chat = chats?.find((one) => one.id === prospect.chatId) ?? (await findSpaceChat(jwt, space.id, prospect.chatId));
    if (chat) props.onOpenChat(chat);
  };
  const openSheet = (prospect: ProspectView) => setOverlay({ kind: 'sheet', prospect });
  const desk = { jwt, spaceId: space.id, me, now, onChanged: prospects.replace, onStale: prospects.reload };
  const shown = overlay?.kind === 'sheet' ? (list?.prospects.find((one) => one.id === overlay.prospect.id) ?? overlay.prospect) : null;

  return (
    <View testID="espacio-dali" className="flex-1 bg-background">
      <DaliTabs value={tab} onChange={setTab} />
      {tab === 'inbox' ? (
        <DaliInbox
          list={list}
          failed={prospects.failed}
          onRetry={prospects.reload}
          onRefresh={() => {
            prospects.reload();
            void load();
          }}
          chats={chats}
          myUserId={me}
          openChatId={props.openChatId}
          service={service}
          onService={setService}
          now={now}
          onOpenProspect={(prospect) => void openConversation(prospect)}
          onOpenChat={props.onOpenChat}
          onFollowUps={() => setOverlay({ kind: 'followups' })}
        />
      ) : (
        <BoardTab tab={tab} prospects={prospects} now={now} service={service} onService={setService} onOpenProspect={openSheet} jwt={jwt} spaceId={space.id} onOpenChatId={(chatId) => void findSpaceChat(jwt, space.id, chatId).then((chat) => chat && props.onOpenChat(chat))} />
      )}
      <ProspectSheetScreen {...desk} visible={shown !== null} prospect={shown} onClose={close} onOpenConversation={(prospect) => void openConversation(prospect)} />
      <FollowUpsScreen {...desk} visible={overlay?.kind === 'followups'} list={list} onClose={close} onOpenProspect={(prospect) => void openConversation(prospect)} />
      <DaliKnowledgeScreen jwt={jwt} spaceId={space.id} visible={overlay?.kind === 'knowledge'} list={list} now={now} onClose={close} />
    </View>
  );
}

type BoardProps = {
  tab: Exclude<DaliTab, 'inbox'>;
  prospects: Prospects;
  now: Date;
  service?: string;
  onService: (key: string | undefined) => void;
  onOpenProspect: (prospect: ProspectView) => void;
  jwt: string;
  spaceId: string;
  onOpenChatId: (chatId: string) => void;
};

/** Embudo, Panel and Revisión: when the first reading failed they say so instead of a skeleton that never ends. */
function BoardTab(props: BoardProps) {
  const { list, failed, reload } = props.prospects;
  if (!list && failed) return <LoadFailed onRetry={reload} />;
  if (props.tab === 'funnel') return <DaliFunnel list={list} now={props.now} service={props.service} onService={props.onService} onOpenProspect={props.onOpenProspect} />;
  if (props.tab === 'panel') return <DaliPanel list={list} now={props.now} />;
  return <DaliReview jwt={props.jwt} spaceId={props.spaceId} list={list} now={props.now} onOpenProspect={props.onOpenProspect} onOpenChat={props.onOpenChatId} />;
}

/** The first reading failed: the funnel, the panel and the review say so instead of a skeleton that never ends. */
function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="p-4">
      <EmptyNote title="No se pudieron cargar los prospectos." action={<TextButton testID="reintentar-prospectos" onPress={onRetry}>Reintentar</TextButton>} />
    </View>
  );
}

/** Under the shell's header, the space's own tabs (dl-01 v3): the active one underlined in the accent. */
function DaliTabs({ value, onChange }: { value: DaliTab; onChange: (tab: DaliTab) => void }) {
  return (
    <View accessibilityRole="tablist" className="flex-row border-b border-outline/15 bg-surface">
      {TABS.map((tab) => {
        const active = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            testID={`pestana-${tab.key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(tab.key)}
            className={`min-h-[48px] flex-1 items-center justify-center border-b-2 ${active ? 'border-primary' : 'border-transparent'}`}
          >
            <Text numberOfLines={1} className={`text-[15px] ${active ? 'font-bold text-primary' : 'font-medium text-on-surface-variant'}`}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The space under an open chat waits for the return, like the space's list (plan 1, F4): what arrives meanwhile
 * stays in the cache and the first render after coming back shows it.
 */
export const CoverableDaliSpace = memo(
  function CoverableDaliSpace({ covered: _covered, ...props }: Props & { covered: boolean }) {
    return <DaliSpace {...props} />;
  },
  (_previous, next) => next.covered
);
