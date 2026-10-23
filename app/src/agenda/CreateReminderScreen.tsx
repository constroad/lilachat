import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Modal } from '../ui/Modal';
import { Bell, Send, Trash2, X } from 'lucide-react-native';
import { type Recurrence, type RepeatRule, anchorRepeatRule, aQuienSuena, primerEnlace, crearRecordatorio, editarRecordatorio, valorInicial } from '@lilachat/shared';
import { RepeatPicker } from './RepeatPicker';
import { VistaPreviaAlEscribir } from '../chat/VistaPreviaAlEscribir';
import type { Credential } from '../auth/credentialStore';
import { agendaDelete, agendaPatch, agendaPost, publicarRecordatorio, quitarImagenDeRecordatorio, subirImagenDeRecordatorio, type AgendaReminder } from './agendaApi';
import { ImagenDeRecordatorio } from './ImagenDeRecordatorio';
import type { FotoElegida } from '../chat/fotoDeGrupo';
import { FilledField, PrimaryAction, SectionLabel } from './createUi';
import { SelectorDeCuando } from '../ui/SelectorDeCuando';
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

export function CreateReminderScreen({
  visible,
  credential,
  editando,
  grupo,
  onClose,
  onCreated,
}: {
  visible: boolean;
  credential: Credential;
  /** Con un recordatorio, la pantalla lo edita; sin él, crea uno nuevo. */
  editando?: AgendaReminder;
  /**
   * Del GRUPO (José, 19/10): vive en ese grupo, le suena a todos, y lleva
   * descripción e imagen. Lo crean sus admins (el server lo exige).
   */
  grupo?: { id: string; name: string; kind?: 'direct' | 'group' | 'notas' };
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
  // Pending 65: which weekdays, the month's day or last day, every N.
  const [repeat, setRepeat] = useState<RepeatRule | undefined>(editando?.repeat);
  // Once never repeats; an empty rule clears the stored one when editing.
  const repeatToSend = recurrence === 'once' ? {} : (anchorRepeatRule(recurrence, repeat, cuando) ?? {});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [imagen, setImagen] = useState<FotoElegida | null>(null);
  /** Al editar: quitar la imagen que ya tenía. */
  const [quitarImagen, setQuitarImagen] = useState(false);

  const submit = async () => {
    if (saving) return;
    if (!title.trim()) return setError('Escribe de qué es.');
    if (cuando.getTime() < Date.now() && recurrence === 'once') return setError('Esa hora ya pasó. Elige una que venga.');

    setSaving(true);
    const cuerpo = { title: title.trim(), note: note.trim(), startsAt: cuando.toISOString(), recurrence };
    const resultado = editando ? await guardarEdicion(editando._id, cuerpo) : await guardarNuevo(cuerpo);
    setSaving(false);
    if (!resultado.ok) return setError(resultado.motivo);
    onCreated();
    onClose();
  };

  type Cuerpo = { title: string; note: string; startsAt: string; recurrence: Recurrence };

  /** Nuevo: con imagen en un grupo, la tarjeta sale al final (`guardarRecordatorio.ts`). */
  const guardarNuevo = (cuerpo: Cuerpo) =>
    crearRecordatorio(
      { conImagen: Boolean(imagen), delGrupo: Boolean(grupo) },
      {
        crear: async ({ publicar }) => {
          const r = await agendaPost<{ id?: string }>('/reminders', credential.jwt, { ...cuerpo, repeat: repeatToSend, note: cuerpo.note || undefined, chatId: grupo?.id, publicar });
          return r.ok && r.data.id ? { ok: true, id: r.data.id } : { ok: false, motivo: (!r.ok && r.message) || 'No se pudo guardar.' };
        },
        subirImagen: (id) => subirImagenDeRecordatorio(id, credential.jwt, imagen!),
        publicar: (id) => publicarRecordatorio(id, credential.jwt),
      }
    );

  /** Editar: los campos y la imagen —nueva, quitada o igual— (`guardarRecordatorio.ts`). */
  const guardarEdicion = (id: string, cuerpo: Cuerpo) =>
    editarRecordatorio(
      { imagen: imagen ? 'nueva' : quitarImagen && editando?.imageUrl ? 'quitar' : 'igual' },
      {
        guardar: async () => {
          const r = await agendaPatch<{ id?: string }>(`/reminders/${id}`, credential.jwt, { ...cuerpo, repeat: repeatToSend });
          return r.ok ? { ok: true } : { ok: false, motivo: r.message ?? 'No se pudo guardar.' };
        },
        subirImagen: () => subirImagenDeRecordatorio(id, credential.jwt, imagen!),
        quitarImagen: () => quitarImagenDeRecordatorio(id, credential.jwt),
      }
    );

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
            <Text className="mt-1 text-center text-[13px] leading-5 text-on-surface-variant">
              {grupo ? aQuienSuena(grupo.kind ?? 'group', grupo.name) : 'Para que no se te pase nada.'}
            </Text>
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
            <FilledField testID="input-nota" placeholder={grupo ? 'Descripción (opcional)' : 'Nota (opcional)'} value={note} onChangeText={setNote} />
          </View>
          {primerEnlace(note) ? (
            // The link's preview, like the chat's (pending 65a, design `r150-repetir`).
            <View testID="vista-previa-formulario" className="mt-2 overflow-hidden rounded-xl border border-outline/15">
              <VistaPreviaAlEscribir texto={note} jwt={credential.jwt} />
            </View>
          ) : null}
          {grupo ? (
            <View className="mt-2">
              <ImagenDeRecordatorio
                foto={imagen}
                onCambiar={setImagen}
                actual={quitarImagen ? undefined : editando?.imageUrl}
                onQuitarActual={() => setQuitarImagen(true)}
              />
            </View>
          ) : null}

          <SectionLabel>Cuándo</SectionLabel>
          <SelectorDeCuando
            valor={cuando}
            onCambiar={(fecha) => {
              setCuando(fecha);
              setError('');
            }}
          />

          <SectionLabel>Repetir</SectionLabel>
          <RepeatPicker
            recurrence={recurrence}
            rule={repeat}
            startsAt={cuando}
            onChange={(next, rule) => {
              setRecurrence(next);
              setRepeat(rule);
            }}
          />

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
