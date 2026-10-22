import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Phone, Video, X } from 'lucide-react-native';
import { nextHalfHour, scheduledCallTitle } from '@lilachat/shared';
import { agendaPost } from '../../agenda/agendaApi';
import { Modal } from '../../ui/Modal';
import { Segmentado } from '../../ui/Segmentado';
import { SelectorDeCuando } from '../../ui/SelectorDeCuando';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';

/** The reminder of a scheduled call: just before it, not an hour like an event. */
const REMIND_MINUTES_BEFORE = 5;
const KINDS = [
  { key: 'voice', etiqueta: 'Voz', testID: 'tipo-llamada-voz', Icono: Phone },
  { key: 'video', etiqueta: 'Video', testID: 'tipo-llamada-video', Icono: Video },
] as const;

/**
 * «Programar llamada» from a 1:1 chat's call menu (pending 42, José 22/10),
 * like WhatsApp: an event with the call's kind. Its card in the chat invites
 * the other person, the agenda reminds both 5 minutes before, and the card
 * offers «Unirse» from 10 minutes before.
 */
export function ScheduleCallScreen(props: { visible: boolean; jwt: string; chat: { id: string; name: string }; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const [kind, setKind] = useState<'voice' | 'video'>('voice');
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [when, setWhen] = useState(() => nextHalfHour(new Date()));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { visible, chat } = props;

  useEffect(() => {
    if (!visible) return;
    setKind('voice');
    setTitleTouched(false);
    setWhen(nextHalfHour(new Date()));
    setError('');
  }, [visible]);
  // The title follows the kind until the person writes their own.
  useEffect(() => {
    if (!titleTouched) setTitle(scheduledCallTitle(chat.name, kind === 'video'));
  }, [kind, chat.name, titleTouched]);

  const schedule = async () => {
    if (!title.trim()) return setError('Ponle un nombre a la llamada.');
    if (when.getTime() <= Date.now()) return setError('Elige una hora que todavía no pasó.');
    setSaving(true);
    const response = await agendaPost('/events', props.jwt, { chatId: chat.id, title: title.trim(), startsAt: when.toISOString(), call: { video: kind === 'video' }, remindMinutesBefore: REMIND_MINUTES_BEFORE, remindGuests: true });
    setSaving(false);
    if (response.ok) props.onClose();
    else setError(response.message ?? 'No se pudo programar la llamada. Prueba de nuevo.');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cerrar" />
      <View testID="programar-llamada" className="rounded-t-3xl bg-surface px-4 pt-3" style={{ paddingBottom: margins.pie + 8 }}>
        <View className="mb-2 h-1.5 w-11 self-center rounded-full bg-outline/30" />
        <View className="mb-3 flex-row items-center">
          <Text className="flex-1 text-lg font-bold text-on-surface">Programar llamada</Text>
          <Pressable testID="btn-cerrar-programar-llamada" accessibilityLabel="Cerrar" onPress={props.onClose} className="h-11 w-11 items-center justify-center">
            <X size={20} color={colors['on-surface-variant']} />
          </Pressable>
        </View>
        <Segmentado opciones={KINDS} valor={kind} onCambiar={setKind} />
        <TextInput
          testID="campo-titulo-llamada"
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            setTitleTouched(true);
            setError('');
          }}
          placeholder="Nombre de la llamada"
          placeholderTextColor={colors['on-surface-variant']}
          className="mt-3 min-h-[48px] rounded-xl border border-outline/30 px-4 text-[15px] text-on-surface"
        />
        <View className="mt-3">
          <SelectorDeCuando valor={when} onCambiar={setWhen} prefijo="llamada" />
        </View>
        <Text className="mt-2 text-[12px] text-on-surface-variant">Les avisamos a los dos 5 minutos antes. Pueden unirse desde 10 minutos antes.</Text>
        {error ? <Text testID="error-programar-llamada" className="mt-2 text-[13px] text-error">{error}</Text> : null}
        <Pressable testID="btn-programar-llamada" disabled={saving} onPress={() => void schedule()} className={`mt-4 min-h-[48px] items-center justify-center rounded-full bg-primary ${saving ? 'opacity-60' : ''}`}>
          <Text className="text-sm font-semibold text-on-primary">{saving ? 'Programando…' : 'Programar'}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
