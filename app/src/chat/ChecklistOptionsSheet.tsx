import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, Text, View } from 'react-native';
import { Trash2, X } from 'lucide-react-native';
import { CHECKLIST_LIMITS, type AgendaChecklist } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { FilledField, SectionLabel, ToggleRow } from '../agenda/createUi';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';

export type ChecklistEdit = { title: string; othersCanMark: boolean; othersCanAdd: boolean };

/**
 * The checklist's own options, for whoever made it (José, 21/10: how to edit
 * or delete a checklist): its title, who ticks and adds, and deleting it,
 * confirmed first because it cannot be undone.
 */
export function ChecklistOptionsSheet(props: { checklist: AgendaChecklist | null; onSave: (edit: ChecklistEdit) => void; onDelete: () => void; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const { checklist } = props;
  const [title, setTitle] = useState('');
  const [othersCanMark, setOthersCanMark] = useState(true);
  const [othersCanAdd, setOthersCanAdd] = useState(true);
  // The sheet lives mounted: it starts from the checklist each time it opens.
  useEffect(() => {
    if (!checklist) return;
    setTitle(checklist.title);
    setOthersCanMark(checklist.othersCanMark);
    setOthersCanAdd(checklist.othersCanAdd);
  }, [checklist]);
  const confirmDelete = () =>
    Alert.alert('¿Eliminar el checklist?', 'Se borra para todos los del chat, con sus tareas. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => { props.onDelete(); props.onClose(); } },
    ]);

  return (
    <Modal visible={checklist !== null} transparent animationType="slide" onRequestClose={props.onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cerrar" />
        <View testID="hoja-opciones-checklist" className="rounded-t-3xl bg-surface px-5 pt-3" style={{ paddingBottom: margins.pie + 8 }}>
          <View className="mb-1 h-1.5 w-11 self-center rounded-full bg-outline/30" />
          <View className="flex-row items-center">
            <Text className="flex-1 text-[11px] font-bold uppercase tracking-wider text-primary">Editar checklist</Text>
            <Pressable testID="opciones-checklist-cerrar" onPress={props.onClose} accessibilityLabel="Cerrar" className="h-11 w-11 items-center justify-center">
              <X size={20} color={colors['on-surface-variant']} />
            </Pressable>
          </View>
          <SectionLabel>Título</SectionLabel>
          <FilledField testID="opciones-checklist-titulo" value={title} onChangeText={setTitle} maxLength={CHECKLIST_LIMITS.title} />
          <ToggleRow testID="opciones-switch-marcar" label="Los demás pueden marcar tareas" hint="Si lo apagas, solo tú las marcas" value={othersCanMark} onChange={setOthersCanMark} />
          <ToggleRow testID="opciones-switch-agregar" label="Los demás pueden agregar y editar tareas" hint="Responsables, fechas y tareas nuevas" value={othersCanAdd} onChange={setOthersCanAdd} />
          <View className="mt-3 gap-2.5 border-t border-outline/15 pt-3">
            <Pressable testID="opciones-checklist-guardar" disabled={!title.trim()} onPress={() => { props.onSave({ title: title.trim(), othersCanMark, othersCanAdd }); props.onClose(); }} className="min-h-[48px] items-center justify-center rounded-xl bg-primary">
              <Text className="text-[15px] font-bold text-on-primary">Guardar cambios</Text>
            </Pressable>
            <Pressable testID="opciones-checklist-eliminar" onPress={confirmDelete} className="min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border border-error/40 bg-error/[0.06]">
              <Trash2 size={18} color={colors.error} />
              <Text className="text-[15px] font-semibold text-error">Eliminar el checklist</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
