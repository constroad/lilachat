import { Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Camera, CheckCircle2, ChevronRight, Clock, Container, Plus, Ruler, Send, Thermometer, Truck } from 'lucide-react-native';
import { ADD_EXTRA_PHOTO, ALBUM_CTA, dataRowLine, dataSectionOf, extraPhotosOf, extraPhotosTitle, nextSlotOf, photoSlotsOf, placementOf, QUEUE_BADGES, slotMeasureOf, takeLabelOf, unitAlbumCta, type PhotoToView, type QueuedUnit, type RepeatItem, type RepeatSection, type SectionPath, type UnitSlot } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { Pill, StateDot } from './ReportSections';

/** Designs pv2-01/pv2-04 (José 20/11): the unit on the card, its four photos with their measure, and one clear «Terminar unidad». */
export const PLATE_FONT = Platform.select({ ios: 'Menlo', default: 'monospace' });
const SLOT = 68;
const EXTRA_THUMB = 40;
const ICONS = { ingreso: Truck, temperatura: Thermometer, escantillon: Ruler, vacia: Container } as const;
const iconOf = (kind?: string) => (kind && kind in ICONS ? ICONS[kind as keyof typeof ICONS] : Camera);
const slotLabel = (title: string): string => title.replace(/^foto de\s+/i, '').split(' · ')[0]!;

export type Open = (path: SectionPath) => void;
export type ViewPhoto = (photo: PhotoToView) => void;

/** One photo of the unit: its thumbnail with a check and its measure, or a dashed camera to take it. */
function PhotoSlot({ item, slot, next, onOpen, onView }: { item: RepeatItem; slot: UnitSlot; next: boolean; onOpen: () => void; onView: (url: string) => void }) {
  const colors = useColores();
  const Icon = iconOf(slot.section.photoKind);
  const measure = slotMeasureOf(item, slot);
  const frame = slot.done ? 'border border-outline/15 bg-primary/10' : next ? 'border-2 border-dashed border-primary bg-primary/5' : 'border-2 border-dashed border-outline/30 bg-surface-variant';
  return (
    <Pressable testID={`foto-${item.id}-${slot.section.id}`} onPress={() => (slot.photo ? onView(slot.photo.url) : onOpen())} accessibilityLabel={slot.section.title} className="items-center" style={{ width: SLOT }}>
      {/* The key remounts the tile: on Android, dropping the dashed border from a live clipped view left its photo undrawn (E2E 06/11). */}
      <View key={slot.done ? 'taken' : 'missing'} className={`items-center justify-center overflow-hidden rounded-xl ${frame}`} style={{ width: SLOT, height: SLOT }}>
        {slot.photo ? <Image source={{ uri: slot.photo.thumbUrl }} style={{ width: SLOT, height: SLOT }} /> : <Icon size={24} color={next ? colors.primary : colors['on-surface-variant']} />}
        {slot.done ? <View className="absolute right-1 top-1 rounded-full bg-surface"><CheckCircle2 size={16} color={colors.primary} /></View> : null}
        {slot.photo?.pending ? <View testID={`foto-pendiente-${slot.photo.id}`} className="absolute left-1 top-1 h-5 w-5 items-center justify-center rounded-full bg-black/60"><Clock size={12} color="white" /></View> : null}
        {measure ? <View className="absolute bottom-1 left-1 right-1 rounded-md bg-surface/90 px-1"><Text testID={`medida-${item.id}-${slot.section.id}`} className="text-center text-[11px] font-bold text-on-surface" style={{ fontFamily: PLATE_FONT }}>{measure}</Text></View> : null}
      </View>
      <Text className={`mt-1 text-[11px] ${next ? 'font-bold text-primary' : 'text-on-surface-variant'}`} numberOfLines={1}>{slotLabel(slot.section.title)}</Text>
    </Pressable>
  );
}

