import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { CirclePlus, Send, X } from 'lucide-react-native';
import { planTargetChat, validatePoll, type Contact } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { ContactPicker } from '../contacts/ContactPicker';
import { createChat } from '../contacts/contactsApi';
import { agendaPost } from './agendaApi';
import { FilledField, PrimaryAction, SectionLabel, ToggleRow } from './createUi';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';

/**
 * Crear encuesta (diseño «New Poll»).
 *
 * **Sin héroe y con el título a la IZQUIERDA**, al revés que el evento. No es
 * un descuido del mockup: una encuesta es un trámite de diez segundos y el
 * diseño la abre directo, mientras que el evento se presenta. Tenerlas las dos
 * en una sola hoja genérica —como estaban— no daba ninguna de las dos.
 */
export function CreatePollScreen({
  visible,
  credential,
  fixedChat,
  onClose,
  onCreated,
}: {
  visible: boolean;
  credential: Credential;
  /**
   * Abierta desde una conversación: ese es el destino y no se pregunta.
   * Una encuesta se pregunta A ALGUIEN, y quien la abre desde el chat ya
   * decidió a quién.
   */
  fixedChat?: { id: string; name: string };
  onClose: () => void;
  onCreated: () => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  // A quién se le pregunta. Son CONTACTOS y no conversaciones: pedir «elegí una
  // conversación» para preguntar algo obliga a pensar en la estructura de datos
  // en vez de en la gente. La conversación la arma `planTargetChat`.
  const [invitados, setInvitados] = useState<Contact[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving) return;
    const invalid = validatePoll({ question, options });
    if (invalid) return setError(invalid);

    const plan = planTargetChat({
      fixedChatId: fixedChat?.id,
      inviteeIds: invitados.map((contact) => contact.id),
      groupName: question,
    });
    if (plan.kind === 'invalid') return setError(plan.message);

    setSaving(true);

    let chatId = plan.kind === 'existing' ? plan.chatId : '';
    if (plan.kind === 'create') {
      const chat = await createChat(credential.jwt, plan.chat);
      if (!chat.ok) {
        setSaving(false);
        return setError(chat.message ?? 'No se pudo crear la conversación.');
      }
      chatId = chat.data.chatId;
    }

    const result = await agendaPost('/polls', credential.jwt, {
      chatId,
      question: question.trim(),
      options: options.map((option) => option.trim()).filter(Boolean),
      allowMultiple,
      anonymous,
    });
    setSaving(false);

    if (!result.ok) return setError(result.message ?? 'No se pudo guardar.');
    setQuestion('');
    setOptions(['', '']);
    setInvitados([]);
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
  const hayAlgoEscrito = Boolean(question.trim() || options.some((option) => option.trim()));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        if (!hayAlgoEscrito) onClose();
      }}
    >
      <View className="flex-1 bg-background" testID="crear-poll">
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
          <Text className="text-2xl font-bold text-on-surface">Nueva encuesta</Text>
          <Text className="mt-1 text-[13px] leading-5 text-on-surface-variant">
            Haz una pregunta y deja que el chat decida.
          </Text>

          <SectionLabel>Pregunta</SectionLabel>
          <FilledField
            testID="input-titulo"
            placeholder="¿Qué hacemos el fin de semana?"
            value={question}
            onChangeText={(text) => {
              setQuestion(text);
              setError('');
            }}
          />

          <SectionLabel>Opciones</SectionLabel>
          {options.map((option, index) => (
            <View key={index} className="mb-2">
              <FilledField
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
            <CirclePlus size={18} color={colores.primary} />
            <Text className="text-[15px] font-semibold text-primary">Agregar otra opción</Text>
          </Pressable>

          <SectionLabel>Ajustes</SectionLabel>
          <ToggleRow
            testID="switch-multiple"
            label="Permitir varias respuestas"
            hint="Cada persona puede elegir más de una"
            value={allowMultiple}
            onChange={setAllowMultiple}
          />
          <ToggleRow
            testID="switch-anonimo"
            label="Resultados anónimos"
            hint="No se muestra quién votó cada opción"
            value={anonymous}
            onChange={setAnonymous}
          />

          {fixedChat ? null : (
            <>
              <View className="mt-6 flex-row items-center justify-between">
                <Text className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  A quién le preguntas
                </Text>
                <View className="rounded-full bg-primary/10 px-2 py-0.5">
                  <Text className="text-[11px] font-semibold text-primary">
                    {invitados.length > 0 ? `${invitados.length} elegidos` : 'Sin elegir'}
                  </Text>
                </View>
              </View>
              <View className="h-72">
                <ContactPicker
                  credential={credential}
                  selected={invitados.map((contact) => contact.id)}
                  multiple
                  onToggle={(contact) => {
                    setError('');
                    setInvitados((actuales) =>
                      actuales.some((item) => item.id === contact.id)
                        ? actuales.filter((item) => item.id !== contact.id)
                        : [...actuales, contact]
                    );
                  }}
                />
              </View>
            </>
          )}

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
            label={saving ? 'Creando…' : 'Crear encuesta'}
          />
        </View>
      </View>
    </Modal>
  );
}
