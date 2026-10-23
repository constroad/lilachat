import { Linking, Pressable, Text, View } from 'react-native';
import { Paperclip } from 'lucide-react-native';
import type { BotBlock } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { useColores } from '../../ui/tema';
import { BlockChart } from './BlockChart';
import { BlockTank } from './BlockTank';
import { TONE_CLASS, TONE_COLOR } from './tones';

const PEOPLE_SIZE = 26;

/** Rows for the detail: label and value, an optional mini bar and a second line (districts, today's readings, who is missing). */
function Rows({ rows }: { rows: Extract<BotBlock, { type: 'rows' }>['rows'] }) {
  const colors = useColores();
  return (
    <View testID="bloque-filas">
      {rows.map((row, index) => (
        <View key={`${row.label}-${index}`} className={`min-h-[44px] justify-center py-2 ${index ? 'border-t border-outline/10' : ''}`}>
          <View className="flex-row items-center gap-3">
            <Text numberOfLines={1} className="min-w-0 flex-1 text-[14px] text-on-surface">{row.label}</Text>
            {row.bar !== undefined ? (
              <View className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-variant">
                <View className="h-full rounded-full" style={{ width: `${Math.round(row.bar * 100)}%`, backgroundColor: colors[TONE_COLOR[row.tone]] }} />
              </View>
            ) : null}
            <Text className={`text-[13px] font-semibold ${row.tone === 'neutral' ? 'text-on-surface' : TONE_CLASS[row.tone].text}`} style={{ fontVariant: ['tabular-nums'] }}>{row.value}</Text>
          </View>
          {row.sub ? <Text className="mt-0.5 text-[12px] text-on-surface-variant">{row.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function Block({ block }: { block: BotBlock }) {
  const colors = useColores();
  switch (block.type) {
    case 'metric':
      return (
        <View testID="bloque-cifra">
          {block.label ? <Text className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{block.label}</Text> : null}
          <Text className={`text-[26px] font-bold ${block.tone === 'neutral' ? 'text-on-surface' : TONE_CLASS[block.tone].text}`} style={{ fontVariant: ['tabular-nums'] }}>{block.value}{block.unit ? <Text className="text-[15px] font-semibold text-on-surface-variant">{` ${block.unit}`}</Text> : null}</Text>
        </View>
      );
    case 'chips':
      return (
        <View testID="bloque-chips" className="flex-row" style={{ gap: 6 }}>
          {block.items.map((chip) => (
            <View key={chip.label} className={`flex-1 items-center rounded-lg border px-1 py-1.5 ${TONE_CLASS[chip.tone].soft}`}>
              <Text className={`text-[12px] font-semibold ${TONE_CLASS[chip.tone].text}`}>{chip.label}</Text>
              {chip.sub ? <Text numberOfLines={1} className={`text-[11px] ${TONE_CLASS[chip.tone].text}`}>{chip.sub}</Text> : null}
            </View>
          ))}
        </View>
      );
    case 'chart':
      return <BlockChart chart={block} />;
    case 'progress':
      return (
        <View testID="bloque-progreso">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-[15px] font-semibold text-on-surface">{block.label}: <Text className="text-primary">{block.value}</Text> de {block.max}</Text>
            <Text className="text-[12px] text-on-surface-variant">{Math.round((block.value / block.max) * 100)} %</Text>
          </View>
          <View className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-variant">
            <View className="h-full rounded-full" style={{ width: `${Math.round((block.value / block.max) * 100)}%`, backgroundColor: colors[TONE_COLOR[block.tone === 'neutral' ? 'info' : block.tone]] }} />
          </View>
        </View>
      );
    case 'tank':
      return <BlockTank items={block.items} />;
    case 'text':
      return <Text testID="bloque-texto" className={`text-[13px] ${block.tone === 'neutral' ? 'text-on-surface-variant' : TONE_CLASS[block.tone].text}`}>{block.text}</Text>;
    case 'rows':
      return <Rows rows={block.rows} />;
    case 'people':
      return (
        <View testID="bloque-personas" className="flex-row items-center">
          {block.names.map((name, index) => <View key={`${name}-${index}`} style={{ marginLeft: index ? -6 : 0 }}><Avatar nombre={name} tamano={PEOPLE_SIZE} /></View>)}
          {block.more ? <Text className="ml-2 text-[12px] text-on-surface-variant">+{block.more}</Text> : null}
        </View>
      );
    case 'attachments':
      return (
        <Pressable testID="bloque-adjuntos" onPress={() => void Linking.openURL(block.url)} className="min-h-[36px] flex-row items-center gap-1.5 self-start rounded-full border border-outline/20 px-3">
          <Paperclip size={14} color={colors['on-surface-variant']} />
          <Text className="text-[13px] font-semibold text-on-surface">{block.label}</Text>
        </Pressable>
      );
  }
}

/** The kit's blocks (§118.4), one under the other with the card's rhythm. */
export function BotBlocksView({ blocks }: { blocks: readonly BotBlock[] }) {
  return (
    <View className="gap-3">
      {blocks.map((block, index) => <Block key={`${block.type}-${index}`} block={block} />)}
    </View>
  );
}
