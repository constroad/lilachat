import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AlarmClock } from 'lucide-react-native';
import { callBackOptions, callBackTitle } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { agendaPost } from '../agenda/agendaApi';

const TIME = new Intl.DateTimeFormat('es-PE', { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' });
const DAY = new Intl.DateTimeFormat('es-PE', { weekday: 'long' });
/** How long «Te lo recuerdo…» stays under the chat. */
const NOTICE_MS = 4000;

export type CallBackActions = { call: (video: boolean) => void; remind: (video: boolean) => void };

/**
 * «Llamar» and «Recordarme devolverla» on a missed call (backlog 23, José
 * 21/10). The reminder is PERSONAL (the other person does not see it in the
 * chat) and, when it rings, its notice opens this chat. Only in a 1:1: calls
 * are 1:1.
 */
export function useCallBack(params: { chatId: string; name: string; callName: string; jwt: string; enabled: boolean; llamar: (chatId: string, name: string, video: boolean) => void }): { actions?: CallBackActions; overlay: ReactNode } {
  const [asking, setAsking] = useState<{ video: boolean } | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const { chatId, name, callName, jwt, enabled, llamar } = params;
  useEffect(() => {
    if (!notice) return;
    const hide = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(hide);
  }, [notice]);
  const actions = useMemo(() => (enabled ? { call: (video: boolean) => llamar(chatId, callName, video), remind: (video: boolean) => setAsking({ video }) } : undefined), [enabled, llamar, chatId, callName]);
  const pick = async (date: Date, video: boolean) => {
    setAsking(null);
    const result = await agendaPost<{ id?: string }>('/reminders', jwt, { title: callBackTitle(name), startsAt: date.toISOString(), callBack: { chatId, video } });
    // No final period: the time already ends in «p. m.».
    setNotice(result.ok ? { text: `Te lo recuerdo ${whenText(date)}`, error: false } : { text: 'No se pudo guardar el recordatorio. Prueba de nuevo.', error: true });
  };
  const overlay = (
    <>
      <CallBackSheet visible={asking !== null} name={name} onPick={(date) => void pick(date, asking?.video ?? false)} onClose={() => setAsking(null)} />
      {notice ? (
        <Text testID="aviso-devolver" className={`px-4 pb-1 text-sm ${notice.error ? 'text-error' : 'text-primary'}`}>
          {notice.text}
        </Text>
      ) : null}
    </>
  );
  return { actions, overlay };
}

/** «a las 5:00 p. m.», or «mañana a las 9:00 a. m.» when it is not today. */
function whenText(date: Date): string {
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toDateString() === date.toDateString();
  const prefix = sameDay ? '' : tomorrow ? 'mañana ' : `el ${DAY.format(date)} `;
  return `${prefix}a las ${TIME.format(date)}`;
}

/** The quick times of «Recordarme devolverla» (`callBackOptions`), in a sheet like the other chat sheets. */
function CallBackSheet(props: { visible: boolean; name: string; onPick: (date: Date) => void; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  // Computed when it opens: «En 15 min» counts from then.
  const options = useMemo(() => (props.visible ? callBackOptions(new Date()) : []), [props.visible]);
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cerrar" />
      <View testID="hoja-devolver" className="rounded-t-xl bg-surface px-5 pt-3" style={{ paddingBottom: margins.pie }}>
        <View className="mb-3 h-1.5 w-11 self-center rounded-full bg-outline/30" />
        <Text className="text-base font-bold text-on-surface">Recordarme devolverla</Text>
        <Text className="mb-2 text-[13px] text-on-surface-variant" numberOfLines={1}>
          {callBackTitle(props.name)}
        </Text>
        {options.map((option) => (
          <Pressable key={option.id} testID={`devolver-${option.id}`} onPress={() => props.onPick(option.date)} className="min-h-[56px] flex-row items-center gap-4">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-primary/10">
              <AlarmClock size={20} color={colors.primary} />
            </View>
            <Text className="flex-1 text-[15px] font-semibold text-on-surface">{option.label}</Text>
            <Text className="text-[13px] text-on-surface-variant">{TIME.format(option.date)}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}
