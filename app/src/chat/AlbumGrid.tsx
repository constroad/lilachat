import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Play } from 'lucide-react-native';
import { albumGrid } from '@lilachat/shared';
import { miniaturaDe } from './filasDelChat';
import type { ChatMessage } from './useChat';

/** The album's share of the screen width (pending 70). */
const ALBUM_SHARE = 0.75;
/** The thin line between photos (dp). */
const GAP = 2;

/** Where a tile starts and how long it is along one side, leaving half the gap on each inner edge. */
function span(start: number, size: number, side: number): { offset: number; length: number } {
  const before = start > 0 ? GAP / 2 : 0;
  const after = start + size < 1 ? GAP / 2 : 0;
  return { offset: start * side + before, length: size * side - before - after };
}

/**
 * Several photos or videos sent together, as a grid like WhatsApp's (pending
 * 81, José 23/10): 2 side by side, 3 as one big and two small, 4 or more as a
 * 2×2 with «+N» on the fourth. A tap opens the viewer on that photo, where
 * they slide; the caption of the first goes under the card like any photo.
 */
export function AlbumGrid(props: { items: readonly ChatMessage[]; selecting?: boolean; onSelect?: (seq: number) => void; onOpen?: (seq: number) => void }) {
  const { items } = props;
  const head = items[0]!;
  const side = Math.round(useWindowDimensions().width * ALBUM_SHARE);
  return (
    <View testID={`album-${head.seq}`} style={{ width: side, height: side }} className="mb-1 overflow-hidden rounded-xl">
      {albumGrid(items.length).map((tile) => {
        const item = items[tile.index]!;
        const across = span(tile.x, tile.w, side);
        const down = span(tile.y, tile.h, side);
        const frame = { width: across.length, height: down.length };
        const thumb = item.media ? miniaturaDe(item.media) : undefined;
        return (
          <Pressable
            key={item.seq}
            testID={`album-foto-${item.seq}`}
            onPress={() => (props.selecting ? props.onSelect?.(head.seq) : props.onOpen?.(item.seq))}
            onLongPress={() => {
              void Haptics.selectionAsync();
              props.onSelect?.(head.seq);
            }}
            delayLongPress={350}
            style={{ position: 'absolute', left: across.offset, top: down.offset, ...frame }}
          >
            {thumb ? <Image source={{ uri: thumb }} recyclingKey={item.clientKey} contentFit="cover" style={frame} /> : <View style={frame} className="bg-black" />}
            {item.media?.mime?.startsWith('video/') && !tile.more ? (
              <View className="absolute inset-0 items-center justify-center">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-black/50">
                  <Play size={20} color="white" fill="white" />
                </View>
              </View>
            ) : null}
            {tile.more ? (
              <View className="absolute inset-0 items-center justify-center bg-black/45">
                <Text testID={`album-mas-${head.seq}`} className="text-[28px] font-bold text-white">{`+${tile.more}`}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
