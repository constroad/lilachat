import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { FileText } from 'lucide-react-native';
import { formatBytes, isPdfMedia, pdfCardLineOf } from '@lilachat/shared';
import { nombreLimpio } from './archivoDescargado';
import type { ChatMessage } from './useChat';
import { useColores } from '../ui/tema';

/** The card's share of the screen and its cap (dp), like WhatsApp's document bubble. */
const SHARE_OF_SCREEN = 0.72;
const MAX_WIDTH = 300;
/** The first page shows as a short strip (height / width), its top: the title and the header of the report. */
const PAGE_STRIP_RATIO = 0.42;
/** The card sits this close to the bubble's edge. */
const INSET = 3;

/**
 * A FILE in the bubble (out of `MessageRow`, FL13d). A PDF shows its first page
 * as a short strip flush on top and, under it, a darker panel with the name in
 * regular weight and «5 páginas · 1.5 MB · PDF» — WhatsApp's document card
 * (José 25/11, both screenshots side by side). Without a page: the icon and the
 * name. The name wraps in two lines inside the card, never past the bubble.
 */
export function FileCard(props: { seq: number; media: NonNullable<ChatMessage['media']>; mia: boolean; onPress: () => void; onLongPress?: () => void }) {
  const colores = useColores();
  const screen = useWindowDimensions().width;
  const { media, mia } = props;
  const width = Math.min(Math.round(screen * SHARE_OF_SCREEN), MAX_WIDTH);
  const page = media.thumbUrl;
  const ink = mia ? 'text-on-burbuja-propia' : 'text-on-burbuja-ajena';
  const muted = mia ? 'text-on-burbuja-propia-suave' : 'text-on-surface-variant';
  return (
    <Pressable testID={`archivo-${props.seq}`} onPress={props.onPress} onLongPress={props.onLongPress} delayLongPress={350} style={{ width, margin: INSET, marginBottom: 2 }}>
      {page ? (
        <Image
          // The cell is recycled: without the key the previous page faded into the new one (FL12).
          recyclingKey={page}
          source={{ uri: page }}
          style={{ width, height: Math.round(width * PAGE_STRIP_RATIO), borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: '#ffffff' }}
          contentFit="cover"
          contentPosition="top"
          transition={120}
        />
      ) : null}
      <View className={`flex-row items-center gap-2.5 bg-black/15 px-3 py-2.5 ${page ? 'rounded-b-xl' : 'rounded-xl'}`}>
        {page ? null : <FileText size={24} color={mia ? colores['on-burbuja-propia'] : colores.primary} />}
        <View className="min-w-0 flex-1">
          <Text testID={`archivo-nombre-${props.seq}`} className={`text-[15px] leading-5 ${ink}`} numberOfLines={2}>
            {media.fileName ? nombreLimpio(media.fileName) : 'Archivo'}
          </Text>
          <Text className={`mt-0.5 text-[12px] ${muted}`}>
            {isPdfMedia(media) ? pdfCardLineOf(media) : media.sizeBytes ? formatBytes(media.sizeBytes) : 'Toca para abrir o descargar'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
