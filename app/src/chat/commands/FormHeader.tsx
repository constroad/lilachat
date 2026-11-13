import { Pressable, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import type { CardContext } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { AppLogo } from '../../spaces/apps/AppLogo';
import { useColores } from '../../ui/tema';
import { TONE as PILL_TONE } from '../BotCardView';

/** A half of the card's width: the fields of the card go two per line. */
const HALF_WIDTH = '45%';

/** The app's tile, its name over the title, where it is and who registers, with the close (design gst-02). */
export function FormSheetHeader(props: { title: string; appName: string; avatarUrl?: string; /** «#flujo-caja»: the channel it was opened in. */ where?: string; personName?: string; onClose: () => void }) {
  const colors = useColores();
  const subtitle = [props.where ? `Canal ${props.where}` : '', props.personName ? `Registra: ${props.personName}` : ''].filter(Boolean).join(' · ');
  return (
    <View testID="formulario-cabecera" className="flex-row items-start gap-3 border-b border-outline/10 px-4 pb-3 pt-3">
      <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-primary/25 bg-primary/10">
        {props.avatarUrl ? <AppLogo avatarUrl={props.avatarUrl} size={40} /> : <Avatar nombre={props.appName} tamano={40} bot />}
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text className="shrink text-[11px] font-bold uppercase tracking-[1px] text-primary" numberOfLines={1}>{props.appName}</Text>
          <Text className="rounded border border-outline/30 px-1 text-[10px] font-bold uppercase tracking-[1px] text-on-surface-variant">App</Text>
        </View>
        <Text className="text-[18px] font-extrabold text-on-surface" numberOfLines={2}>{props.title}</Text>
        {subtitle ? <Text className="mt-0.5 text-[13px] text-on-surface-variant" numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <Pressable testID="btn-cerrar-formulario" accessibilityLabel="Cerrar" onPress={props.onClose} hitSlop={8} className="h-11 w-11 items-center justify-center">
        <X size={22} color={colors['on-surface-variant']} />
      </Pressable>
    </View>
  );
}

/** What the card said, above the fields (design gst-02): the figure, the shop, the state and what was read. */
export function FormContextCard({ context }: { context: CardContext }) {
  const tone = context.status ? PILL_TONE[context.status.tone] : null;
  return (
    <View testID="formulario-contexto" className="rounded-xl border border-outline/20 bg-background p-3">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-[11px] font-bold uppercase tracking-[1px] text-on-surface-variant">{context.kicker ?? ''}</Text>
        {context.status && tone ? (
          <View className={`rounded border px-1.5 ${tone.pill}`}>
            <Text className={`text-[10px] font-bold uppercase tracking-[1px] ${tone.text}`}>{context.status.label}</Text>
          </View>
        ) : null}
      </View>
      {context.figure ? <Text className="mt-0.5 text-[26px] font-extrabold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{context.figure}</Text> : null}
      <Text className={`mt-0.5 font-bold text-on-surface ${context.figure ? 'text-[15px]' : 'text-[18px]'}`}>{context.title}</Text>
      {context.fields.length ? (
        <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1.5 border-t border-outline/15 pt-2">
          {context.fields.map((field) => (
            <View key={`${field.label}-${field.value}`} style={{ minWidth: HALF_WIDTH }}>
              <Text className="text-[11px] text-on-surface-variant">{field.label}</Text>
              <Text className="text-[14px] font-semibold text-on-surface">{field.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
