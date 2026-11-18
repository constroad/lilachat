import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { LinkNoteItem } from '@lilachat/shared';
import { LinkThumb, PlatformPill } from './LinkCardParts';
import { cardLinesOf, dayMonthOf } from './linkView';

/** Stitch nl-01: 16 of padding + the 75 of the 3:4 thumbnail + 16 (review 18/11: it was 88). */
export const LINK_CARD_HEIGHT = 107;
const THUMB_WIDTH = 56;
const LONG_PRESS_MS = 350;

/**
 * One saved link in «Por categoría». A tap opens it (a reel plays inside the
 * app); a long press offers «Mover de categoría». `memo` on the item: a new
 * card for one link redraws only that one.
 */
export const LinkRowCard = memo(function LinkRowCard({ item, onOpen, onMore }: { item: LinkNoteItem; onOpen: (item: LinkNoteItem) => void; onMore: (item: LinkNoteItem) => void }) {
  const { link } = item;
  const lines = cardLinesOf(link);
  return (
    <Pressable
      testID={`enlace-${item.seq}`}
      accessibilityRole="link"
      accessibilityHint="Mantén presionado para moverlo de categoría"
      onPress={() => onOpen(item)}
      onLongPress={() => {
        void Haptics.selectionAsync();
        onMore(item);
      }}
      delayLongPress={LONG_PRESS_MS}
      style={{ height: LINK_CARD_HEIGHT }}
      className="flex-1 flex-row items-center gap-3 rounded-card bg-surface px-4 shadow-sm active:opacity-80"
    >
      <LinkThumb link={link} width={THUMB_WIDTH} />
      <View className="min-w-0 flex-1">
        <View className="mb-0.5 flex-row items-center justify-between gap-2">
          <PlatformPill link={link} />
          <Text className="text-[12px] text-on-surface-variant">{dayMonthOf(item.at)}</Text>
        </View>
        <Text numberOfLines={1} className="text-[14px] font-bold text-on-surface">
          {lines.title}
        </Text>
        <Text numberOfLines={2} className={`text-[13px] leading-[17px] ${link.status === 'unreadable' ? 'text-error' : 'text-on-surface-variant'}`}>
          {lines.body}
        </Text>
      </View>
    </Pressable>
  );
});
