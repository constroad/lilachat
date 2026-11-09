import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Play } from 'lucide-react-native';
import { albumGrid, galleryFiles, type GalleryItem } from '@lilachat/shared';
import { useFileViewer } from '../spaces/clients/useFileViewer';

/** The album's share of the screen width, as a person's album (AlbumGrid). */
const ALBUM_SHARE = 0.75;
const GAP = 2;
function span(start: number, size: number, side: number): { offset: number; length: number } {
  const before = start > 0 ? GAP / 2 : 0;
  const after = start + size < 1 ? GAP / 2 : 0;
  return { offset: start * side + before, length: size * side - before - after };
}

/** A bot's photos and videos as a person's album (José via agentes 09/11): the same grid, «+N» and viewer. */
export function BotFilesAlbum({ seq, files }: { seq: number; files: readonly GalleryItem[] }) {
  const side = Math.round(useWindowDimensions().width * ALBUM_SHARE);
  const viewer = useFileViewer();
  const viewable = galleryFiles({ type: 'gallery', items: [...files] });
  return (
    <View testID={`album-app-${seq}`} style={{ width: side, height: side }} className="mb-1 overflow-hidden rounded-xl bg-black">
      {albumGrid(files.length).map((tile) => {
        const file = files[tile.index]!;
        const across = span(tile.x, tile.w, side);
        const down = span(tile.y, tile.h, side);
        const frame = { width: across.length, height: down.length };
        const thumb = file.thumbUrl ?? (file.mime.startsWith('image/') ? file.url : undefined);
        return (
          <Pressable key={`${file.url}-${tile.index}`} testID={`album-app-foto-${seq}-${tile.index}`} onPress={() => viewer.open(viewable[tile.index]!, viewable)} style={{ position: 'absolute', left: across.offset, top: down.offset, ...frame }}>
            {thumb ? <Image source={{ uri: thumb }} contentFit="cover" style={frame} /> : <View style={frame} className="bg-black" />}
            {file.mime.startsWith('video/') && !tile.more ? (
              <View className="absolute inset-0 items-center justify-center"><View className="h-11 w-11 items-center justify-center rounded-full bg-black/50"><Play size={20} color="white" fill="white" /></View></View>
            ) : null}
            {tile.more ? <View className="absolute inset-0 items-center justify-center bg-black/45"><Text className="text-[28px] font-bold text-white">{`+${tile.more}`}</Text></View> : null}
          </Pressable>
        );
      })}
      {viewer.viewer}
    </View>
  );
}
