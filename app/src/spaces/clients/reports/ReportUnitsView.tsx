import { useState, type ReactNode } from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import { Camera, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Clock, Container, Ruler, Thermometer, Truck } from 'lucide-react-native';
import { ARRIVED_LABEL, dataSectionOf, pageLine, photoSlotsOf, sectionRowLine, UNIT_GROUP_TITLES, unitBadgeOf, unitCountsLine, unitGroupsOf, unitLineOf, unitStateOf, unitTitleOf, type RepeatItem, type RepeatSection, type SectionPath, type UnitSlot } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { Pill, ResultsStrip, StateDot } from './ReportSections';

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
      {/* The key remounts the tile: on Android, dropping the dashed border from a live clipped view left its photo and check undrawn until the screen was reopened (E2E 06/11). */}
      <View key={slot.done ? 'taken' : 'missing'} className={`items-center justify-center overflow-hidden rounded-2xl ${slot.done ? 'bg-primary/10' : 'border-2 border-dashed border-primary/50 bg-surface-variant'}`} style={{ width: SLOT, height: SLOT }}>
        {slot.photo ? <Image source={{ uri: slot.photo.thumbUrl }} style={{ width: SLOT, height: SLOT }} /> : <Icon size={28} color={colors.primary} />}
        {slot.done ? <View className="absolute right-1 top-1 rounded-full bg-surface"><CheckCircle2 size={18} color={colors.primary} /></View> : null}
        {slot.photo?.pending ? <View testID={`foto-pendiente-${slot.photo.id}`} className="absolute left-1 top-1 h-5 w-5 items-center justify-center rounded-full bg-black/60"><Clock size={12} color="white" /></View> : null}
      </View>
      <Text className={`mt-1 text-[11px] ${slot.done ? 'text-on-surface-variant' : 'font-bold text-primary'}`} numberOfLines={1}>{slotLabel(slot.section.title)}</Text>
    </Pressable>
  );
}

/** A volquete on its way, in one row: any of them can be next, because the order of arrival depends on nothing. «Llegó» opens its data with the hour of the tap. */
function WaitingRow({ item, section, last, onOpen }: { item: RepeatItem; section: RepeatSection; last: boolean; onOpen: Open }) {
  const colors = useColores();
  const data = dataSectionOf(item);
  const { plate } = unitTitleOf(item);
  return (
    <View testID={`unidad-${item.id}`} className={`flex-row items-center gap-3 px-3 py-2 ${last ? '' : 'border-b border-outline/10'}`}>
      <View className="min-w-0 flex-1">
        <Text className="text-[21px] font-bold text-on-surface" style={{ fontFamily: PLATE_FONT }} numberOfLines={1}>{plate}</Text>
        {unitLineOf(item) ? <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>{unitLineOf(item)}</Text> : null}
      </View>
      {data ? (
        <Pressable testID={`llego-${item.id}`} onPress={() => onOpen({ sectionId: section.id, itemId: item.id, key: data.id })} accessibilityLabel={`${ARRIVED_LABEL} ${plate}`} className="min-h-[52px] min-w-[96px] flex-row items-center justify-center gap-1.5 rounded-xl bg-primary px-3">
          <Truck size={18} color={colors['on-primary']} />
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

/** The finished ones fold away: they no longer need the person, and twelve of them would bury the rest. */
function FinishedGroup({ items, section, onOpen }: { items: RepeatItem[]; section: RepeatSection; onOpen: Open }) {
  const colors = useColores();
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <View className="gap-3">
      <Pressable testID="ver-terminadas" onPress={() => setOpen(!open)} accessibilityState={{ expanded: open }} className="min-h-[44px] flex-row items-center gap-3">
        <Text className="flex-1 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{UNIT_GROUP_TITLES.finished}</Text>
        <Text className="text-[12px] font-bold text-primary">{items.length}</Text>
        <Chevron size={18} color={colors.primary} />
      </Pressable>
      {open ? items.map((item) => <ArrivedCard key={item.id} item={item} section={section} onOpen={onOpen} />) : null}
    </View>
  );
}

/**
 * The units of a control de pista (design j-05, reordered after the test with
 * twelve volquetes, José 06/11): first the ones on site, which are the work at
 * hand; then the ones on their way, as rows that fit one screen and force no
 * order; the ones still at the plant as a line; the finished ones folded.
 * Nobody adds a unit; Portal lists the order's dispatches.
 */
export function ReportUnitsView({ section, onOpen }: { section: RepeatSection; onOpen: Open }) {
  const groups = unitGroupsOf(section);
  const head = [unitCountsLine(groups), pageLine(section)].filter(Boolean).join(' · ');
  return (
    <View testID={`unidades-${section.id}`} className="gap-4">
      {section.summary.length ? <Text testID="resumen-unidades" className="text-[15px] font-bold text-on-surface">{section.summary.join(' · ')}</Text> : null}
      {head ? <Text testID="conteo-unidades" className="text-[14px] text-on-surface-variant">{head}</Text> : null}
      {section.items.length === 0 ? <Text className="pt-4 text-center text-[14px] text-on-surface-variant">{NO_UNITS}</Text> : null}
      {groups.onSite.length ? <Group title={UNIT_GROUP_TITLES.onSite} count={groups.onSite.length}>{groups.onSite.map((item) => <ArrivedCard key={item.id} item={item} section={section} onOpen={onOpen} />)}</Group> : null}
      {groups.waiting.length ? (
        <Group title={UNIT_GROUP_TITLES.waiting} count={groups.waiting.length}>
          <View className="overflow-hidden rounded-2xl border border-outline/15 bg-surface">{groups.waiting.map((item, index) => <WaitingRow key={item.id} item={item} section={section} last={index === groups.waiting.length - 1} onOpen={onOpen} />)}</View>
        </Group>
      ) : null}
      {groups.atPlant.length ? <Group title={UNIT_GROUP_TITLES.atPlant} count={groups.atPlant.length}><Text testID="unidades-en-planta" className="text-[14px] text-on-surface-variant" style={{ fontFamily: PLATE_FONT }}>{groups.atPlant.map((item) => unitTitleOf(item).plate).join(' · ')}</Text></Group> : null}
      {groups.finished.length ? <FinishedGroup items={groups.finished} section={section} onOpen={onOpen} /> : null}
      <ResultsStrip results={section.results} testID="resultados-unidades" />
    </View>
  );
}
