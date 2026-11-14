import { Pressable, Text, View } from 'react-native';
import { Camera, CircleCheck, FileText, ImagePlus, ListChecks, Map as MapIcon, type LucideIcon } from 'lucide-react-native';
import { visitCardActionOf, type CardAction, type VisitCardAction } from '@lilachat/shared';
import { TONE_COLOR } from '../../chat/botBlocks/tones';
import { useColores } from '../../ui/tema';

/** A theme color's name, as the tones use it. */
type ThemeColor = (typeof TONE_COLOR)[keyof typeof TONE_COLOR];

type SentAction = { id: string; state: 'sending' | 'sent' } | null;
const BUTTON_ICON = 20;

/** lv01: each visit button with its icon; «Terminar» in the online tone. */
const VISIT_ICON: Record<VisitCardAction, { icon: LucideIcon; tone: ThemeColor }> = {
  point: { icon: Camera, tone: TONE_COLOR.info },
  interview: { icon: ListChecks, tone: TONE_COLOR.info },
  photo: { icon: ImagePlus, tone: TONE_COLOR.info },
  finish: { icon: CircleCheck, tone: TONE_COLOR.ok },
  pdf: { icon: FileText, tone: TONE_COLOR.info },
  croquis: { icon: MapIcon, tone: TONE_COLOR.info },
};

const labelOf = (action: CardAction, sent: SentAction) => (sent?.id === action.id ? (sent.state === 'sending' ? 'Enviando…' : 'Enviado ✓') : action.label);

/** The visit card's buttons two by two (Stitch lv01), 56 tall; with an odd number the first goes across. */
export function VisitCardButtons(props: { actions: CardAction[]; sent: SentAction; onPress: (action: CardAction) => void }) {
  const colors = useColores();
  const { actions, sent } = props;
  return (
    <View testID="tarjeta-acciones-grilla" className="flex-row flex-wrap justify-between gap-y-2 px-3.5 pb-3 pt-1">
      {actions.map((action, index) => {
        const visit = visitCardActionOf(action.id);
        const Icon = visit ? VISIT_ICON[visit].icon : null;
        const primary = action.style === 'primary';
        const wide = index === 0 && actions.length % 2 === 1;
        return (
          <Pressable key={action.id} testID={`accion-tarjeta-${action.id}`} disabled={sent !== null} onPress={() => props.onPress(action)} style={{ width: wide ? '100%' : '48.5%' }} className={`min-h-[56px] flex-row items-center justify-center gap-2 rounded-[10px] px-2 ${primary ? 'bg-primary' : 'border border-outline/25 bg-surface'} ${sent !== null ? 'opacity-60' : ''}`}>
            {Icon ? <Icon size={BUTTON_ICON} color={primary ? colors['on-primary'] : colors[VISIT_ICON[visit!].tone]} /> : null}
            <Text numberOfLines={2} className={`shrink text-center text-[13px] font-bold uppercase ${primary ? 'text-on-primary' : 'text-on-surface'}`}>{labelOf(action, sent)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
