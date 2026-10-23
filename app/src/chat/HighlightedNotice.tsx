import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { BellRing, CalendarDays, ChevronRight } from 'lucide-react-native';
import { formatClock } from '@lilachat/shared';
import { DeslizarParaResponder } from './DeslizarParaResponder';
import type { ChatMessage } from './useChat';
import { useColores } from '../ui/tema';
import { ReminderDetailScreen } from '../agenda/ReminderDetailScreen';

/** The emoji at the start of the text: the icon takes its place. */
const LEADING_EMOJI = /^(⏰|📅)\s*/u;
/** Same hold as a bubble. */
const LONG_PRESS_MS = 350;

/**
 * The reminder that rang or the event coming up (José, 20/10), as a card in the
 * middle of the chat. It is answered like a message (José, 21/10: he could not
 * react, reply or send a sticker to it): swiping replies, holding selects it
 * (reactions, thread, pin, star) and, while selecting, a tap adds or removes it.
 */
export function HighlightedNotice(props: {
  item: ChatMessage;
  text: string;
  mine: boolean;
  selecting: boolean;
  selected: boolean;
  onSelect?: (seq: number) => void;
  onReply?: (seq: number, preview: string, mine: boolean) => void;
  /** Pending 76: the reminder that rang opens to read its note and links. */
  jwt?: string;
}) {
  const { item } = props;
  const reminderId = item.ref?.tipo === 'recordatorio' && props.jwt ? item.ref.id : null;
  const [open, setOpen] = useState(false);
  const colors = useColores();
  const Icon = item.system?.evento === 'evento-pronto' ? CalendarDays : BellRing;
  const select = () => {
    void Haptics.selectionAsync();
    props.onSelect?.(item.seq);
  };
  return (
    <DeslizarParaResponder habilitado={!props.selecting && Boolean(props.onReply)} onResponder={() => props.onReply?.(item.seq, props.text, props.mine)}>
      <View className={`-mx-3 items-center px-3 py-2 ${props.selected ? 'bg-primary/15' : ''}`} testID={`aviso-destacado-${item.seq}`}>
        <Pressable
          testID={`mantener-aviso-${item.seq}`}
          onLongPress={select}
          onPress={props.selecting ? () => props.onSelect?.(item.seq) : reminderId ? () => setOpen(true) : undefined}
          delayLongPress={LONG_PRESS_MS}
          className="max-w-[88%] flex-row items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2.5"
        >
          <Icon size={18} color={colors.primary} />
          <Text className="flex-shrink text-[14px] font-semibold text-on-surface">{props.text.replace(LEADING_EMOJI, '')}</Text>
          <Text className="text-[11px] text-on-surface-variant">{formatClock(item.at)}</Text>
          {reminderId ? <ChevronRight size={16} color={colors.primary} /> : null}
        </Pressable>
      </View>
      {open && reminderId && props.jwt ? <ReminderDetailScreen reminderId={reminderId} jwt={props.jwt} onClose={() => setOpen(false)} /> : null}
    </DeslizarParaResponder>
  );
}
