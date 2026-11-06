import type { ReactNode } from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import { Camera, CheckCircle2, ChevronRight, Clock, Container, Ruler, Thermometer, Truck } from 'lucide-react-native';
import { ARRIVED_LABEL, dataSectionOf, itemsLine, pageLine, photoSlotsOf, sectionRowLine, UNIT_GROUP_TITLES, unitBadgeOf, unitGroupsOf, unitLineOf, unitStateOf, unitTitleOf, type RepeatItem, type RepeatSection, type SectionPath, type UnitSlot } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { Pill, StateDot } from './ReportSections';

/** Design j-05 (José 06/11): for the operator on the pista, with gloves and in a hurry. Big plate, big slots, one tap per action. */
const SLOT = 72;
const PLATE_FONT = Platform.select({ ios: 'Menlo', default: 'monospace' });
const ICONS = { ingreso: Truck, temperatura: Thermometer, escantillon: Ruler, vacia: Container } as const;
const iconOf = (kind?: string) => (kind && kind in ICONS ? ICONS[kind as keyof typeof ICONS] : Camera);
const NO_UNITS = 'Todavía no salió ningún volquete de planta.';
const slotLabel = (title: string): string => title.replace(/^foto de\s+/i, '');

type Open = (path: SectionPath) => void;

/** One photo of the unit: its thumbnail with a check, or a dashed camera to take it with one tap. */
function PhotoSlot({ slot, itemId, onOpen }: { slot: UnitSlot; itemId: string; onOpen: () => void }) {
  const colors = useColores();
  const Icon = iconOf(slot.section.photoKind);
  return (
    <Pressable testID={`foto-${itemId}-${slot.section.id}`} onPress={onOpen} accessibilityLabel={slot.section.title} className="items-center" style={{ width: SLOT }}>
      <View className={`items-center justify-center overflow-hidden rounded-2xl ${slot.done ? 'bg-primary/10' : 'border-2 border-dashed border-primary/50 bg-surface-variant'}`} style={{ width: SLOT, height: SLOT }}>
        {slot.photo ? <Image source={{ uri: slot.photo.thumbUrl }} style={{ width: SLOT, height: SLOT }} /> : <Icon size={28} color={colors.primary} />}
        {slot.done ? <View className="absolute right-1 top-1 rounded-full bg-surface"><CheckCircle2 size={18} color={colors.primary} /></View> : null}
        {slot.photo?.pending ? <View testID={`foto-pendiente-${slot.photo.id}`} className="absolute left-1 top-1 h-5 w-5 items-center justify-center rounded-full bg-black/60"><Clock size={12} color="white" /></View> : null}
      </View>
      <Text className={`mt-1 text-[11px] ${slot.done ? 'text-on-surface-variant' : 'font-bold text-primary'}`} numberOfLines={1}>{slotLabel(slot.section.title)}</Text>
    </Pressable>
  );
}

/** A volquete that left the plant: its plate and «Llegó», which opens its data with the hour already there. */
function WaitingCard({ item, section, onOpen }: { item: RepeatItem; section: RepeatSection; onOpen: Open }) {
  const colors = useColores();
  const data = dataSectionOf(item);
  return (
    <View testID={`unidad-${item.id}`} className="flex-row items-center gap-3 rounded-2xl border border-outline/15 bg-surface p-4">
      <View className="min-w-0 flex-1">
        <Text className="text-[28px] font-bold text-on-surface" style={{ fontFamily: PLATE_FONT }} numberOfLines={1}>{unitTitleOf(item).plate}</Text>
        {unitLineOf(item) ? <Text className="mt-0.5 text-[13px] text-on-surface-variant" numberOfLines={2}>{unitLineOf(item)}</Text> : null}
      </View>
      {data ? (
        <Pressable testID={`llego-${item.id}`} onPress={() => onOpen({ sectionId: section.id, itemId: item.id, key: data.id })} accessibilityLabel={`${ARRIVED_LABEL} ${unitTitleOf(item).plate}`} className="min-h-[64px] min-w-[96px] items-center justify-center rounded-2xl bg-primary px-4">
          <Truck size={22} color={colors['on-primary']} />
          <Text className="text-[14px] font-bold uppercase text-on-primary">{ARRIVED_LABEL}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A unit on site: number and plate, its pill, the four photo slots and the line of its data. */
function ArrivedCard({ item, section, onOpen }: { item: RepeatItem; section: RepeatSection; onOpen: Open }) {
  const colors = useColores();
  const { kicker, plate } = unitTitleOf(item);
  const data = dataSectionOf(item);
  const working = unitStateOf(item) === 'working';
  return (
    <View testID={`unidad-${item.id}`} className={`rounded-2xl border bg-surface p-4 ${working ? 'border-primary/40' : 'border-outline/15'}`}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          {kicker ? <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{kicker}</Text> : null}
          <Text className="text-[28px] font-bold text-on-surface" style={{ fontFamily: PLATE_FONT }} numberOfLines={1}>{plate}</Text>
        </View>
        <Pill badge={unitBadgeOf(item)} testID={`estado-${item.id}`} />
      </View>
      <View className="mt-3 flex-row justify-between">
        {photoSlotsOf(item).map((slot) => <PhotoSlot key={slot.section.id} slot={slot} itemId={item.id} onOpen={() => onOpen({ sectionId: section.id, itemId: item.id, key: slot.section.id })} />)}
      </View>
      {data ? (
        <Pressable testID={`datos-${item.id}`} onPress={() => onOpen({ sectionId: section.id, itemId: item.id, key: data.id })} className="mt-3 min-h-[44px] flex-row items-center gap-2 border-t border-outline/10 pt-2">
          <StateDot state={data.state} small />
          <Text className="flex-1 text-[14px] font-semibold text-on-surface" numberOfLines={1}>{sectionRowLine(data)}</Text>
          <ChevronRight size={16} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{title}</Text>
        <Text className="text-[12px] font-bold text-primary">{count}</Text>
      </View>
      {children}
    </View>
  );
}

/**
 * The units of a control de pista (design j-05): the volquetes that left the
 * plant, to tap when each one reaches the pista, and the ones on site by
 * arrival. Nobody adds a unit; Portal lists the order's dispatches.
 */
export function ReportUnitsView({ section, onOpen }: { section: RepeatSection; onOpen: Open }) {
  const groups = unitGroupsOf(section);
  const head = [itemsLine(section), pageLine(section)].filter(Boolean).join(' · ');
  return (
    <View testID={`unidades-${section.id}`} className="gap-4">
      {section.summary.length ? <Text testID="resumen-unidades" className="text-[15px] font-bold text-on-surface">{section.summary.join(' · ')}</Text> : null}
      <Text className="text-[14px] text-on-surface-variant">{head}</Text>
      {section.items.length === 0 ? <Text className="pt-4 text-center text-[14px] text-on-surface-variant">{NO_UNITS}</Text> : null}
      {groups.waiting.length ? <Group title={UNIT_GROUP_TITLES.waiting} count={groups.waiting.length}>{groups.waiting.map((item) => <WaitingCard key={item.id} item={item} section={section} onOpen={onOpen} />)}</Group> : null}
      {groups.arrived.length ? <Group title={UNIT_GROUP_TITLES.arrived} count={groups.arrived.length}>{groups.arrived.map((item) => <ArrivedCard key={item.id} item={item} section={section} onOpen={onOpen} />)}</Group> : null}
    </View>
  );
}
