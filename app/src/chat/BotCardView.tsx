import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import type { BotCard, CardActionStyle, CardTone } from '@lilachat/shared';
import { BASE_URL } from '../api/client';
import { useColores } from '../ui/tema';

/** The status pill's tone (design `e-21`): background faint, border at 30 %, text strong. */
const TONE: Record<CardTone, { pill: string; text: string }> = {
  ok: { pill: 'border-en-linea/30 bg-en-linea/10', text: 'text-en-linea' },
  warn: { pill: 'border-warning/30 bg-warning/10', text: 'text-warning' },
  error: { pill: 'border-error/30 bg-error/10', text: 'text-error' },
  info: { pill: 'border-primary/30 bg-primary/10', text: 'text-primary' },
  neutral: { pill: 'border-outline/30 bg-background', text: 'text-on-surface-variant' },
};
const ACTION: Record<CardActionStyle, { box: string; text: string }> = {
  primary: { box: 'bg-primary', text: 'text-on-primary' },
  secondary: { box: 'border border-outline/25', text: 'text-on-surface' },
  danger: { box: 'border border-error/30', text: 'text-error' },
};

/**
 * A bot's card in the chat (`specs/BOTS-API.spec.md` §b; design `e-21`), like
 * the web's: kicker, title, status, fields, link and up to three actions. A
 * tap reaches the bot as `button.click`; the bot closes the card, so after the
 * tap the buttons only say it was sent.
 */
export function BotCardView(props: { card: BotCard; chatId: string; seq: number; jwt: string }) {
  const { card } = props;
  const colors = useColores();
  const [sent, setSent] = useState<{ id: string; state: 'sending' | 'sent' } | null>(null);
  const [error, setError] = useState('');
  const tap = async (actionId: string) => {
    setSent({ id: actionId, state: 'sending' });
    setError('');
    const response = await fetch(`${BASE_URL}/api/chats/${props.chatId}/card-actions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.jwt}` }, body: JSON.stringify({ seq: props.seq, action_id: actionId }) }).catch(() => null);
    if (response?.ok) return setSent({ id: actionId, state: 'sent' });
    const data = response ? ((await response.json().catch(() => ({}))) as { message?: string }) : {};
    setSent(null);
    setError(data.message ?? 'No se pudo enviar. Revisa tu conexión.');
  };
  return (
    <View testID="tarjeta-bot" className="m-1 overflow-hidden rounded-xl border border-outline/15 bg-surface" style={{ minWidth: 240, maxWidth: 300 }}>
      <View className="gap-2 px-3.5 py-3">
        {card.kicker ? <Text className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{card.kicker}</Text> : null}
        <View className="flex-row items-start gap-2">
          <Text className="min-w-0 flex-1 text-[15px] font-bold leading-5 text-on-surface">{card.title}</Text>
          {card.status ? (
            <View className={`rounded-full border px-2 py-0.5 ${TONE[card.status.tone].pill}`}>
              <Text className={`text-[10px] font-bold uppercase ${TONE[card.status.tone].text}`}>{card.status.label}</Text>
            </View>
          ) : null}
        </View>
        {card.fields.length ? (
          <View className="flex-row flex-wrap">
            {card.fields.map((field) => (
              <View key={`${field.label}-${field.value}`} className="w-1/2 py-0.5 pr-2">
                <Text className="text-[11px] text-on-surface-variant">{field.label}</Text>
                <Text numberOfLines={1} className="text-[13px] font-semibold text-on-surface">{field.value}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {card.link ? (
          <Pressable testID="tarjeta-enlace" onPress={() => void Linking.openURL(card.link!.url)} hitSlop={6} className="flex-row items-center gap-1 self-start">
            <Text className="text-[13px] font-semibold text-primary">{card.link.label}</Text>
            <ExternalLink size={13} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      {card.actions?.length ? (
        <View className="flex-row gap-2 border-t border-outline/10 px-3.5 py-2.5">
          {card.actions.map((action) => (
            <Pressable key={action.id} testID={`accion-tarjeta-${action.id}`} disabled={sent !== null} onPress={() => void tap(action.id)} className={`h-10 flex-1 items-center justify-center rounded-full px-3 ${ACTION[action.style].box} ${sent !== null ? 'opacity-60' : ''}`}>
              <Text className={`text-[13px] font-semibold ${ACTION[action.style].text}`}>{sent?.id === action.id ? (sent.state === 'sending' ? 'Enviando…' : 'Enviado ✓') : action.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {error ? <Text className="border-t border-outline/10 px-3.5 py-2 text-[12px] text-error">{error}</Text> : null}
    </View>
  );
}
