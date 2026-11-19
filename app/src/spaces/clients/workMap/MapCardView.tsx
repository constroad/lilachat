import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import type { MapCard, MapCardStatus, ViewableFile } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';

const THUMB_PX = 56;
const PILL_CLASS = { error: 'border-error/30 bg-error/10', ok: 'border-en-linea/30 bg-en-linea/10' } as const;
const PILL_TEXT = { error: 'text-error', ok: 'text-en-linea' } as const;

export function StatusPill(props: { status: MapCardStatus }) {
  return (
    <View className={`rounded-full border px-2 py-0.5 ${PILL_CLASS[props.status.tone]}`}>
      <Text className={`text-[10px] font-bold uppercase ${PILL_TEXT[props.status.tone]}`}>{props.status.label}</Text>
    </View>
  );
}

function Thumbnails(props: { photos: ViewableFile[]; onPhoto?: (photo: ViewableFile, all: ViewableFile[]) => void }) {
  return (
    <View className="mt-2 flex-row flex-wrap gap-1.5">
      {props.photos.map((photo, index) => (
        <Pressable key={photo.url} testID={`tarjeta-foto-${index}`} accessibilityLabel={`Ver ${photo.name}`} onPress={() => props.onPhoto?.(photo, props.photos)} className="overflow-hidden rounded-lg border border-outline/20 bg-surface-variant">
          <Image recyclingKey={photo.url} source={{ uri: photo.thumbUrl ?? photo.url }} style={{ width: THUMB_PX, height: THUMB_PX }} contentFit="cover" />
        </Pressable>
      ))}
    </View>
  );
}

/**
 * The small card of a drawing or an observation over the full map (José 19/11): name, type,
 * note, size and the nearest drawings; an observation adds its state, dates and photos. A drawing
 * adds the observations at its same point with their photos (José 19/11: the patches' photos).
 */
export function MapCardView(props: { card: MapCard; onClose: () => void; onPhoto?: (photo: ViewableFile, all: ViewableFile[]) => void }) {
  const { card } = props;
  const colors = useColores();
  return (
    <View testID={`tarjeta-${card.kind}-${card.id}`} className="rounded-2xl border border-outline/20 bg-surface p-3">
      <View className="flex-row items-start gap-2">
        <View className="min-w-0 flex-1">
          <Text numberOfLines={4} className="text-[15px] font-bold text-on-surface">{card.title}</Text>
          {card.type ? <Text className="text-[13px] text-on-surface-variant">{card.type}</Text> : null}
        </View>
        {card.status ? <StatusPill status={card.status} /> : null}
        <Pressable testID="tarjeta-cerrar" accessibilityLabel="Cerrar" onPress={props.onClose} className="-mr-1 -mt-1 h-11 w-11 items-center justify-center">
          <X size={18} color={colors['on-surface-variant']} />
        </Pressable>
      </View>
      {card.note ? <Text className="mt-1.5 text-[14px] text-on-surface">{card.note}</Text> : null}
      {card.size ? <Text testID="tarjeta-tamano" className="mt-1.5 font-mono text-[13px] font-semibold text-on-surface">{card.size}</Text> : null}
      {card.dates.map((line) => <Text key={line} className="mt-1 text-[13px] text-on-surface-variant">{line}</Text>)}
      {card.near.length ? (
        <View testID="tarjeta-cerca" className="mt-2 gap-0.5 border-t border-outline/15 pt-2">
          {card.near.map((line) => <Text key={line} className="text-[13px] text-on-surface-variant">{line}</Text>)}
        </View>
      ) : null}
      {card.observations.length ? (
        <View testID="tarjeta-observaciones" className="mt-2 gap-0.5 border-t border-outline/15 pt-2">
          {card.observations.map((line) => <Text key={line} className="text-[13px] font-semibold text-on-surface">{line}</Text>)}
        </View>
      ) : null}
      {card.photos.length ? <Thumbnails photos={card.photos} onPhoto={props.onPhoto} /> : null}
    </View>
  );
}
