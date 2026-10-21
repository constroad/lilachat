import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Circle, CirclePlus, Send, X } from 'lucide-react-native';
import { CHECKLIST_LIMITS, validateChecklist } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { agendaPost } from './agendaApi';
import { FilledField, PrimaryAction, SectionLabel, ToggleRow } from './createUi';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';

/**
 * A new checklist in the chat, like Telegram's (backlog 8, José 21/10; design
 * `k-02-crear-checklist`): title, tasks and whether the others tick and add.
 * Always from a chat: a checklist belongs to the people who work on it. It
 * goes pinned by default so it is not lost in the messages (backlog 30); from
 * a thread (`threadOf`) it stays in the thread and is not pinned.
 */
export function CreateChecklistScreen(props: { visible: boolean; jwt: string; chat: { id: string; name: string }; threadOf?: number; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const [title, setTitle] = useState('');
  const [items, setItems] = useState(['', '', '']);
  const [othersCanMark, setOthersCanMark] = useState(true);
  const [othersCanAdd, setOthersCanAdd] = useState(true);
  const [pin, setPin] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const written = Boolean(title.trim() || items.some((item) => item.trim()));

  const submit = async () => {
    if (saving) return;
    const valid = validateChecklist({ title, items });
    if (!valid.ok) return setError(valid.message);
    setSaving(true);
    const result = await agendaPost('/checklists', props.jwt, { chatId: props.chat.id, title: valid.title, items: valid.items, othersCanMark, othersCanAdd, ...(props.threadOf === undefined ? { pin } : { hiloDe: props.threadOf }) });
    setSaving(false);
    if (!result.ok) return setError(result.message ?? 'No se pudo enviar el checklist.');
    setTitle('');
    setItems(['', '', '']);
    setError('');
    props.onClose();
  };

  return (
    // Back closes only with nothing written: it also fires when the keyboard closes (`CreatePollScreen`).
    <Modal visible={props.visible} animationType="slide" onRequestClose={() => !written && props.onClose()}>
      <View className="flex-1 bg-background" testID="crear-checklist">
        <View className="flex-row items-center gap-2 px-4 pb-2" style={{ paddingTop: margins.cabecera }}>
          <Pressable onPress={props.onClose} testID="btn-cerrar-checklist" className="h-11 w-11 items-center justify-center">
            <X size={22} color={colors['on-surface']} />
          </Pressable>
          <Text className="flex-1 text-lg font-bold text-on-surface">Nuevo checklist</Text>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <SectionLabel>Título del checklist</SectionLabel>
          <FilledField testID="input-checklist-titulo" placeholder="Vaciado de losa · jueves" value={title} maxLength={CHECKLIST_LIMITS.title} onChangeText={(text) => { setTitle(text); setError(''); }} />
          <SectionLabel>{`Tareas (${items.filter((item) => item.trim()).length} de ${CHECKLIST_LIMITS.items})`}</SectionLabel>
          {items.map((item, index) => (
            <View key={index} className="mb-2 flex-row items-center gap-2">
              <Circle size={22} color={colors.outline} />
              <View className="flex-1">
                <FilledField testID={`input-tarea-${index}`} placeholder={index === items.length - 1 ? 'Agregar tarea' : `Tarea ${index + 1}`} value={item} maxLength={CHECKLIST_LIMITS.item} onChangeText={(text) => { setItems((current) => current.map((one, position) => (position === index ? text : one))); setError(''); }} />
              </View>
              {items.length > 1 ? (
                <Pressable testID={`quitar-tarea-${index}`} accessibilityLabel="Quitar la tarea" hitSlop={8} onPress={() => setItems((current) => current.filter((_, position) => position !== index))} className="h-11 w-9 items-center justify-center">
                  <X size={18} color={colors['on-surface-variant']} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {items.length < CHECKLIST_LIMITS.items ? (
            <Pressable testID="btn-agregar-tarea" onPress={() => setItems((current) => [...current, ''])} className="min-h-[44px] flex-row items-center gap-2">
              <CirclePlus size={18} color={colors.primary} />
              <Text className="text-[15px] font-semibold text-primary">Agregar otra tarea</Text>
            </Pressable>
          ) : null}
          <SectionLabel>Ajustes</SectionLabel>
          <ToggleRow testID="switch-marcar" label="Los demás pueden marcar tareas" hint="Si lo apagas, solo tú las marcas" value={othersCanMark} onChange={setOthersCanMark} />
          <ToggleRow testID="switch-agregar" label="Los demás pueden agregar tareas" hint="Para sumar lo que falte sobre la marcha" value={othersCanAdd} onChange={setOthersCanAdd} />
          {props.threadOf === undefined ? <ToggleRow testID="switch-fijar" label="Fijar en el chat" hint="Queda arriba de la conversación, a un toque" value={pin} onChange={setPin} /> : null}
          {error ? <Text className="mt-3 text-sm text-error" testID="error-checklist">{error}</Text> : null}
        </ScrollView>
        <View className="px-4 pt-2" style={{ paddingBottom: margins.pie }}>
          <PrimaryAction testID="btn-enviar-checklist" disabled={saving} onPress={() => void submit()} icon={<Send size={17} color={colors['on-primary']} />} label={saving ? 'Enviando…' : 'Enviar checklist'} />
        </View>
      </View>
    </Modal>
  );
}
