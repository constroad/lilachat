import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { CirclePlus, Send, X } from 'lucide-react-native';
import { validatePoll } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import type { ChatSummary } from '../api/client';
import { agendaPost } from './agendaApi';
import { FilledField, PrimaryAction, SectionLabel, ToggleRow } from './createUi';

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
  chats,
  fixedChat,
  onClose,
  onCreated,
}: {
  visible: boolean;
  credential: Credential;
  chats: ChatSummary[];
  /**
   * Abierta desde una conversación: ese es el destino y no se pregunta.
   * Una encuesta se pregunta A ALGUIEN, y quien la abre desde el chat ya
   * decidió a quién.
   */
  fixedChat?: { id: string; name: string };
  onClose: () => void;
  onCreated: () => void;
}) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [chatId, setChatId] = useState(fixedChat?.id ?? chats[0]?.id ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving) return;
    const invalid = validatePoll({ question, options });
    if (invalid) return setError(invalid);
    if (!chatId) return setError('Elige en qué conversación.');

    setSaving(true);
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
        <View className="flex-row items-center gap-2 px-4 pb-2 pt-14">
          <Pressable
            onPress={onClose}
            testID="btn-cerrar-crear"
            className="h-11 w-9 items-center justify-center"
          >
            <X size={22} color="#0b1c30" />
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
            <CirclePlus size={18} color="#6b38d4" />
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
                  onPress={() => {
                    setChatId(chat.id);
                    setError('');
                  }}
                  className={`mb-2 min-h-[52px] justify-center rounded-xl px-4 ${
                    chatId === chat.id ? 'bg-primary/[0.14]' : 'bg-primary/[0.07]'
                  }`}
                >
                  <Text
                    className={`text-[15px] ${
                      chatId === chat.id ? 'font-semibold text-primary' : 'text-on-surface'
                    }`}
                  >
                    {chat.name ?? 'Conversación'}
                  </Text>
                </Pressable>
              ))
            )}
  
  
            </>
          )}

          {error ? (
            <Text className="mt-3 text-sm text-error" testID="error-crear">
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <View className="px-4 pb-8 pt-2">
          <PrimaryAction
            testID="btn-guardar"
            disabled={saving}
            onPress={() => void submit()}
            icon={<Send size={17} color="#ffffff" />}
            label={saving ? 'Creando…' : 'Crear encuesta'}
          />
        </View>
      </View>
    </Modal>
  );
}
