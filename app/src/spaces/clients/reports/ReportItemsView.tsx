import { Pressable, Text, View } from 'react-native';
import { ChevronRight, Plus } from 'lucide-react-native';
import { itemsLine, sectionBadge, type RepeatItem, type RepeatSection, type SectionPath } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { ResultsStrip, StateDot } from './ReportSections';

/** One tramo (design j-03): its kicker, where it is, what it measured and a row per subsection. */
function ItemCard({ item, section, onOpen }: { item: RepeatItem; section: RepeatSection; onOpen: (path: SectionPath) => void }) {
  const colors = useColores();
  return (
    <View testID={`item-${item.id}`} className="rounded-2xl border border-outline/15 bg-surface p-4">
      <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{item.title}</Text>
      {item.summary.length ? <Text className="mt-1 text-[16px] font-bold text-on-surface">{item.summary.join(' · ')}</Text> : null}
      <ResultsStrip results={item.results} testID={`resultados-${item.id}`} />
      <View className="mt-3 border-t border-outline/10">
        {item.sections.map((one) => (
          <Pressable key={one.id} testID={`seccion-${item.id}-${one.id}`} onPress={() => onOpen({ sectionId: section.id, itemId: item.id, key: one.id })} className="min-h-[48px] flex-row items-center gap-3 border-b border-outline/10 py-2">
            <StateDot state={one.state} small />
            <Text className="flex-1 text-[14px] font-semibold text-on-surface">{one.title}</Text>
            <Text className="max-w-[40%] text-[12px] text-on-surface-variant" numberOfLines={1}>{one.summary[0] ?? sectionBadge(one.state, one.required).label}</Text>
            <ChevronRight size={16} color={colors.primary} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * The tramos of a report (design j-03): how many there are, «Agregar tramo»
 * (which opens the first section of a new one) and a card per tramo with its
 * subsections, each opening its own form.
 */
export function ReportItemsView({ section, onOpen }: { section: RepeatSection; onOpen: (path: SectionPath) => void }) {
  const colors = useColores();
  const first = section.template[0];
  const add = () => first && onOpen({ sectionId: section.id, itemId: null, key: first.id });
  return (
    <View testID={`items-${section.id}`} className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-[14px] text-on-surface-variant">{itemsLine(section)}</Text>
        {first ? (
          <Pressable testID="agregar-item" onPress={add} className="min-h-[44px] flex-row items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3">
            <Plus size={16} color={colors.primary} />
            <Text className="text-[14px] font-semibold text-primary">{section.addLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {section.items.length === 0 ? <Text className="pt-4 text-center text-[14px] text-on-surface-variant">{`Agrega el primer ${section.itemTitle.toLowerCase()} para empezar.`}</Text> : null}
      {section.items.map((item) => <ItemCard key={item.id} item={item} section={section} onOpen={onOpen} />)}
    </View>
  );
}
