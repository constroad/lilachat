import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Bell, Clock, Send, X } from 'lucide-react-native';
import type { Recurrence } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { agendaPost } from './agendaApi';
import { FilledField, PickerRow, PrimaryAction, SectionLabel } from './createUi';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';

/**
 * Crear recordatorio.
 *
 * **Stitch no diseñó esta pantalla** —solo la lista, «My Reminders»—. Se
 * construye con el lenguaje de las otras dos (rótulos en acento, campos
 * rellenos, botón de ancho completo) y con el héroe del evento, para que no
 * parezca de otra app. Se anota acá para que quede claro qué salió de una
 * captura y qué de una decisión.
 *
 * El campo «nota» existe porque la LISTA lo muestra: sin él, la segunda línea
 * de la tarjeta del diseño quedaría siempre vacía.
 */
const OPCIONES_CUANDO = [
  { horas: 1, etiqueta: 'En 1 hora' },
  { horas: 3, etiqueta: 'En 3 horas' },
  { horas: 9, etiqueta: 'Esta noche' },
  { horas: 24, etiqueta: 'Mañana' },
];

const RECURRENCIAS: { valor: Recurrence; etiqueta: string }[] = [
  { valor: 'once', etiqueta: 'Una vez' },
  { valor: 'daily', etiqueta: 'Diario' },
  { valor: 'weekly', etiqueta: 'Semanal' },
];

export function CreateReminderScreen({
  visible,
  credential,
  onClose,
  onCreated,
}: {
  visible: boolean;
  credential: Credential;
  onClose: () => void;
  onCreated: () => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [hours, setHours] = useState(3);
  const [recurrence, setRecurrence] = useState<Recurrence>('once');
  const [editandoCuando, setEditandoCuando] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const cuando = OPCIONES_CUANDO.find((opcion) => opcion.horas === hours);

  const submit = async () => {
    if (saving) return;
    if (!title.trim()) return setError('Escribe de qué es.');

    setSaving(true);
    const result = await agendaPost('/reminders', credential.jwt, {
      title: title.trim(),
      note: note.trim() || undefined,
      startsAt: new Date(Date.now() + hours * 3_600_000).toISOString(),
      recurrence,
    });
    setSaving(false);

    if (!result.ok) return setError(result.message ?? 'No se pudo guardar.');
    setTitle('');
    setNote('');
    setError('');
    onCreated();
    onClose();
  };

  /**
   * ATRÁS de Android.
   *
   * `onRequestClose` NO es solo el botón de atrás: también se dispara cuando se
   * cierra el TECLADO con atrás. Cerrando sin condición, escribir un campo,
   * bajar el teclado y perder todo lo llenado es un solo gesto — pasó en el
   * E2E, con la encuesta a medio llenar.
   *
   * Solo se cierra si no hay nada escrito. Con algo escrito, atrás no hace nada
   * y queda la X, que es explícita.
   */
  const hayAlgoEscrito = Boolean(title.trim() || note.trim());

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        if (!hayAlgoEscrito) onClose();
      }}
    >
      <View className="flex-1 bg-background" testID="crear-reminder">
        <View className="flex-row items-center gap-2 px-4 pb-2" style={{ paddingTop: margenes.cabecera }}>
          <Pressable
            onPress={onClose}
            testID="btn-cerrar-crear"
            className="h-11 w-9 items-center justify-center"
          >
            <X size={22} color={colores["on-surface"]} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          <View className="items-center pb-2">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-primary">
              <Bell size={24} color={colores["on-primary"]} />
            </View>
            <Text className="mt-3 text-2xl font-bold text-primary">Nuevo recordatorio</Text>
            <Text className="mt-1 text-center text-[13px] leading-5 text-on-surface-variant">
              Para que no se te pase nada.
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
            <FilledField
              testID="input-nota"
              placeholder="Cada 2 horas"
              value={note}
              onChangeText={setNote}
            />
          </View>

          <SectionLabel>Cuándo</SectionLabel>
          <PickerRow
            testID="fila-cuando"
            icon={<Clock size={18} color={colores.primary} />}
            title={cuando?.etiqueta ?? `En ${hours} horas`}
            hint="Toca para cambiar"
            onPress={() => setEditandoCuando((abierto) => !abierto)}
          />
          {editandoCuando ? (
            <View className="mb-2 flex-row flex-wrap gap-2">
              {OPCIONES_CUANDO.map((opcion) => (
                <Pressable
                  key={opcion.horas}
                  testID={`cuando-${opcion.horas}`}
                  onPress={() => {
                    setHours(opcion.horas);
                    setEditandoCuando(false);
                  }}
                  className={`min-h-[40px] items-center justify-center rounded-lg px-3 ${
                    hours === opcion.horas ? 'bg-primary' : 'bg-primary/[0.07]'
                  }`}
                >
                  <Text
                    className={`text-[13px] font-semibold ${
                      hours === opcion.horas ? 'text-on-primary' : 'text-on-surface'
                    }`}
                  >
                    {opcion.etiqueta}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

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
                <Text
                  className={`text-[13px] font-semibold ${
                    recurrence === opcion.valor ? 'text-on-primary' : 'text-on-surface'
                  }`}
                >
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
            icon={<Send size={17} color={colores["on-primary"]} />}
            label={saving ? 'Creando…' : 'Crear recordatorio'}
          />
        </View>
      </View>
    </Modal>
  );
}
