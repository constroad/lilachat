import { Text, View } from 'react-native';
import { isFigure, type BotBlock } from '@lilachat/shared';

type StatBlock = Extract<BotBlock, { type: 'stat' }>;
type SectionBlock = Extract<BotBlock, { type: 'section' }>;
type TilesBlock = Extract<BotBlock, { type: 'tiles' }>;

const SMALL_CAPS = 'text-[11px] font-bold uppercase tracking-widest text-on-surface-variant';
const FIGURES = { fontVariant: ['tabular-nums' as const] };

/** The inset figure (Stitch a10): caption on top, label on the left, the big value on the right. */
export function BlockStat({ block }: { block: StatBlock }) {
  return (
    <View testID="bloque-estadistica" className="rounded-xl border border-outline/15 bg-background px-3 py-2.5">
      {block.caption ? <Text className="border-b border-outline/10 pb-2 text-[12px] text-on-surface-variant">{block.caption}</Text> : null}
      <View className={`flex-row flex-wrap items-baseline justify-between ${block.caption ? 'pt-2' : ''}`} style={{ columnGap: 12 }}>
        <Text className={`shrink ${SMALL_CAPS}`}>{block.label}</Text>
        <Text className="text-[26px] font-bold text-on-surface" style={FIGURES}>
          {block.value}
          {block.unit ? <Text className="text-[15px] font-semibold text-on-surface-variant">{` ${block.unit}`}</Text> : null}
        </Text>
      </View>
    </View>
  );
}

/** A section header; a figure on the right reads as a total, any other text as a note. */
export function BlockSection({ block }: { block: SectionBlock }) {
  const aside = block.aside;
  return (
    <View testID="bloque-seccion" className="flex-row flex-wrap items-baseline justify-between border-b border-outline/10 pb-1.5" style={{ columnGap: 12 }}>
      <Text className={`shrink ${SMALL_CAPS}`}>{block.title}</Text>
      {aside ? <Text className={`text-[12px] ${isFigure(aside) ? 'font-bold text-on-surface' : 'text-on-surface-variant'}`} style={FIGURES}>{aside}</Text> : null}
    </View>
  );
}

/** Materials as a grid of two: the label over its value, so a long name wraps instead of being cut. */
export function BlockTiles({ block }: { block: TilesBlock }) {
  return (
    <View testID="bloque-casillas" className="flex-row flex-wrap" style={{ gap: 8 }}>
      {block.items.map((tile, index) => (
        <View key={`${tile.label}-${index}`} className="rounded-lg border border-outline/15 px-2.5 py-2" style={{ flexBasis: '47%', flexGrow: 1 }}>
          <Text className="text-[12px] text-on-surface-variant">{tile.label}</Text>
          <Text className="text-[15px] font-semibold text-on-surface" style={FIGURES}>{tile.value}</Text>
        </View>
      ))}
    </View>
  );
}
