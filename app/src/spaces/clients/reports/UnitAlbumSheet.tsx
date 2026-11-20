import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { CheckCircle2, Circle, ImageOff, ZoomIn } from 'lucide-react-native';
import { ALBUM_BROKEN_PHOTO, ALBUM_CANCEL, ALBUM_CLOSES_UNIT, ALBUM_SENDING, albumClosesUnit, albumCountLine, albumReviewTitle, albumSelection, albumSendLabel, freshAlbumMarks, markAlbumPhotoBroken, toggleAlbumPhoto, unitAlbumOf, type AlbumPhoto, type AlbumSend, type RepeatItem } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { Sheet } from '../../../ui/Sheet';

type Props = { item: RepeatItem | null; onSend: (item: RepeatItem, urls: string[]) => Promise<AlbumSend>; /** Portal's text, for the notice once it went. */ onSent: (message: string) => void; onClose: () => void; onView: (item: RepeatItem, url: string) => void };

/** Thumbnails per row: three on a phone, more on a tablet, so they never grow huge. */
const TABLET_FROM = 600;
const WIDE_FROM = 900;
const SIDE_PADDING = 32;
const GAP = 8;
const columnsFor = (width: number): number => (width >= WIDE_FROM ? 6 : width >= TABLET_FROM ? 5 : 3);

type TileProps = { photo: AlbumPhoto; index: number; size: number; checked: boolean; broken: boolean; onToggle: () => void; onBroken: () => void; onView: () => void };

/** One photo of the review: a tap checks or unchecks it; a long press or the magnifier opens it full size. */
function AlbumTile({ photo, index, size, checked, broken, onToggle, onBroken, onView }: TileProps) {
  const colors = useColores();
  const Check = checked ? CheckCircle2 : Circle;
  return (
    <View style={{ width: size }}>
      <Pressable testID={`album-foto-${index}`} accessibilityRole="checkbox" accessibilityState={{ checked, disabled: broken }} accessibilityLabel={`${photo.label}${photo.hour ? ` · ${photo.hour}` : ''}`} disabled={broken} onPress={onToggle} onLongPress={onView} className={`overflow-hidden rounded-xl bg-surface-variant ${checked ? 'border-2 border-primary' : 'border-2 border-transparent'}`} style={{ width: size, height: size }}>
        {broken ? (
          <View testID={`album-rota-${index}`} className="flex-1 items-center justify-center gap-1">
            <ImageOff size={22} color={colors['on-surface-variant']} />
            <Text className="text-center text-[11px] font-semibold text-on-surface-variant">{ALBUM_BROKEN_PHOTO}</Text>
          </View>
        ) : (
          <Image source={{ uri: photo.thumbUrl }} onError={onBroken} style={{ width: '100%', height: '100%', opacity: checked ? 1 : 0.5 }} />
        )}
        {broken ? null : <View className="absolute right-1.5 top-1.5 rounded-full bg-surface"><Check size={22} color={checked ? colors.primary : colors['on-surface-variant']} /></View>}
      </Pressable>
      {broken ? null : (
        <Pressable testID={`album-ver-${index}`} onPress={onView} accessibilityLabel={`Ver ${photo.label} en grande`} hitSlop={6} className="absolute bottom-1.5 left-1.5 h-9 w-9 items-center justify-center rounded-full bg-surface/90">
          <ZoomIn size={16} color={colors['on-surface']} />
        </Pressable>
      )}
      <Text className="mt-1 text-[12px] font-semibold text-on-surface" numberOfLines={1}>{photo.label}{photo.hour ? ` · ${photo.hour}` : ''}</Text>
    </View>
  );
}

/** The review of one unit; it mounts fresh for each unit, so every photo starts checked. */
function AlbumReview({ item, onSend, onSent, onClose, onView }: Omit<Props, 'item'> & { item: RepeatItem }) {
  const { width } = useWindowDimensions();
  const album = useMemo(() => unitAlbumOf(item), [item]);
  const [marks, setMarks] = useState(freshAlbumMarks);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const selected = albumSelection(album, marks);
  const columns = columnsFor(width);
  const size = Math.floor((width - SIDE_PADDING - GAP * (columns - 1)) / columns);
  const send = async () => {
    setSending(true);
    setError('');
    const sent = await onSend(item, selected);
    setSending(false);
    if (sent.ok) onSent(sent.message);
    else setError(sent.message);
  };
  const off = selected.length === 0 || sending;
  return (
    <>
      <Text className="text-[20px] font-bold text-on-surface">{albumReviewTitle(item)}</Text>
      <ScrollView testID="album-revision" className="mt-3" contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
        {album.map((photo, index) => (
          <AlbumTile key={photo.url} photo={photo} index={index} size={size} checked={selected.includes(photo.url)} broken={marks.broken.has(photo.url)} onToggle={() => setMarks((now) => toggleAlbumPhoto(now, photo.url))} onBroken={() => setMarks((now) => markAlbumPhotoBroken(now, photo.url))} onView={() => onView(item, photo.url)} />
        ))}
      </ScrollView>
      <Text testID="album-conteo" className="mt-3 text-center text-[14px] font-semibold text-on-surface">{albumCountLine(selected.length)}</Text>
      {albumClosesUnit(item) ? <Text testID="album-cierra" className="mt-1 text-center text-[13px] text-on-surface-variant">{ALBUM_CLOSES_UNIT}</Text> : null}
      {error ? <Text testID="album-error" accessibilityRole="alert" className="mt-1 text-center text-[13px] text-error">{error}</Text> : null}
      <Pressable testID="album-enviar" disabled={off} onPress={() => void send()} className={`mt-3 min-h-[52px] items-center justify-center rounded-2xl bg-primary ${off ? 'opacity-40' : ''}`}>
        <Text className="text-[16px] font-bold text-on-primary">{sending ? ALBUM_SENDING : albumSendLabel(selected.length)}</Text>
      </Pressable>
      <Pressable testID="album-cancelar" onPress={onClose} className="mt-2 min-h-[48px] items-center justify-center rounded-2xl border border-outline/20 bg-surface">
        <Text className="text-[16px] font-semibold text-on-surface">{ALBUM_CANCEL}</Text>
      </Pressable>
    </>
  );
}

/**
 * «Terminar unidad» (José 19/11, spec INFORMES-DESDE-LILACHAT §24): before the unit's photos go to
 * the client's group, the person sees them all, unchecks what should not go, and confirms. A photo
 * that does not open is left out by itself.
 */
export function UnitAlbumSheet(props: Props) {
  const { item, ...rest } = props;
  return (
    <Sheet visible={item !== null} onClose={props.onClose} testID="album-unidad" dragArea="handle" maxHeight="90%" className="px-4 pt-2">
      {item ? <AlbumReview key={item.id} item={item} {...rest} /> : null}
    </Sheet>
  );
}