/** Design j-07b: the unit's optional photos under the fixed ones, compact. */
function ExtraStrip({ item, section, onOpen, onView }: { item: RepeatItem; section: RepeatSection; onOpen: Open; onView: ViewPhoto }) {
  const colors = useColores();
  const extras = extraPhotosOf(item);
  if (!extras) return null;
  const path = { sectionId: section.id, itemId: item.id, key: extras.section.id };
  return (
    <ScrollView testID={`adicionales-${item.id}`} horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} className="rounded-xl border border-outline/10 bg-background" contentContainerStyle={{ gap: 8, padding: 6, alignItems: 'center' }}>
      <Text className="text-[11px] font-bold uppercase tracking-[1.2px] text-on-surface-variant">{extraPhotosTitle(extras.photos.length)}</Text>
      {extras.photos.map((one) => (
        <Pressable key={one.id || one.url} onPress={() => onView({ section: extras.section, url: one.url, path })} accessibilityLabel={[one.caption, one.hour].filter(Boolean).join(' · ') || extras.section.title}>
          <Image source={{ uri: one.thumbUrl }} style={{ width: EXTRA_THUMB, height: EXTRA_THUMB, borderRadius: 8 }} />
        </Pressable>
      ))}
      {extras.full ? null : (
        <Pressable testID={`agregar-adicional-${item.id}`} onPress={() => onOpen(path)} className="h-9 flex-row items-center gap-1 rounded-lg border border-primary/30 px-2">
          <Plus size={14} color={colors.primary} />
          <Text className="text-[13px] font-bold text-primary">{ADD_EXTRA_PHOTO}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

/** «Tomar escantillón» beside «Terminar unidad»: the next photo and the close, compact (José 20/11: no giant buttons). */
function UnitActions({ item, section, onOpen, onAlbum }: { item: RepeatItem; section: RepeatSection; onOpen: Open; onAlbum?: (item: RepeatItem) => void }) {
  const colors = useColores();
  const next = nextSlotOf(item);
  const cta = unitAlbumCta(item);
  const finishing = cta?.label === ALBUM_CTA.finish;
  const Icon = finishing ? CheckCircle2 : Send;
  return (
    <View className="flex-row flex-wrap items-center justify-end gap-2 border-t border-outline/10 pt-3">
      {cta?.sentNote ? <Text testID={`album-enviado-${item.id}`} className="mr-auto text-[12px] text-on-surface-variant">{cta.sentNote}</Text> : null}
      {next ? (
        <Pressable testID={`tomar-siguiente-${item.id}`} onPress={() => onOpen({ sectionId: section.id, itemId: item.id, key: next.section.id })} className="h-10 flex-row items-center gap-1.5 rounded-xl border border-outline/25 px-3">
          <Camera size={16} color={colors.primary} />
          <Text className="text-[14px] font-semibold text-on-surface">{takeLabelOf(next)}</Text>
        </Pressable>
      ) : null}
      {cta && onAlbum ? (
        <Pressable testID={`terminar-${item.id}`} onPress={() => onAlbum(item)} className={`h-10 flex-row items-center gap-1.5 rounded-xl px-3 ${finishing ? 'bg-primary' : 'border border-primary/30 bg-primary/10'}`}>
          <Icon size={16} color={finishing ? colors['on-primary'] : colors.primary} />
          <Text className={`text-[14px] font-bold ${finishing ? 'text-on-primary' : 'text-primary'}`}>{cta.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The unit on the card: number and plate, its status, the four photos, extras, its other data and the actions. */
export function UnitCardView({ unit, section, onOpen, onView, onAlbum }: { unit: QueuedUnit; section: RepeatSection; onOpen: Open; onView: ViewPhoto; onAlbum?: (item: RepeatItem) => void }) {
  const colors = useColores();
  const { item } = unit;
  const data = dataSectionOf(item);
  const next = nextSlotOf(item);
  const placement = placementOf(item);
  return (
    <View testID={`unidad-${item.id}`} className={`gap-3 rounded-2xl border bg-surface p-4 ${unit.status === 'unloading' ? 'border-primary/50' : 'border-outline/15'}`}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          {unit.kicker ? <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{unit.kicker}</Text> : null}
          <Text className="text-[24px] font-bold text-on-surface" style={{ fontFamily: PLATE_FONT }} numberOfLines={1}>{unit.plate}</Text>
          <Text testID={`linea-${item.id}`} className="text-[13px] text-on-surface-variant" numberOfLines={1}>{[unit.line, placement].filter(Boolean).join(' · ')}</Text>
        </View>
        <Pill badge={QUEUE_BADGES[unit.status]} testID={`estado-${item.id}`} />
      </View>
      <View className="flex-row justify-between">
        {photoSlotsOf(item).map((slot) => {
          const path = { sectionId: section.id, itemId: item.id, key: slot.section.id };
          return <PhotoSlot key={slot.section.id} item={item} slot={slot} next={slot === next} onOpen={() => onOpen(path)} onView={(url) => onView({ section: slot.section, url, path })} />;
        })}
      </View>
      <ExtraStrip item={item} section={section} onOpen={onOpen} onView={onView} />
      {data ? (
        <Pressable testID={`datos-${item.id}`} onPress={() => onOpen({ sectionId: section.id, itemId: item.id, key: data.id })} className="min-h-[40px] flex-row items-center gap-2">
          <StateDot state={data.state} small />
          <Text className="flex-1 text-[14px] text-on-surface" numberOfLines={1}>{dataRowLine(data)}</Text>
          <ChevronRight size={16} color={colors.primary} />
        </Pressable>
      ) : null}
      <UnitActions item={item} section={section} onOpen={onOpen} onAlbum={onAlbum} />
    </View>
  );
}
