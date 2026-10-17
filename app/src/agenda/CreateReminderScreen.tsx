import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Bell, Send, Trash2, X } from 'lucide-react-native';
import type { Recurrence } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { agendaDelete, agendaPatch, agendaPost, type AgendaReminder } from './agendaApi';
import { FilledField, PrimaryAction, SectionLabel } from './createUi';
import { SelectorDeCuando } from '../ui/SelectorDeCuando';
import { valorInicial } from '../ui/cuando';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';

/**
 * Crear o EDITAR un recordatorio.
 *
 * **Stitch no diseñó esta pantalla** —solo la lista, «My Reminders»—. Se
 * construye con el lenguaje de las otras dos (rótulos en acento, campos
 * rellenos, botón de ancho completo) y con el héroe del evento.
 *
 * Desde el 17/10/2026 (José: «no hay como editar avisos», «no hay como elegir
 * una hora específica»): con `editando` la misma pantalla edita y ofrece
 * eliminar, y el cuándo es día y hora exactos (`SelectorDeCuando`) en vez de
 * cuatro atajos relativos.
 */
const RECURRENCIAS: { valor: Recurrence; etiqueta: string }[] = [
  { valor: 'once', etiqueta: 'Una vez' },
  { valor: 'daily', etiqueta: 'Diario' },
  { valor: 'weekly', etiqueta: 'Semanal' },
];

export function CreateReminderScreen({
  visible,
  credential,
  editando,
  onClose,
  onCreated,
}: {
  visible: boolean;
  credential: Credential;
  /** Con un recordatorio, la pantalla lo edita; sin él, crea uno nuevo. */
  editando?: AgendaReminder;
  onClose: () => void;
  /** Se creó, editó o borró algo: la lista vuelve a pedir. */
  onCreated: () => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  // La pantalla se monta al abrirse (TabsShell/Agenda la montan condicional),
  // así que los iniciales desde `editando` son los de ESTA apertura.
  const [title, setTitle] = useState(editando?.title ?? '');
  const [note, setNote] = useState(editando?.note ?? '');
  const [cuando, setCuando] = useState(() => valorInicial(editando?.startsAt, new Date()));
  const [recurrence, setRecurrence] = useState<Recurrence>(editando?.recurrence ?? 'once');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving) return;
    if (!title.trim()) return setError('Escribe de qué es.');
    if (cuando.getTime() < Date.now() && recurrence === 'once') return setError('Esa hora ya pasó. Elige una que venga.');

    setSaving(true);
    const cuerpo = { title: title.trim(), note: note.trim(), startsAt: cuando.toISOString(), recurrence };
    const result = editando
      ? await agendaPatch(`/reminders/${editando._id}`, credential.jwt, cuerpo)
      : await agendaPost('/reminders', credential.jwt, { ...cuerpo, note: cuerpo.note || undefined });
    setSaving(false);

    if (!result.ok) return setError(result.message ?? 'No se pudo guardar.');
    onCreated();
    onClose();
  };

  const eliminar = () => {
    if (!editando) return;
    Alert.alert('Eliminar recordatorio', `«${editando.title}» deja de sonar y desaparece de la lista.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          void agendaDelete(`/reminders/${editando._id}`, credential.jwt).then((result) => {
            if (!result.ok) return setError(result.message ?? 'No se pudo eliminar.');
            onCreated();
            onClose();
          }),
      },
    ]);
  };

  /**
   * ATRÁS de Android. `onRequestClose` también se dispara al bajar el teclado
   * con atrás: solo se cierra si no hay nada escrito (o, editando, si nada
   * cambió). Con cambios queda la X, que es explícita.
   */
  const hayCambios = editando
    ? title !== editando.title || note !== (editando.note ?? '')
    : Boolean(title.trim() || note.trim());

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => (hayCambios ? undefined : onClose())}>
      <View className="flex-1 bg-background" testID="crear-reminder">
        <View className="flex-row items-center gap-2 px-4 pb-2" style={{ paddingTop: margenes.cabecera }}>
          <Pressable onPress={onClose} testID="btn-cerrar-crear" className="h-11 w-11 items-center justify-center">
            <X size={22} color={colores['on-surface']} />
          </Pressable>
          <View className="flex-1" />
          {editando ? (
            <Pressable
              onPress={eliminar}
              testID="btn-eliminar-recordatorio"
              accessibilityLabel="Eliminar recordatorio"
              className="h-11 w-11 items-center justify-center"
            >
              <Trash2 size={20} color={colores.error} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <View className="items-center pb-2">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-primary">
              <Bell size={24} color={colores['on-primary']} />
            </View>
            <Text className="mt-3 text-2xl font-bold text-primary">{editando ? 'Editar recordatorio' : 'Nuevo recordatorio'}</Text>
            <Text className="mt-1 text-center text-[13px] leading-5 text-on-surface-variant">Para que no se te pase nada.</Text>
          </View>

          <SectionLabel>Qué recordar</SectionLabel>
          <FilledField
            testID="input-titulo"
            placeholder="Tomar agua"
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              setError('');
            }}
          />
          <View className="mt-2">
            <FilledField testID="input-nota" placeholder="Nota (opcional)" value={note} onChangeText={setNote} />
          </View>

          <SectionLabel>Cuándo</SectionLabel>
          <SelectorDeCuando
            valor={cuando}
            onCambiar={(fecha) => {
              setCuando(fecha);
              setError('');
            }}
          />

          <SectionLabel>Repetir</SectionLabel>
          <View className="flex-row gap-2">
            {RECURRENCIAS.map((opcion) => (
              <Pressable
                key={opcion.valor}
                testID={`recurrencia-${opcion.valor}`}
                onPress={() => setRecurrence(opcion.valor)}
                className={`min-h-[44px] flex-1 items-center justify-center rounded-xl ${
                  recurrence === opcion.valor ? 'bg-primary' : 'bg-primary/[0.07]'
                }`}
              >
                <Text className={`text-[13px] font-semibold ${recurrence === opcion.valor ? 'text-on-primary' : 'text-on-surface'}`}>
                  {opcion.etiqueta}
                </Text>
              </Pressable>
            ))}
          </View>

          {error ? (
            <Text className="mt-3 text-sm text-error" testID="error-crear">
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <View className="px-4 pt-2" style={{ paddingBottom: margenes.pie }}>
          <PrimaryAction
            testID="btn-guardar"
            disabled={saving}
            onPress={() => void submit()}
            icon={<Send size={17} color={colores['on-primary']} />}
            label={saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear recordatorio'}
          />
        </View>
      </View>
    </Modal>
  );
}
