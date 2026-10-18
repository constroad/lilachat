import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Bell, Clock, MapPin, Send, Sparkles, Trash2, UserPlus, X } from 'lucide-react-native';
import type { Credential } from '../auth/credentialStore';
import { planTargetChat, type Contact } from '@lilachat/shared';
import { agendaDelete, agendaPatch, agendaPost, type AgendaEvent } from './agendaApi';
import { ContactPicker } from '../contacts/ContactPicker';
import { createChat } from '../contacts/contactsApi';
import { FilledField, PickerRow, PrimaryAction, SectionLabel, ToggleRow } from './createUi';
import { terminaPorDefecto } from './eventos';
import { SelectorDeCuando } from '../ui/SelectorDeCuando';
import { valorInicial } from '../ui/cuando';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';
import { Avatar } from '../ui/Avatar';

/** El avatar del chat donde se crea el evento (dp). */
const AVATAR_DEL_CHAT = 36;

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
 * Con varios contactos, si ya hay un grupo con EXACTAMENTE esa gente, el evento
 * va ahí y no a un grupo nuevo (FL10). La hora de fin es opcional («Ends at»).
 *
 * Desde el 17/10/2026, con `editando` la misma pantalla edita (solo quien lo
 * creó; el server lo exige igual) y ofrece cancelarlo. Los invitados no se
 * editan acá: son los miembros de la conversación donde vive el evento. El
 * cuándo es día y hora exactos (`SelectorDeCuando`), no cinco atajos.
 */

export function CreateEventScreen({
  visible,
  credential,
  fixedChat,
  editando,
  grupos,
  onClose,
  onCreated,
}: {
  visible: boolean;
  credential: Credential;
  /** Abierto desde una conversación: ese es el destino y no se pregunta. */
  fixedChat?: { id: string; name: string };
  /** Con un evento propio, la pantalla lo edita; sin él, crea uno nuevo. */
  editando?: AgendaEvent;
  /** Mis grupos: con la misma gente, el evento va al que ya existe (FL10). */
  grupos?: readonly { id: string; memberIds: readonly string[] }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const [title, setTitle] = useState(editando?.title ?? '');
  const [description, setDescription] = useState(editando?.description ?? '');
  const [location, setLocation] = useState(editando?.location ?? '');
  const [cuando, setCuando] = useState(() => valorInicial(editando?.startsAt, new Date()));
  const [termina, setTermina] = useState<Date | null>(() => (editando?.endsAt ? new Date(editando.endsAt) : null));
  const [editandoDonde, setEditandoDonde] = useState(false);
  const [invitados, setInvitados] = useState<Contact[]>([]);
  const [remind, setRemind] = useState(editando?.remindGuests ?? true);
  const [openInvite, setOpenInvite] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const guardarCambios = async () => {
    if (!editando) return;
    setSaving(true);
    const result = await agendaPatch(`/events/${editando.id}`, credential.jwt, {
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      startsAt: cuando.toISOString(),
      // Sin fin se manda vacío: el server lo borra si lo había.
      endsAt: termina ? termina.toISOString() : '',
      remindGuests: remind,
    });
    setSaving(false);
    if (!result.ok) return setError(result.message ?? 'No se pudo guardar.');
    onCreated();
    onClose();
  };

  const cancelarEvento = () => {
    if (!editando) return;
    Alert.alert('Cancelar evento', `«${editando.title}» desaparece de la agenda de todos los invitados.`, [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Cancelar evento',
        style: 'destructive',
        onPress: () =>
          void agendaDelete(`/events/${editando.id}`, credential.jwt).then((result) => {
            if (!result.ok) return setError(result.message ?? 'No se pudo cancelar.');
            onCreated();
            onClose();
          }),
      },
    ]);
  };

  const submit = async () => {
    if (saving) return;
    if (!title.trim()) return setError('Ponle un nombre al evento.');
    if (cuando.getTime() < Date.now()) return setError('Esa hora ya pasó. Elige una que venga.');
    if (termina && termina <= cuando) return setError('La hora de fin tiene que ser después del inicio.');
    if (editando) return guardarCambios();

    // Los contactos se vuelven la conversación donde vive el evento: con UNO,
    // el chat 1:1 —que el server no duplica—; con varios, un grupo con el
    // nombre del evento, que es lo que la familia va a reconocer después. La
    // regla vive en `shared` porque la web decide EXACTAMENTE igual.
    const plan = planTargetChat({
      fixedChatId: fixedChat?.id,
      inviteeIds: invitados.map((contact) => contact.id),
      groupName: title,
      yo: credential.userId,
      grupos,
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
      startsAt: cuando.toISOString(),
      endsAt: termina?.toISOString(),
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
  const hayAlgoEscrito = editando
    ? title !== editando.title || description !== (editando.description ?? '') || location !== (editando.location ?? '')
    : Boolean(title.trim() || description.trim() || location.trim());

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
            className="h-11 w-11 items-center justify-center"
          >
            <X size={22} color={colores["on-surface"]} />
          </Pressable>
          <View className="flex-1" />
          {editando ? (
            <Pressable
              onPress={cancelarEvento}
              testID="btn-cancelar-evento"
              accessibilityLabel="Cancelar evento"
              className="h-11 w-11 items-center justify-center"
            >
              <Trash2 size={20} color={colores.error} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          {/* HÉROE — lo que más se extrañaba: el diseño abre con el icono en
              círculo, el título en acento y una línea que explica para qué es. */}
          <View className="items-center pb-2">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-primary">
              <Sparkles size={24} color={colores["on-primary"]} />
            </View>
            <Text className="mt-3 text-2xl font-bold text-primary">{editando ? 'Editar evento' : 'Nuevo evento'}</Text>
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
          <SelectorDeCuando
            valor={cuando}
            onCambiar={(fecha) => {
              setCuando(fecha);
              setError('');
            }}
          />
          <View className="h-2" />
          {termina ? (
            <>
              <View className="mb-1 flex-row items-center justify-between">
                <Text className="text-[13px] font-semibold text-on-surface-variant">Termina</Text>
                <Pressable testID="btn-quitar-fin" onPress={() => setTermina(null)} className="min-h-[44px] justify-center px-2">
                  <Text className="text-[13px] font-semibold text-primary">Quitar</Text>
                </Pressable>
              </View>
              <SelectorDeCuando valor={termina} prefijo="termina" conAtajos={false} onCambiar={(fecha) => { setTermina(fecha); setError(''); }} />
              <View className="h-2" />
            </>
          ) : (
            <PickerRow
              testID="fila-fin"
              icon={<Clock size={18} color={colores.primary} />}
              title="Agregar hora de fin"
              hint="Opcional"
              onPress={() => setTermina(terminaPorDefecto(cuando))}
            />
          )}

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

          {editando ? null : fixedChat ? (
            <>
              <SectionLabel>Dónde</SectionLabel>
              <View className="min-h-[52px] flex-row items-center gap-3 rounded-xl bg-primary/[0.07] px-4">
                <Avatar nombre={fixedChat.name} tamano={AVATAR_DEL_CHAT} />
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
          {editando ? null : (
          <ToggleRow
            testID="switch-invitar"
            icon={<UserPlus size={16} color={colores.primary} />}
            label="Pueden invitar a otros"
            hint="Los invitados pueden sumar a sus contactos"
            value={openInvite}
            onChange={setOpenInvite}
          />
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
            label={saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear e invitar'}
          />
        </View>
      </View>
    </Modal>
  );
}
