import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { FolderOpen, MessageSquareText } from 'lucide-react-native';
import type { LinkCategory, LinkNoteItem } from '@lilachat/shared';
import { Segmentado, type OpcionSegmentada } from '../../ui/Segmentado';
import { CategoryActionsSheet } from './CategoryActionsSheet';
import { LinksByCategory } from './LinksByCategory';
import { categoryNameOf, type NotesView } from './linkView';
import { putLinkSorting } from './linksApi';
import { MoveLinkSheet } from './MoveLinkSheet';
import type { NoteLinksBubble } from './NoteLinkBubble';
import { useChatLinks, type ChatLinksState } from './useChatLinks';
import { useLinkOpener } from './useLinkOpener';
import { storeNotesView, useNotesView } from './notesViewPref';

const VIEW_OPTIONS: readonly OpcionSegmentada<NotesView>[] = [
  { key: 'chat', etiqueta: 'Chat', testID: 'segmento-chat', Icono: MessageSquareText },
  { key: 'links', etiqueta: 'Por categoría', testID: 'segmento-por-categoria', Icono: FolderOpen },
];

type Params = { chatId: string; jwt: string; isNotes: boolean; sorted?: boolean; onWrite: () => void; onError: (text: string) => void };

export type NotesLinks = {
  /** The switch, `undefined` outside a notes chat (the ⋮ does not offer it). */
  enabled: boolean | undefined;
  toggleSorting: () => void;
  segment: ReactElement | null;
  overlay: ReactElement | null;
  bubble: NoteLinksBubble | null;
  sheets: ReactElement | null;
};

/** Asks before turning it on: Lila reads every saved link, and that takes a minute or two. */
function confirmSorting(turnOn: boolean, onYes: () => void) {
  Alert.alert(
    turnOn ? 'Ordenar enlaces por categoría' : 'Dejar de ordenar enlaces',
    turnOn ? 'Lila lee tus enlaces y los ordena. Tarda uno o dos minutos.' : 'Los enlaces nuevos ya no se ordenan. Tus categorías se guardan por si lo vuelves a encender.',
    [{ text: 'Cancelar', style: 'cancel' }, { text: turnOn ? 'Ordenar' : 'Dejar de ordenar', onPress: onYes }],
    { cancelable: true }
  );
}

/** Links per category id, `none` for «Sin categoría», for the move sheet. */
function countsOf(links: ChatLinksState['links']): Map<string, number> {
  const known = new Set(links?.categories.map((one) => one.id));
  const counts = new Map<string, number>();
  for (const one of links?.items ?? []) {
    const key = one.link.categoryId && known.has(one.link.categoryId) ? one.link.categoryId : 'none';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * A notes chat's links by category (José 18/11), all that the chat screen
 * mounts: the «Chat · Por categoría» control, the view over the conversation,
 * what the bubbles need and the sheets. Off by default, per chat.
 */
export function useNotesLinks({ chatId, jwt, isNotes, sorted, onWrite, onError }: Params): NotesLinks {
  const [enabled, setEnabled] = useState(Boolean(sorted));
  const active = isNotes && enabled;
  const state = useChatLinks({ chatId, jwt, active });
  const serverEnabled = state.links?.enabled;
  useEffect(() => {
    if (serverEnabled !== undefined) setEnabled(serverEnabled);
  }, [serverEnabled]);
  const stored = useNotesView(chatId);
  const view: NotesView = active ? stored : 'chat';
  const opener = useLinkOpener();
  const [movingSeq, setMovingSeq] = useState<number | null>(null);
  const [acting, setActing] = useState<LinkCategory | null>(null);

  const toggleSorting = useCallback(() => {
    const turnOn = !enabled;
    confirmSorting(turnOn, () => {
      void putLinkSorting(jwt, chatId, turnOn).then((answer) => {
        if (!answer.ok) return onError(answer.message ?? 'No se pudo cambiar. Revisa tu conexión.');
        setEnabled(turnOn);
        storeNotesView(chatId, turnOn ? 'links' : 'chat');
      });
    });
  }, [enabled, jwt, chatId, onError]);

  const { reload, retry, links } = state;
  const openMove = useCallback((seq: number) => {
    setMovingSeq(seq);
    // A link Lila just read may not be in the list yet: the sheet opens when it arrives.
    if (!links?.items.some((one) => one.seq === seq)) reload();
  }, [links, reload]);
  const bubble = useMemo<NoteLinksBubble | null>(() => {
    if (!active) return null;
    const categories = links?.categories ?? [];
    return {
      categoryName: (categoryId) => categoryNameOf(categories, categoryId),
      onMove: openMove,
      onRetry: (seq) => void retry(seq).then((failure) => failure && onError(failure)),
      onOpen: opener.open,
    };
  }, [active, links, openMove, retry, onError, opener.open]);

  const writeNote = useCallback(() => {
    storeNotesView(chatId, 'chat');
    onWrite();
  }, [chatId, onWrite]);
  const openItem = useCallback((item: LinkNoteItem) => opener.open(item.link.url), [opener.open]);
  const moreOf = useCallback((item: LinkNoteItem) => setMovingSeq(item.seq), []);
  const counts = useMemo(() => countsOf(links), [links]);
  const movingItem = links?.items.find((one) => one.seq === movingSeq) ?? null;

  const segment = active ? (
    <View className="border-b border-outline/10 bg-surface px-4 pb-2 pt-1">
      <Segmentado opciones={VIEW_OPTIONS} valor={view} onCambiar={(next) => storeNotesView(chatId, next)} />
    </View>
  ) : null;
  const overlay = view === 'links' ? (
    <View style={[StyleSheet.absoluteFill, styles.over]} className="bg-fondo-chat">
      <LinksByCategory state={state} onOpen={openItem} onMore={moreOf} onCategoryActions={setActing} onWrite={writeNote} />
    </View>
  ) : null;
  const sheets = active ? (
    <>
      <MoveLinkSheet item={movingItem} categories={links?.categories ?? []} counts={counts} onClose={() => setMovingSeq(null)} onMove={state.move} onCreate={state.create} />
      <CategoryActionsSheet category={acting} categories={links?.categories ?? []} onClose={() => setActing(null)} onRename={state.rename} onMerge={state.merge} />
      {opener.player}
    </>
  ) : null;
  return { enabled: isNotes ? enabled : undefined, toggleSorting, segment, overlay, bubble, sheets };
}

const styles = StyleSheet.create({ over: { zIndex: 5, elevation: 5 } });
