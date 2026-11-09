import { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { summaryHeadline, type PreviewReply } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { BotBlocksView } from '../botBlocks/BotBlocksView';

/** At most this share of the screen, so the form above always shows (Wilson 02/11: «el resumen tapa casi todo»). */
const SUMMARY_SHARE = 0.35;

/** The app's summary by the button: one line with its figure and warnings; a tap opens it, scrolling inside. */
export function FormSummary({ blocks }: { blocks: PreviewReply['blocks'] }) {
  const colors = useColores();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const headline = summaryHeadline(blocks);
  const warns = headline.includes('aviso');
  return (
    <View testID="formulario-resumen" className="mb-2 mt-2 rounded-2xl border border-outline/15">
      <Pressable testID="formulario-resumen-abrir" accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} className="min-h-[48px] flex-row items-center gap-2 px-3">
        <Text numberOfLines={1} className={`flex-1 text-[14px] font-semibold ${warns ? 'text-warning' : 'text-on-surface'}`}>{headline}</Text>
        <ChevronDown size={18} color={colors['on-surface-variant']} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>
      {open ? (
        <ScrollView style={{ maxHeight: height * SUMMARY_SHARE }} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12 }} nestedScrollEnabled>
          <BotBlocksView blocks={blocks} />
        </ScrollView>
      ) : null}
    </View>
  );
}
