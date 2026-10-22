import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { queueDetail, queueKicker, type QueueItem, type QueueKind } from '@lilachat/shared';
import { useColores } from '../ui/tema';
import { useChatQueue, type QueueAction } from './useChatQueue';

/** Each kind's tone (design `q-01-tarjetas-en-cola`): a late task in red; the rest, the accent. */
const KICKER_TONE: Record<QueueKind, { pill: string; text: string; dot: string }> = {
  task: { pill: 'border-error/30 bg-error/10', text: 'text-error', dot: 'bg-error' },
  event: { pill: 'border-warning/30 bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  poll: { pill: 'border-primary/30 bg-primary/10', text: 'text-primary', dot: 'bg-primary' },
  reminder: { pill: 'border-primary/30 bg-primary/10', text: 'text-primary', dot: 'bg-primary' },
};

type Button = { label: string; action?: QueueAction; open?: boolean; dismiss?: boolean; primary?: boolean };

/** What each card offers: doing the thing, or opening its card in the chat. */
function buttonsOf(item: QueueItem): Button[] {
  if (item.kind === 'task') return [{ label: 'Marcar hecha', action: 'done', primary: true }, ...(item.canPostpone ? [{ label: 'Posponer 1 día', action: 'postpone' as const }] : [])];
  if (item.kind === 'event') return [{ label: 'Voy', action: 'yes', primary: true }, { label: 'No voy', action: 'no' }];
  if (item.kind === 'poll') return item.seq ? [{ label: 'Votar', open: true, primary: true }] : [];
  return [...(item.seq ? [{ label: 'Ver en el chat', open: true, primary: true }] : []), { label: 'Listo', dismiss: true }];
}

/**
 * The cards queued over the writing bar (backlog 36, José 21/10: like
 * Claude's chips): one in front, the next ones peeking behind, «1 de N», and
 * each worked through with its action or dismissed with the X.
 */
export function ChatQueue(props: { jwt: string; chatId: string; onOpen: (seq: number) => void }) {
  const colors = useColores();
  const { visible, busy, act, dismiss } = useChatQueue(props.jwt, props.chatId);
  const [error, setError] = useState<string | null>(null);
  const item = visible[0];
  if (!item) return null;
  const tone = KICKER_TONE[item.kind];
  const detail = queueDetail(item, new Date());
  const [context, late] = item.kind === 'task' ? [item.context, detail.slice(item.context.length + 3)] : [null, detail];
  const press = (button: Button) => {
    setError(null);
    if (button.open && item.seq) props.onOpen(item.seq);
    else if (button.dismiss) dismiss(item);
    else if (button.action) void act(item, button.action).then(setError);
  };
  return (
    <View testID="cola-del-chat" className="mx-3 mb-2">
      {visible.length > 2 ? <View className="mx-6 h-2 rounded-t-2xl border border-b-0 border-outline/15 bg-surface" /> : null}
      {visible.length > 1 ? <View className="mx-3 h-2 rounded-t-2xl border border-b-0 border-outline/15 bg-surface" /> : null}
      <View className="rounded-2xl border border-outline/15 bg-surface p-4">
        <View className="flex-row items-center gap-2">
          <View className={`flex-row items-center gap-1.5 rounded-md border px-2 py-1 ${tone.pill}`}>
            <View className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            <Text className={`text-[11px] font-bold uppercase tracking-wider ${tone.text}`}>{queueKicker(item.kind)}</Text>
          </View>
          <View className="flex-1" />
          {visible.length > 1 ? (
            <View className="rounded-full border border-outline/20 px-2 py-0.5">
              <Text className="text-[12px] text-on-surface-variant">{`1 de ${visible.length}`}</Text>
            </View>
          ) : null}
          <Pressable testID="cola-descartar" accessibilityLabel="Descartar" hitSlop={10} onPress={() => dismiss(item)} className="h-8 w-8 items-center justify-center">
            <X size={18} color={colors['on-surface-variant']} />
          </Pressable>
        </View>
        <Pressable disabled={!item.seq} onPress={() => item.seq && props.onOpen(item.seq)}>
          <Text testID="cola-titulo" numberOfLines={2} className="mt-2 text-[16px] font-semibold text-on-surface">{item.title}</Text>
          <Text numberOfLines={1} className="mt-0.5 text-[13px] text-on-surface-variant">
            {context ? `${context} · ` : ''}
            <Text className={item.kind === 'task' ? 'text-error' : 'text-on-surface-variant'}>{late}</Text>
          </Text>
        </Pressable>
        {error ? <Text className="mt-2 text-[13px] text-error">{error}</Text> : null}
        <View className="mt-3 flex-row gap-2">
          {buttonsOf(item).map((button) => (
            <Pressable key={button.label} testID={`cola-${button.action ?? (button.open ? 'abrir' : 'listo')}`} disabled={busy} onPress={() => press(button)} className={`min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-xl px-4 ${button.primary ? 'flex-1 bg-primary' : 'border border-outline/25 bg-surface'}`}>
              {busy && button.primary ? <ActivityIndicator size="small" color={colors['on-primary']} /> : button.action === 'done' ? <Check size={16} color={colors['on-primary']} strokeWidth={3} /> : null}
              <Text className={`text-[14px] font-semibold ${button.primary ? 'text-on-primary' : 'text-on-surface'}`}>{button.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
