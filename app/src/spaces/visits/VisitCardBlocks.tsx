import { Text, View } from 'react-native';
import { ClipboardList, MapPin } from 'lucide-react-native';
import { figureParts, visitKickerParts, type BotBlock } from '@lilachat/shared';
import { TONE_CLASS, TONE_COLOR } from '../../chat/botBlocks/tones';
import { useColores } from '../../ui/tema';

type TextBlock = Extract<BotBlock, { type: 'text' }>;
type TilesBlock = Extract<BotBlock, { type: 'tiles' }>;

/** lv01: «VISITA TÉCNICA ·» in the accent, the visit's code in mono grey. */
export function VisitKicker({ kicker }: { kicker?: string }) {
  const { lead, code } = visitKickerParts(kicker);
  return (
    <Text numberOfLines={1} className="min-w-0 flex-1 text-[11px] font-bold uppercase tracking-[1px] text-primary">
      {lead}{code ? <Text className="font-mono font-semibold tracking-normal text-on-surface-variant">{code}</Text> : null}
    </Text>
  );
}

/** The address under the title, with its pin (lv01). */
export function VisitAddress({ text }: { text: string }) {
  const colors = useColores();
  return (
    <View className="-mt-1 flex-row items-start gap-1.5">
      <MapPin size={15} color={colors.primary} style={{ marginTop: 2 }} />
      <Text testID="visita-direccion" numberOfLines={1} className="min-w-0 flex-1 text-[13px] text-on-surface-variant">{text}</Text>
    </View>
  );
}

/** What is missing as one line with «Pendiente» on its right (lv01); any other tone is the address line. */
export function VisitText({ block }: { block: TextBlock }) {
  const colors = useColores();
  if (block.tone !== 'warn' && block.tone !== 'error') return <VisitAddress text={block.text} />;
  return (
    <View testID="visita-falta" className="flex-row items-center gap-2 border-t border-outline/10 pt-2.5">
      <ClipboardList size={16} color={colors[TONE_COLOR[block.tone]]} />
      <Text className="min-w-0 flex-1 text-[13px] text-on-surface-variant">{block.text}</Text>
      <View className={`rounded-md border px-2 py-0.5 ${TONE_CLASS[block.tone].soft}`}>
        <Text className={`text-[10px] font-bold uppercase ${TONE_CLASS[block.tone].text}`}>Pendiente</Text>
      </View>
    </View>
  );
}

/** «6 de 10»: the count bold, «de 10» small and grey. */
function FigureValue({ value, accent }: { value: string; accent: boolean }) {
  const { count, rest } = figureParts(value);
  return (
    <Text className={`mt-0.5 text-[20px] font-bold ${accent ? 'text-primary' : 'text-on-surface'}`} style={{ fontVariant: ['tabular-nums'] }}>
      {count}{rest ? <Text className="font-mono text-[13px] font-normal text-on-surface-variant">{` ${rest}`}</Text> : null}
    </Text>
  );
}

/** The figures in one tinted row, split by thin lines (lv01): kicker on top, the number under it. */
export function VisitFigures({ block }: { block: TilesBlock }) {
  return (
    <View testID="visita-cifras" className="flex-row rounded-lg bg-surface-variant/60">
      {block.items.map((tile, index) => (
        <View key={`${tile.label}-${index}`} className={`min-w-0 flex-1 items-center px-2 py-2.5 ${index ? 'border-l border-outline/15' : ''}`}>
          <Text numberOfLines={1} className="text-[10px] font-bold uppercase tracking-[1px] text-on-surface-variant">{tile.label}</Text>
          <FigureValue value={tile.value} accent={/^puntos$/i.test(tile.label)} />
        </View>
      ))}
    </View>
  );
}
