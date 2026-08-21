import { useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { validatePoll, type Recurrence } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { agendaPost } from './agendaApi';
import type { ChatSummary } from '../api/client';

/**
 * Crear evento, recordatorio o encuesta (diseños «New Event», «New Poll»).
 *
 * Los tres comparten hoja porque comparten estructura —secciones con etiqueta
 * en mayúsculas, campos, opciones con switch, y un botón de ancho completo al
 * pie— que es exactamente como los dibujó el diseño.
 */
type Kind = 'event' | 'reminder' | 'poll';

const SectionLabel = ({ children }: { children: string }) => (
  <Text className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
    {children}
  </Text>
);

const Field = (props: React.ComponentProps<typeof TextInput>) => (
  <TextInput
    {...props}
    placeholderTextColor="#7b7486"
    className="min-h-[48px] rounded-lg border border-outline/15 bg-background px-4 py-2.5 text-base text-on-surface"
  />
);

export function CreateSheet({
  kind,
  visible,
  credential,
  chats,
  onClose,
  onCreated,
}: {
  kind: Kind;
  visible: boolean;
  credential: Credential;
  chats: ChatSummary[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [hours, setHours] = useState('2');
  const [recurrence, setRecurrence] = useState<Recurrence>('once');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [chatId, setChatId] = useState(chats[0]?.id ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setHours('2');
    setOptions(['', '']);
    setError('');
  };

  const submit = async () => {
    if (saving) return;
    setError('');

    // «Dentro de N horas» en vez de un selector de fecha: es lo que se usa de
    // verdad en un chat familiar («nos vemos en 2 horas»), y un date-picker
    // nativo completo es una pieza propia que no entra en esta fase.
    const startsAt = new Date(Date.now() + (Number(hours) || 0) * 3_600_000).toISOString();

    if (kind === 'poll') {
      const invalid = validatePoll({ question: title, options });
      if (invalid) return setError(invalid);
    } else if (!title.trim()) {
      return setError(kind === 'event' ? 'Ponle un nombre al evento.' : 'Escribe de qué es.');
    }
    if (kind !== 'reminder' && !chatId) return setError('Elige en qué conversación.');

    setSaving(true);
    const result =
      kind === 'event'
        ? await agendaPost('/events', credential.jwt, {
            chatId,
            title: title.trim(),
            description: description.trim() || undefined,
            location: location.trim() || undefined,
            startsAt,
          })
        : kind === 'reminder'
          ? await agendaPost('/reminders', credential.jwt, {
              title: title.trim(),
              startsAt,
              recurrence,
            })
          : await agendaPost('/polls', credential.jwt, {
              chatId,
              question: title.trim(),
              options: options.map((option) => option.trim()).filter(Boolean),
              allowMultiple,
              anonymous,
            });
    setSaving(false);

    if (!result.ok) return setError(result.message ?? 'No se pudo guardar.');
    reset();
    onCreated();
    onClose();
  };

  const heading =
    kind === 'event' ? 'Nuevo evento' : kind === 'reminder' ? 'Nuevo recordatorio' : 'Nueva encuesta';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-background" testID={`crear-${kind}`}>
        <View className="flex-row items-center gap-2 border-b border-outline/10 bg-surface px-4 pb-3 pt-14">
          <Pressable onPress={onClose} testID="btn-cerrar-crear" className="h-11 w-9 items-center justify-center">
            <X size={22} color="#0b1c30" />
          </Pressable>
          <Text className="flex-1 text-lg font-bold text-on-surface">{heading}</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <SectionLabel>{kind === 'poll' ? 'Pregunta' : 'Detalles'}</SectionLabel>
          <Field
            testID="input-titulo"
            placeholder={
              kind === 'poll'
                ? '¿Qué hacemos el fin de semana?'
                : kind === 'event'
                  ? 'Nombre del evento'
                  : 'Tomar agua'
            }
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              setError('');
            }}
          />

          {kind === 'event' ? (
            <>
              <View className="mt-2">
                <Field
                  testID="input-descripcion"
                  placeholder="¿De qué se trata?"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                />
              </View>
              <SectionLabel>Cuándo y dónde</SectionLabel>
              <View className="flex-row items-center gap-2">
                <Field
                  testID="input-horas"
                  placeholder="2"
                  keyboardType="number-pad"
                  value={hours}
                  onChangeText={setHours}
                />
                <Text className="text-sm text-on-surface-variant">horas desde ahora</Text>
              </View>
              <View className="mt-2">
                <Field
                  testID="input-lugar"
                  placeholder="Agregar ubicación"
                  value={location}
                  onChangeText={setLocation}
                />
              </View>
            </>
          ) : null}

          {kind === 'reminder' ? (
            <>
              <SectionLabel>Cuándo</SectionLabel>
              <View className="flex-row items-center gap-2">
                <Field
                  testID="input-horas"
                  placeholder="2"
                  keyboardType="number-pad"
                  value={hours}
                  onChangeText={setHours}
                />
                <Text className="text-sm text-on-surface-variant">horas desde ahora</Text>
              </View>
              <SectionLabel>Repetir</SectionLabel>
              <View className="flex-row gap-2">
                {(['once', 'daily', 'weekly'] as Recurrence[]).map((value) => (
                  <Pressable
                    key={value}
                    testID={`recurrencia-${value}`}
                    onPress={() => setRecurrence(value)}
                    className={`min-h-[40px] flex-1 items-center justify-center rounded-lg ${
                      recurrence === value ? 'bg-primary' : 'bg-surface-variant'
                    }`}
                  >
                    <Text
                      className={`text-[13px] font-semibold ${
                        recurrence === value ? 'text-on-primary' : 'text-on-surface-variant'
                      }`}
                    >
                      {value === 'once' ? 'Una vez' : value === 'daily' ? 'Diario' : 'Semanal'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {kind === 'poll' ? (
            <>
              <SectionLabel>Opciones</SectionLabel>
              {options.map((option, index) => (
                <View key={index} className="mb-2">
                  <Field
                    testID={`input-opcion-${index}`}
                    placeholder={`Opción ${index + 1}`}
                    value={option}
                    onChangeText={(text) => {
                      setOptions((current) =>
                        current.map((item, position) => (position === index ? text : item))
                      );
                      setError('');
                    }}
                  />
                </View>
              ))}
              <Pressable
                testID="btn-agregar-opcion"
                onPress={() => setOptions((current) => [...current, ''])}
                className="min-h-[44px] flex-row items-center gap-2"
              >
                <Plus size={16} color="#6b38d4" />
                <Text className="text-sm font-semibold text-primary">Agregar otra opción</Text>
              </Pressable>

              <SectionLabel>Ajustes</SectionLabel>
              <Option
                label="Permitir varias respuestas"
                hint="Cada persona puede elegir más de una"
                value={allowMultiple}
                onChange={setAllowMultiple}
                testID="switch-multiple"
              />
              <Option
                label="Resultados anónimos"
                hint="No se muestra quién votó cada opción"
                value={anonymous}
                onChange={setAnonymous}
                testID="switch-anonimo"
              />
            </>
          ) : null}

          {kind !== 'reminder' ? (
            <>
              <SectionLabel>En qué conversación</SectionLabel>
              {chats.length === 0 ? (
                <Text className="text-sm text-on-surface-variant">
                  Necesitas una conversación primero.
                </Text>
              ) : (
                chats.map((chat) => (
                  <Pressable
                    key={chat.id}
                    testID={`elegir-chat-${chat.id}`}
                    onPress={() => setChatId(chat.id)}
                    className={`mb-2 min-h-[48px] justify-center rounded-lg border px-4 ${
                      chatId === chat.id ? 'border-primary bg-primary/5' : 'border-outline/15'
                    }`}
                  >
                    <Text className="text-sm text-on-surface">{chat.name ?? 'Conversación'}</Text>
                  </Pressable>
                ))
              )}
            </>
          ) : null}

          {error ? (
            <Text className="mt-3 text-sm text-error" testID="error-crear">
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <View className="border-t border-outline/10 bg-surface px-4 pb-8 pt-3">
          <Pressable
            testID="btn-guardar"
            disabled={saving}
            onPress={() => void submit()}
            className={`min-h-[52px] items-center justify-center rounded-lg ${
              saving ? 'bg-primary/40' : 'bg-primary'
            }`}
          >
            <Text className="text-base font-bold text-on-primary">
              {kind === 'event' ? 'Crear e invitar' : kind === 'poll' ? 'Crear encuesta' : 'Crear'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Option({
  label,
  hint,
  value,
  onChange,
  testID,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
  testID: string;
}) {
  return (
    <View className="mb-2 flex-row items-center gap-3 rounded-lg bg-surface-variant/50 px-4 py-3">
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-on-surface">{label}</Text>
        <Text className="text-[11px] text-on-surface-variant">{hint}</Text>
      </View>
      <Switch testID={testID} value={value} onValueChange={onChange} trackColor={{ true: '#6b38d4' }} />
    </View>
  );
}
