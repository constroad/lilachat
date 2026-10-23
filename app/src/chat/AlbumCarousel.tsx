import { useState } from 'react';
import { FlatList, Pressable, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Play } from 'lucide-react-native';
import { miniaturaDe } from './filasDelChat';
import type { ChatMessage } from './useChat';
import { photoStyle } from './rowKinds';

/**
 * Several photos or videos sent together, as one card that slides sideways
 * like Instagram's (pending 12, design `r148-album`): «2/5» on top, the dots
 * below, and a tap opens the viewer on that photo. The caption of the first
 * goes under the card like any photo; another page's caption shows on it.
 */
export function AlbumCarousel(props: { items: readonly ChatMessage[]; selecting?: boolean; onSelect?: (seq: number) => void; onOpen?: (seq: number) => void }) {
  const { items } = props;
  const head = items[0]!;
  const frame = photoStyle(head.media ?? {});
  const [page, setPage] = useState(0);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / frame.width);
    if (next !== page) setPage(Math.max(0, Math.min(items.length - 1, next)));
  };
  const caption = page > 0 ? items[page]?.body : undefined;

  return (
    <View testID={`album-${head.seq}`} style={{ width: frame.width }} className="mb-1 overflow-hidden rounded-xl">
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.seq)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        // Inside the chat's vertical list: a sideways swipe moves the card, a vertical one the chat.
        nestedScrollEnabled
        renderItem={({ item }) => (
          <Pressable
            testID={`album-foto-${item.seq}`}
            onPress={() => (props.selecting ? props.onSelect?.(head.seq) : props.onOpen?.(item.seq))}
            onLongPress={() => {
              void Haptics.selectionAsync();
              props.onSelect?.(head.seq);
            }}
            delayLongPress={350}
            style={frame}
          >
            {item.media && miniaturaDe(item.media) ? <Image source={{ uri: miniaturaDe(item.media) }} recyclingKey={item.clientKey} contentFit="cover" style={frame} /> : <View style={frame} className="bg-black" />}
            {item.media?.mime?.startsWith('video/') ? (
              <View className="absolute inset-0 items-center justify-center">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-black/50">
                  <Play size={22} color="white" fill="white" />
                </View>
              </View>
            ) : null}
          </Pressable>
        )}
      />
      <View pointerEvents="none" className="absolute right-2 top-2 rounded-full bg-black/55 px-2.5 py-1">
        <Text testID={`album-contador-${head.seq}`} className="text-[12px] font-semibold text-white">
          {page + 1}/{items.length}
        </Text>
      </View>
      {caption ? (
        <View pointerEvents="none" className="absolute inset-x-0 bottom-6 bg-black/45 px-3 py-1.5">
          <Text numberOfLines={2} className="text-[13px] text-white">{caption}</Text>
        </View>
      ) : null}
      <View pointerEvents="none" className="h-6 flex-row items-center justify-center gap-1.5 bg-black/10">
        {items.map((item, index) => (
          <View key={item.seq} className={`rounded-full ${index === page ? 'h-2 w-2 bg-white' : 'h-1.5 w-1.5 bg-white/60'}`} />
        ))}
      </View>
    </View>
  );
}
