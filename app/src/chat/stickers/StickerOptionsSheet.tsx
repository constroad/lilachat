import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Music, Share, Star, Trash2, VolumeX, type LucideIcon } from 'lucide-react-native';
import { stickerOptionsOf, type LibrarySticker } from '@lilachat/shared';
import { Sheet } from '../../ui/Sheet';
import { useColores } from '../../ui/tema';

const PREVIEW = 160;
const ICON_BOX = 44;

export type StickerOptionActions = {
  onSound: (sticker: LibrarySticker) => void;
  onRemoveSound: (sticker: LibrarySticker) => void;
  onExport: (sticker: LibrarySticker) => void;
  onToggleFavorite: (sticker: LibrarySticker) => void;
  onRemove: (sticker: LibrarySticker) => void;
};

type Row = { key: string; label: string; Icon: LucideIcon; tone?: 'primary' | 'error'; run: () => void };

function rowsOf(sticker: LibrarySticker, actions: StickerOptionActions): Row[] {
  const options = stickerOptionsOf(sticker);
  return [
    { key: 'sonido', label: options.sound, Icon: Music, tone: 'primary' as const, run: () => actions.onSound(sticker) },
    ...(options.canRemoveSound ? [{ key: 'quitar-sonido', label: 'Quitar sonido', Icon: VolumeX, run: () => actions.onRemoveSound(sticker) }] : []),
    ...(options.canExport ? [{ key: 'exportar', label: 'Exportar para WhatsApp', Icon: Share, run: () => actions.onExport(sticker) }] : []),
    { key: 'favorito', label: options.favorite, Icon: Star, run: () => actions.onToggleFavorite(sticker) },
    ...(options.canRemove ? [{ key: 'quitar', label: 'Quitar de Mis stickers', Icon: Trash2, tone: 'error' as const, run: () => actions.onRemove(sticker) }] : []),
  ];
}

/**
 * A long press on a saved sticker (José 27/11: «ya tengo un sticker en mis favoritos… quiero agregarle audio», designs
 * sa-01 and sa-02): the sticker big, what it sounds like, and its options with the sound first.
 */
export function StickerOptionsSheet(props: { sticker: LibrarySticker | null; onClose: () => void; actions: StickerOptionActions }) {
  const colors = useColores();
  const { sticker } = props;
  const choose = (row: Row) => {
    props.onClose();
    row.run();
  };
  return (
    <Sheet visible={sticker !== null} onClose={props.onClose} testID="hoja-opciones-sticker" className="px-4">
      {sticker ? (
        <View className="gap-1 pb-2">
          <View className="items-center gap-2 pb-3">
            <View className="items-center justify-center rounded-3xl border border-outline/15 bg-background" style={{ width: PREVIEW, height: PREVIEW }}>
              <Image source={{ uri: sticker.url }} style={{ width: PREVIEW - 16, height: PREVIEW - 16 }} contentFit="contain" />
            </View>
            <Text testID="linea-sonido-sticker" className="text-[14px] text-on-surface-variant">{stickerOptionsOf(sticker).soundLine}</Text>
          </View>
          {rowsOf(sticker, props.actions).map((row) => {
            const tint = row.tone === 'primary' ? colors.primary : row.tone === 'error' ? colors.error : colors['on-surface'];
            return (
              <Pressable key={row.key} testID={`opcion-sticker-${row.key}`} accessibilityRole="button" onPress={() => choose(row)} className="min-h-[56px] flex-row items-center gap-3 rounded-2xl px-2 active:bg-background">
                <View className="items-center justify-center rounded-xl bg-background" style={{ width: ICON_BOX, height: ICON_BOX }}>
                  <row.Icon size={20} color={tint} />
                </View>
                <Text className={`flex-1 text-[16px] ${row.tone === 'primary' ? 'font-semibold text-primary' : row.tone === 'error' ? 'text-error' : 'text-on-surface'}`}>{row.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </Sheet>
  );
}
