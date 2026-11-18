import { createContext, useContext, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Folder, FolderX, Pencil, RotateCw } from 'lucide-react-native';
import { primerEnlace, type LinkCard } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { MetaDeMensaje } from '../MetaDeMensaje';
import { isPending, type Row } from '../rowKinds';
import { VistaPreviaDeEnlace } from '../VistaPreviaDeEnlace';
import { LinkThumb, PlatformPill, ReviewPill } from './LinkCardParts';
import { cardLinesOf, dayMonthOf, isLinkOnlyBody } from './linkView';

/** What a bubble of a notes chat with sorted links needs from the chat (José 18/11). `null`: any other chat. */
export type NoteLinksBubble = {
  categoryName: (categoryId: string | null | undefined) => string;
  onMove: (seq: number) => void;
  onRetry: (seq: number) => void;
  onOpen: (url: string) => void;
};
export const NoteLinksContext = createContext<NoteLinksBubble | null>(null);

const CARD_WIDTH = 280;
const THUMB_WIDTH = 64;
const PILL_HIT_SLOP = 8;

type Props = {
  item: Row;
  jwt?: string;
  mine: boolean;
  /** The generic card of a link (off in a secret chat). */
  withPreview: boolean;
  meta: ComponentProps<typeof MetaDeMensaje>;
  /** The text with its time, as every bubble draws it. */
  children: ReactNode;
};

/**
 * The text part of a bubble. In a notes chat with sorted links (Stitch nl-02)
 * a link draws its stored card and its category, and a bare shared URL is not
 * repeated under it; elsewhere, the usual preview fetched by URL.
 */
export function LinkAwareBody({ item, jwt, mine, withPreview, meta, children }: Props) {
  const notes = useContext(NoteLinksContext);
  const link = isPending(item) || item.media ? undefined : item.link;
  if (notes && link && !isPending(item)) {
    const linkOnly = isLinkOnlyBody(item.body);
    return (
      <>
        <StoredLinkCard seq={item.seq} at={item.at} link={link} notes={notes} />
        {linkOnly ? null : children}
        <CategoryRow seq={item.seq} link={link} mine={mine} notes={notes} meta={linkOnly ? meta : undefined} />
      </>
    );
  }
  const url = withPreview && jwt && !isPending(item) && !item.media ? primerEnlace(item.body) : null;
  return (
    <>
      {url && jwt ? <VistaPreviaDeEnlace url={url} jwt={jwt} mia={mine} /> : null}
      {children}
    </>
  );
}

function StoredLinkCard({ seq, at, link, notes }: { seq: number; at: string; link: LinkCard; notes: NoteLinksBubble }) {
  const lines = cardLinesOf(link);
  return (
    <Pressable testID={`tarjeta-enlace-${seq}`} onPress={() => notes.onOpen(link.url)} style={{ width: CARD_WIDTH }} className="m-1.5 mb-0 flex-row gap-3 rounded-xl bg-surface p-2.5">
      <LinkThumb link={link} width={THUMB_WIDTH} />
      <View className="min-w-0 flex-1 gap-1">
        <View className="flex-row items-center justify-between gap-2">
          <PlatformPill link={link} tone="soft" />
          <Text className="text-[12px] text-on-surface-variant">{dayMonthOf(at)}</Text>
        </View>
        <Text numberOfLines={link.status === 'unreadable' ? 2 : 1} className="text-[15px] font-bold text-on-surface">{lines.title}</Text>
        {link.status === 'unreadable' ? (
          <UnreadableRow seq={seq} notes={notes} />
        ) : link.commentBait ? (
          <>
            <ReviewPill kind="commentBait" />
            <Text numberOfLines={2} className="text-[13px] text-on-surface-variant">{lines.body}</Text>
          </>
        ) : (
          <Text numberOfLines={2} className="text-[13px] text-on-surface-variant">{lines.body}</Text>
        )}
      </View>
    </Pressable>
  );
}

/** «NO SE PUDO LEER» and «Reintentar»: the server reads it again and the new card arrives by socket. */
function UnreadableRow({ seq, notes }: { seq: number; notes: NoteLinksBubble }) {
  const colors = useColores();
  const [asked, setAsked] = useState(false);
  return (
    <View className="gap-1">
      <Text className="text-[12px] text-on-surface-variant">La red no lo muestra sin iniciar sesión</Text>
      <View className="flex-row flex-wrap items-center gap-2">
        <ReviewPill kind="unreadable" />
        <Pressable
          testID={`reintentar-enlace-${seq}`}
          disabled={asked}
          onPress={() => {
            setAsked(true);
            notes.onRetry(seq);
          }}
          hitSlop={PILL_HIT_SLOP}
          className={`min-h-[32px] flex-row items-center gap-1 rounded-md bg-primary/[0.10] px-2 ${asked ? 'opacity-50' : ''}`}
        >
          <RotateCw size={13} color={colors.primary} />
          <Text className="text-[13px] font-semibold text-primary">{asked ? 'Leyendo…' : 'Reintentar'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** The category with a pencil (opens «Mover de categoría»); the time beside it when the bubble has no text. */
function CategoryRow({ seq, link, mine, notes, meta }: { seq: number; link: LinkCard; mine: boolean; notes: NoteLinksBubble; meta?: Props['meta'] }) {
  const colors = useColores();
  const ink = mine ? colors['on-burbuja-propia'] : colors['on-burbuja-ajena'];
  const Icon = link.categoryId ? Folder : FolderX;
  return (
    <View className="flex-row items-center justify-between gap-3 px-2 pb-1.5 pt-1.5">
      <Pressable
        testID={`categoria-enlace-${seq}`}
        accessibilityLabel="Mover de categoría"
        onPress={() => notes.onMove(seq)}
        hitSlop={PILL_HIT_SLOP}
        className={`min-h-[32px] shrink flex-row items-center gap-1.5 rounded-full px-3 ${mine ? 'bg-on-burbuja-propia/[0.15]' : 'bg-primary/[0.10]'}`}
      >
        <Icon size={15} color={ink} />
        <Text numberOfLines={1} className={`shrink text-[13px] font-medium ${mine ? 'text-on-burbuja-propia' : 'text-on-burbuja-ajena'}`}>{notes.categoryName(link.categoryId)}</Text>
        <Pencil size={12} color={ink} />
      </Pressable>
      {meta ? <MetaDeMensaje {...meta} /> : null}
    </View>
  );
}
