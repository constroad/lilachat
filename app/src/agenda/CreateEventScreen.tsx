import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Bell, Calendar, MapPin, Send, Sparkles, UserPlus, X } from 'lucide-react-native';
import type { Credential } from '../auth/credentialStore';
import { planTargetChat, type Contact } from '@lilachat/shared';
import { agendaPost } from './agendaApi';
import { ContactPicker } from '../contacts/ContactPicker';
import { createChat } from '../contacts/contactsApi';
import { FilledField, PickerRow, PrimaryAction, SectionLabel, ToggleRow } from './createUi';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';

/**
 * Crear evento (diseño «New Event»).
 *
 * La composición sale de la captura, no de la memoria: **héroe centrado**
 * —icono en círculo de acento, título en acento, subtítulo—, luego DETALLES con
 * los campos rellenos, CUÁNDO Y DÓNDE como filas con icono y chevron, INVITADOS
 * con el contador a la derecha del rótulo y las caras en fila, y OPCIONES con
 * dos interruptores. Al pie, el botón de ancho completo.
 *
 * **Se invita a CONTACTOS, no a conversaciones** (reclamo de José: «¿por qué me
 * pide conversaciones?»). Elegir gente es lo natural y es lo que dibuja el
 * diseño. Que un evento viva en un chat es un detalle del server, no algo que
 * el usuario tenga que resolver: al confirmar, los contactos elegidos se
 * convierten en la conversación —la que ya existe con esa persona, o una nueva
 * de grupo— y ahí se crea el evento.
 *
 * Abierto DESDE un chat (`fixedChat`), no se pregunta nada: ese es el destino.
 */
const OPCIONES_CUANDO = [
  { horas: 1, etiqueta: 'En 1 hora' },
  { horas: 3, etiqueta: 'En 3 horas' },
  { horas: 24, etiqueta: 'Mañana' },
  { horas: 48, etiqueta: 'Pasado mañana' },
  { horas: 24 * 7, etiqueta: 'En una semana' },
];

export function CreateEventScreen({
  visible,
  credential,
  fixedChat,
  onClose,
  onCreated,
}: {
  visible: boolean;
  credential: Credential;
  /** Abierto desde una conversación: ese es el destino y no se pregunta. */
  fixedChat?: { id: string; name: string };
  onClose: () => void;
  onCreated: () => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [hours, setHours] = useState(24);
  const [editandoCuando, setEditandoCuando] = useState(false);
  const [editandoDonde, setEditandoDonde] = useState(false);
  const [invitados, setInvitados] = useState<Contact[]>([]);
  const [remind, setRemind] = useState(true);
  const [openInvite, setOpenInvite] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const cuando = OPCIONES_CUANDO.find((opcion) => opcion.horas === hours);

  const submit = async () => {
    if (saving) return;
    if (!title.trim()) return setError('Ponle un nombre al evento.');

    // Los contactos se vuelven la conversación donde vive el evento: con UNO,
    // el chat 1:1 —que el server no duplica—; con varios, un grupo con el
    // nombre del evento, que es lo que la familia va a reconocer después. La
    // regla vive en `shared` porque la web decide EXACTAMENTE igual.
    const plan = planTargetChat({
      fixedChatId: fixedChat?.id,
      inviteeIds: invitados.map((contact) => contact.id),
      groupName: title,
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

    const result = await agendaPost('/events', credential.jwt, {
      chatId,
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      startsAt: new Date(Date.now() + hours * 3_600_000).toISOString(),
      remindGuests: remind,
      guestsCanInvite: openInvite,
    });
    setSaving(false);

    if (!result.ok) return setError(result.message ?? 'No se pudo guardar.');
    setTitle('');
    setDescription('');
    setLocation('');
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
  const hayAlgoEscrito = Boolean(title.trim() || description.trim() || location.trim());

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        if (!hayAlgoEscrito) onClose();
      }}
    >
      <View className="flex-1 bg-background" testID="crear-event">
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
          {/* HÉROE — lo que más se extrañaba: el diseño abre con el icono en
              círculo, el título en acento y una línea que explica para qué es. */}
          <View className="items-center pb-2">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-primary">
              <Sparkles size={24} color={colores["on-primary"]} />
            </View>
            <Text className="mt-3 text-2xl font-bold text-primary">Nuevo evento</Text>
            <Text className="mt-1 text-center text-[13px] leading-5 text-on-surface-variant">
              Organiza la próxima reunión, pon los detalles e invita a los tuyos.
            </Text>
          </View>

          <SectionLabel>Detalles del evento</SectionLabel>
          <FilledField
            testID="input-titulo"
            placeholder="Nombre del evento"
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              setError('');
            }}
          />
          <View className="mt-2">
            <FilledField
              testID="input-descripcion"
              placeholder="¿De qué se trata?"
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>

          <SectionLabel>Cuándo y dónde</SectionLabel>
          <PickerRow
            testID="fila-cuando"
            icon={<Calendar size={18} color={colores.primary} />}
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

          <PickerRow
            testID="fila-donde"
            icon={<MapPin size={18} color={colores.primary} />}
            title={location.trim() || 'Agregar ubicación'}
            hint="O un enlace de videollamada"
            onPress={() => setEditandoDonde((abierto) => !abierto)}
          />
          {editandoDonde ? (
            <View className="mb-2">
              <FilledField
                testID="input-lugar"
                placeholder="Casa de mamá, o un enlace"
                value={location}
                onChangeText={setLocation}
                autoFocus
              />
            </View>
          ) : null}

          {fixedChat ? (
            <>
              <SectionLabel>Dónde</SectionLabel>
              <View className="min-h-[52px] flex-row items-center gap-3 rounded-xl bg-primary/[0.07] px-4">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-primary">
                  <Text className="text-sm font-bold text-on-primary">
                    {fixedChat.name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <Text className="min-w-0 flex-1 text-[15px] text-on-surface" numberOfLines={1}>
                  {fixedChat.name}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View className="mt-6 flex-row items-center justify-between">
                <Text className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  Invitados
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

          <SectionLabel>Opciones</SectionLabel>
          <ToggleRow
            testID="switch-recordar"
            icon={<Bell size={16} color={colores.primary} />}
            label="Avisar 1 hora antes"
            hint="Les llega un recordatorio a todos"
            value={remind}
            onChange={setRemind}
          />
          <ToggleRow
            testID="switch-invitar"
            icon={<UserPlus size={16} color={colores.primary} />}
            label="Pueden invitar a otros"
            hint="Cualquiera del chat puede sumar gente"
            value={openInvite}
            onChange={setOpenInvite}
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
            icon={<Send size={17} color={colores["on-primary"]} />}
            label={saving ? 'Creando…' : 'Crear e invitar'}
          />
        </View>
      </View>
    </Modal>
  );
}
