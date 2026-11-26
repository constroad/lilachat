import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { FileText } from 'lucide-react-native';
import { formatBytes, isPdfMedia, pdfCardLineOf } from '@lilachat/shared';
import { nombreLimpio } from './archivoDescargado';
import type { ChatMessage } from './useChat';
import { useColores } from '../ui/tema';

/** El tamaño de la miniatura de la primera página (dp). */
const ANCHO_DE_LA_MINIATURA = 240;
const ALTO_DE_LA_MINIATURA = 180;
/** The page sits inset in the bubble with its own rounded corners, like WhatsApp's document card. */
const MARGEN_DE_LA_MINIATURA = 4;

/**
 * Un ARCHIVO en la burbuja (salió de `MessageRow`, FL13d). No es una foto: es
 * una tarjeta con su nombre. Un PDF llegaba como un rectángulo blanco de
 * 220×220 —lila le genera miniatura de la primera página— sin nombre, sin
 * tamaño y sin nada que dijera qué era. Un documento ES su nombre.
 */
export function FileCard(props: { seq: number; media: NonNullable<ChatMessage['media']>; mia: boolean; onPress: () => void; onLongPress?: () => void }) {
  const colores = useColores();
  const { media, mia } = props;
  return (
    // With a page the card is as wide as the page: the name wraps under it and never runs past the bubble (José 25/11).
    <Pressable testID={`archivo-${props.seq}`} onPress={props.onPress} onLongPress={props.onLongPress} delayLongPress={350} style={media.thumbUrl ? { width: ANCHO_DE_LA_MINIATURA + 2 * MARGEN_DE_LA_MINIATURA } : undefined}>
      {/* La MINIATURA de la primera página, como la preview card de WhatsApp. */}
      {media.thumbUrl ? (
        <View className="overflow-hidden rounded-xl bg-white" style={{ margin: MARGEN_DE_LA_MINIATURA, marginBottom: 0 }}>
          <Image
            // La celda se recicla: sin la clave, se veía la foto ANTERIOR
            // fundiéndose en la nueva al scrollear (FL12).
            recyclingKey={media.thumbUrl}
            source={{ uri: media.thumbUrl }}
            style={{ width: ANCHO_DE_LA_MINIATURA, height: ALTO_DE_LA_MINIATURA }}
            contentFit="cover"
            contentPosition="top"
            transition={120}
          />
        </View>
      ) : null}
      <View className={`flex-row items-center gap-3 px-3 py-2.5 ${media.thumbUrl ? '' : 'min-w-[200px]'}`}>
        <View className={`h-10 w-10 items-center justify-center rounded-lg ${mia ? 'bg-white/20' : 'bg-primary/10'}`}>
          <FileText size={20} color={mia ? colores['on-burbuja-propia'] : colores.primary} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className={`text-[14px] font-semibold ${mia ? 'text-on-burbuja-propia' : 'text-on-burbuja-ajena'}`} numberOfLines={2}>
            {media.fileName ? nombreLimpio(media.fileName) : 'Archivo'}
          </Text>
          <Text className={`text-[11px] ${mia ? 'text-on-burbuja-propia-suave' : 'text-on-surface-variant'}`}>
            {isPdfMedia(media) ? pdfCardLineOf(media) : media.sizeBytes ? formatBytes(media.sizeBytes) : 'Toca para abrir o descargar'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
