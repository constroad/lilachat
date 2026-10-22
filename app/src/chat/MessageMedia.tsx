import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { CircleAlert, Play } from 'lucide-react-native';
import { isAnimatedImage } from '@lilachat/shared';
import { useAnimatedStop } from './stickers/StickerMessage';
import { TarjetaDeArchivo } from './TarjetaDeArchivo';
import { NotaDeVoz } from './NotaDeVoz';
import { etiquetaDeSubida } from './progresoDeSubida';
import { AnilloDeSubida } from './AnilloDeSubida';
import { copiaLocalDe } from './colaDeArchivos';
import { miniaturaDe } from './filasDelChat';
import { isFileMime, isPending, isVoiceMime, photoStyle, type Row } from './rowKinds';
import { useColores } from '../ui/tema';

/**
 * What a message carries besides its text: a voice note, a file card, a photo
 * or video (with its play button), or what is still uploading. Out of
 * `MessageRow` so the bubble and the flat row (Slack format, design `s-01`)
 * draw the same thing.
 */
export function MessageMedia({ item, mine, selecting, onSelect, onOpen, flat = false, author }: { item: Row; mine: boolean; selecting?: boolean; onSelect?: (seq: number) => void; onOpen?: (seq: number) => void; /** No bubble behind it (Slack format): an upload in flight is drawn on the screen's colors. */ flat?: boolean; /** Who sent it: a voice note shows their photo, like WhatsApp. */ author?: { name: string; photo?: string } }) {
  const colores = useColores();
  const fallo = isPending(item) ? item.fallo : undefined;
  const subida = etiquetaDeSubida({ razon: isPending(item) ? (item.progreso ?? 0) : 0, fallido: Boolean(fallo) });
  // A GIF moves in the bubble and stops after a while, like the stickers; a tap on a stopped one plays it again (backlog 37).
  const gif = !isPending(item) && isAnimatedImage(item.media?.mime);
  const gifStop = useAnimatedStop(gif && !isPending(item) ? item.media?.url : undefined, gif);
  const ink = flat ? { box: 'bg-primary/10', title: 'text-on-surface', hint: 'text-on-surface-variant', spinner: colores.primary } : { box: 'bg-white/20', title: 'text-on-burbuja-propia', hint: 'text-on-burbuja-propia-suave', spinner: colores['on-burbuja-propia'] };
  return (
    <>
      {!isPending(item) && item.media && isVoiceMime(item.media.mime) ? (
        <NotaDeVoz
          id={`${item.chatId}:${item.seq}`}
          url={item.media.url ?? ''}
          durationMs={item.media.durationMs}
          onda={item.media.onda}
          mia={mine}
          author={author}
        />
      ) : null}

      {/* Un ARCHIVO no es una foto: es una tarjeta con su nombre. */}
      {!isPending(item) && item.media && isFileMime(item.media.mime) && !isVoiceMime(item.media.mime) ? (
        <TarjetaDeArchivo
          seq={item.seq}
          media={item.media}
          mia={mine}
          onPress={() => !isPending(item) && (selecting ? onSelect?.(item.seq) : onOpen?.(item.seq))}
        />
      ) : null}

      {!isPending(item) && item.media && miniaturaDe(item.media) && !isFileMime(item.media.mime) ? (
        <Pressable
          testID={`media-${item.seq}`}
          // The photo took the touch and the row's long press never arrived: a photo or a GIF could not be selected.
          onLongPress={() => {
            if (isPending(item)) return;
            void Haptics.selectionAsync();
            onSelect?.(item.seq);
          }}
          delayLongPress={350}
          onPress={() => {
            if (isPending(item)) return;
            if (gifStop.stopped && !selecting) return gifStop.replay();
            if (selecting) onSelect?.(item.seq);
            else onOpen?.(item.seq);
          }}
        >
          <Image
            ref={gif ? gifStop.ref : undefined}
            recyclingKey={item.clientKey}
            // What I just sent keeps its local copy (it is not downloaded again).
            source={{ uri: copiaLocalDe(item.clientKey) ?? miniaturaDe(item.media) }}
            style={photoStyle(item.media)}
            contentFit="cover"
            transition={120}
          />
          {/* El PLAY sobre la miniatura. Un video y una foto se veían
              exactamente igual —la miniatura es un cuadro del video— así
              que no había forma de saber que eso se podía reproducir. */}
          {gif ? (
            <View testID={`gif-${item.seq}`} className="absolute bottom-2 left-2 flex-row items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5">
              {gifStop.stopped ? <Play size={12} color="#ffffff" fill="#ffffff" /> : null}
              <Text className="text-[11px] font-bold text-white">GIF</Text>
            </View>
          ) : null}
          {(item.media.mime ?? '').startsWith('video/') ? (
            <View
              testID={`play-${item.seq}`}
              className="absolute inset-0 items-center justify-center"
            >
              <View className="h-14 w-14 items-center justify-center rounded-full bg-black/55">
                <Play size={26} color="#ffffff" fill="#ffffff" />
              </View>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      {/* La foto que todavia sube: se ve YA, con un velo y su vueltita
          encima. El check aparece recien cuando el server la confirma, que
          es exactamente lo que hace WhatsApp. */}
      {isPending(item) && item.mediaUri && isFileMime(item.mediaMime) ? (
        // A file in flight is not previewed either: it showed an empty square
        // in the bubble's color with a percentage on top.
        <View
          testID={`archivo-pendiente-${item.clientKey}`}
          className="min-w-[200px] flex-row items-center gap-3 px-3 py-2.5"
        >
          <View className={`h-10 w-10 items-center justify-center rounded-lg ${ink.box}`}>
            {subida.girando ? <ActivityIndicator color={ink.spinner} /> : <CircleAlert size={20} color={colores.error} />}
          </View>
          <View className="min-w-0 flex-1">
            <Text className={`text-[14px] font-semibold ${ink.title}`} numberOfLines={2}>
              {item.mediaNombre ?? 'Archivo'}
            </Text>
            <Text className={`text-[11px] ${subida.girando ? ink.hint : 'text-error'}`}>
              {subida.texto}
            </Text>
          </View>
        </View>
      ) : null}

      {isPending(item) && item.mediaUri && !isFileMime(item.mediaMime) ? (
        <View testID={`media-pendiente-${item.clientKey}`}>
          <Image
            recyclingKey={item.mediaUri}
            source={{ uri: item.mediaUri }}
            style={photoStyle({ width: item.mediaAncho, height: item.mediaAlto })}
            contentFit="cover"
          />
          <AnilloDeSubida razon={item.progreso ?? 0} fallido={!subida.girando} textoDelFallo={subida.texto} />
        </View>
      ) : null}
    </>
  );
}
