import { Pressable, Text, View } from 'react-native';
import { galleryFiles, galleryStrip, type BotBlock } from '@lilachat/shared';
import { FileThumb } from '../../spaces/clients/FileThumb';
import { useFileViewer } from '../../spaces/clients/useFileViewer';

const THUMB = 64;

/** A unit's photos and videos on its card (José via agentes, 09/11): four thumbnails and «+N»; a tap opens the viewer on all of them. */
export function BlockGallery({ block }: { block: Extract<BotBlock, { type: 'gallery' }> }) {
  const viewer = useFileViewer();
  const files = galleryFiles(block);
  const { shown, more } = galleryStrip(files.length);
  return (
    <View testID="bloque-galeria" className="flex-row flex-wrap gap-1.5">
      {files.slice(0, shown).map((file, index) => {
        const last = index === shown - 1 && more > 0;
        return (
          <Pressable key={file.url} testID={`bloque-galeria-${index}`} accessibilityRole="button" accessibilityLabel={last ? `Ver ${more} más` : `Ver ${file.name}`} onPress={() => viewer.open(file, files)} className="overflow-hidden rounded-lg">
            <FileThumb file={file} size={THUMB} />
            {last ? <View className="absolute inset-0 items-center justify-center bg-black/55"><Text className="text-[15px] font-bold text-white">{`+${more}`}</Text></View> : null}
          </Pressable>
        );
      })}
      {viewer.viewer}
    </View>
  );
}
