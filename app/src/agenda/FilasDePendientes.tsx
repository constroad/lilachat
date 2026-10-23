import { Pressable, Text, View } from 'react-native';
import { Bell, ChevronRight, MapPin } from 'lucide-react-native';
import { ETIQUETA_DE_REPETICION, cuandoDelEvento, estadoDelEvento, formatEventWhen, origenDelRecordatorio, type TonoDelEstado } from '@lilachat/shared';
import type { AgendaEvent, AgendaReminder } from './agendaApi';
import { Interruptor } from '../ui/Interruptor';
import { useColores } from '../ui/tema';
import { repeatLabel } from '@lilachat/shared';

const DIA = new Intl.DateTimeFormat('es-PE', { weekday: 'short' });
/** La pastilla del estado: caja y texto por tono, con los colores del tema. */
const TONO: Record<TonoDelEstado, { caja: string; texto: string }> = {
  propio: { caja: 'border-primary/30 bg-primary/10', texto: 'text-primary' },
  pendiente: { caja: 'border-tertiary/30 bg-tertiary/10', texto: 'text-tertiary' },
  ok: { caja: 'border-primary/40 bg-primary/15', texto: 'text-primary' },
  neutro: { caja: 'border-outline/20 bg-surface-variant', texto: 'text-on-surface-variant' },
};

/** Un evento en «Pendientes»: el día, qué, cuándo y dónde, y la pastilla de mi respuesta. */
export function FilaDeEvento({ evento, onAbrir }: { evento: AgendaEvent; onAbrir: () => void }) {
  const colores = useColores();
  const inicio = new Date(evento.startsAt);
  const estado = estadoDelEvento(evento);
  return (
    <Pressable testID={`pendiente-evento-${evento.id}`} onPress={onAbrir} android_ripple={{ color: colores.outline }} className="mb-2 min-h-[64px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-3">
      <View className="w-12 items-center rounded-lg border border-outline/15 py-1">
        <Text className="text-[10px] font-bold uppercase text-primary">{DIA.format(inicio).replace('.', '')}</Text>
        <Text className="text-lg font-bold text-on-surface">{inicio.getDate()}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold text-on-surface" numberOfLines={1}>{evento.title}</Text>
        <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>{cuandoDelEvento(evento.startsAt, evento.endsAt)}</Text>
        {evento.location ? (
          <View className="flex-row items-center gap-1">
            <MapPin size={11} color={colores['on-surface-variant']} />
            <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>{evento.location}</Text>
          </View>
        ) : null}
      </View>
      <View className={`rounded-full border px-2 py-0.5 ${TONO[estado.tono].caja}`}>
        <Text className={`text-[11px] font-semibold ${TONO[estado.tono].texto}`}>{estado.texto}</Text>
      </View>
      <ChevronRight size={16} color={colores.outline} />
    </Pressable>
  );
}

/**
 * Un recordatorio en «Pendientes»: qué, cuándo suena y de dónde viene. Si ya
 * sonó (Vencidos), «Posponer» lo abre para elegir otra hora; los apagados
 * llevan su interruptor.
 */
export function FilaDeRecordatorio(props: { recordatorio: AgendaReminder; cuando: Date; agenda: ReadonlyMap<string, string>; vencido?: boolean; onEditar: () => void; onPrender?: (activo: boolean) => void }) {
  const colores = useColores();
  const { recordatorio } = props;
  const repetido = recordatorio.recurrence !== 'once';
  return (
    <Pressable testID={`pendiente-recordatorio-${recordatorio._id}`} onPress={props.onEditar} android_ripple={{ color: colores.outline }} className={`mb-2 min-h-[64px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-3 ${props.onPrender && !recordatorio.active ? 'opacity-70' : ''}`}>
      <View className="h-11 w-11 items-center justify-center rounded-full bg-primary/10">
        <Bell size={19} color={colores.primary} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold text-on-surface" numberOfLines={1}>{recordatorio.title}</Text>
        <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>
          {props.vencido ? `Sonó ${formatEventWhen(props.cuando).toLowerCase()}` : `${repetido ? `${repeatLabel(recordatorio.recurrence, recordatorio.repeat, ETIQUETA_DE_REPETICION[recordatorio.recurrence])} · ` : ''}${formatEventWhen(props.cuando)}`}
        </Text>
        <Text className="text-[11px] text-on-surface-variant" numberOfLines={1}>{origenDelRecordatorio({ chat: recordatorio.chat, agenda: props.agenda })}</Text>
      </View>
      {props.vencido ? (
        <Pressable testID={`posponer-${recordatorio._id}`} onPress={props.onEditar} className="min-h-[36px] justify-center rounded-full bg-primary/10 px-3">
          <Text className="text-[12px] font-semibold text-primary">Posponer</Text>
        </Pressable>
      ) : props.onPrender ? (
        <Interruptor testID={`switch-${recordatorio._id}`} value={recordatorio.active} onValueChange={props.onPrender} />
      ) : null}
    </Pressable>
  );
}
