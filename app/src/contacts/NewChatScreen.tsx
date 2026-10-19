import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Interruptor } from '../ui/Interruptor';
import { ArrowLeft, Check, Lock, NotebookPen, Users, X } from 'lucide-react-native';
import { MAX_NOMBRE_DE_GRUPO, type Contact } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { ContactPicker } from './ContactPicker';
import { createChat } from './contactsApi';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';
import { Avatar } from '../ui/Avatar';
import { FilaDeAjuste, GrupoDeAjustes } from '../ui/FilaDeAjuste';

/** El avatar de cada elegido arriba de la lista (dp): 56, como el diseño. */
const AVATAR_ELEGIDO = 56;

/**
 * Nuevo chat (el lápiz de la lista, que no hacía nada — reclamo de José).
 *
 * Dos pasos, siguiendo los diseños «New Group: Seleccionar Contactos» y «New
 * Group: Información»:
 *
 *  1. **Contactos.** Tocar a una persona abre el 1:1 directo — sin pasos
 *     intermedios, que es lo que uno espera al tocar un nombre. Arriba, una
 *     fila «Nuevo grupo» cambia a selección múltiple.
 *  2. **Información del grupo** (solo en modo grupo): nombre con contador, y
 *     los elegidos en fila con su × para sacarlos, como en la captura.
 */
export function NewChatScreen({
  visible,
  credential,
  onClose,
  onOpenChat,
}: {
  visible: boolean;
  credential: Credential;
  onClose: () => void;
  /**
   * Se devuelve el NOMBRE además del id: el chat recién creado todavía no está
   * en la lista cargada, y sin el nombre la conversación abría con el título
   * genérico «Conversación» — recién al recargar aparecía el real.
   */
  onOpenChat: (chat: {
    id: string;
    name?: string;
    kind: 'direct' | 'group' | 'notas';
    /** Sin esto la conversación abre SIN candado hasta la primera recarga. */
    encrypted?: boolean;
    /** Yo incluido. Sin esto un 1:1 recién creado se trataba como grupo (FL8). */
    memberIds: string[];
  }) => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  /** `borrador` (19/10): un chat solo contigo, con nombre. */
  const [modo, setModo] = useState<'directo' | 'grupo' | 'borrador'>('directo');
  const [paso, setPaso] = useState<'contactos' | 'info'>('contactos');
  const [elegidos, setElegidos] = useState<Contact[]>([]);
  const [nombre, setNombre] = useState('');
  const [secreto, setSecreto] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const volverAContactos = () => {
    setPaso('contactos');
    if (modo === 'borrador') setModo('directo');
    setError('');
  };

  const cerrar = () => {
    setModo('directo');
    setPaso('contactos');
    setElegidos([]);
    setNombre('');
    setSecreto(false);
    setError('');
    onClose();
  };

  const abrirDirecto = async (contact: Contact) => {
    // Un doble toque creaba DOS chats (dos secretos, con el interruptor).
    if (guardando) return;
    // Si ya hay conversación se ABRE, no se crea otra. El server también lo
    // impide, pero preguntar de más es un viaje que no hace falta.
    // Con el interruptor puesto NO se reusa el chat existente: uno normal no se
    // convierte en secreto —sus mensajes viejos ya están en claro en el
    // servidor— así que el chat cifrado es OTRA conversación.
    if (contact.directChatId && !secreto) {
      onOpenChat({ id: contact.directChatId, name: contact.name ?? contact.phone, kind: 'direct', memberIds: [credential.userId, contact.id] });
      return cerrar();
    }
    setGuardando(true);
    const result = await createChat(credential.jwt, {
      kind: 'direct',
      memberIds: [contact.id],
      encrypted: secreto,
    });
    setGuardando(false);
    if (!result.ok) return setError(result.message ?? 'No se pudo abrir la conversación.');
    onOpenChat({
      id: result.data.chatId,
      name: contact.name ?? contact.phone,
      kind: 'direct',
      encrypted: secreto,
      // Los miembros VAN: sin ellos la conversación no sabía quién es el otro
      // (sin botón de llamar, tratada como grupo y, si era secreta, sin clave).
      memberIds: [credential.userId, contact.id],
    });
    cerrar();
  };

  const crearGrupo = async () => {
    if (guardando) return;
    if (!nombre.trim()) return setError('Ponle un nombre al grupo.');
    if (elegidos.length === 0) return setError('Elige al menos a una persona.');

    setGuardando(true);
    const result = await createChat(credential.jwt, {
      kind: 'group',
      name: nombre.trim(),
      memberIds: elegidos.map((contact) => contact.id),
    });
    setGuardando(false);
    if (!result.ok) return setError(result.message ?? 'No se pudo crear el grupo.');
    onOpenChat({ id: result.data.chatId, name: nombre.trim(), kind: 'group', memberIds: [credential.userId, ...elegidos.map((contact) => contact.id)] });
    cerrar();
  };

  /** Un chat solo contigo, con nombre (José, 19/10): notas, fotos, links. */
  const crearBorrador = async () => {
    if (guardando) return;
    if (!nombre.trim()) return setError('Ponle un nombre al borrador.');
    setGuardando(true);
    const result = await createChat(credential.jwt, { kind: 'notas', name: nombre.trim(), memberIds: [] });
    setGuardando(false);
    if (!result.ok) return setError(result.message ?? 'No se pudo crear el borrador.');
    onOpenChat({ id: result.data.chatId, name: nombre.trim(), kind: 'notas', memberIds: [credential.userId] });
    cerrar();
  };

  const alternar = (contact: Contact) => {
    setError('');
    if (modo === 'directo') return void abrirDirecto(contact);
    setElegidos((actuales) =>
      actuales.some((item) => item.id === contact.id)
        ? actuales.filter((item) => item.id !== contact.id)
        : [...actuales, contact]
    );
  };

  /**
   * ATRÁS de Android — el mismo guard que las pantallas de crear.
   *
   * `onRequestClose` también se dispara al bajar el TECLADO con atrás, así que
   * cerrando sin condición se pierde el grupo a medio armar de un solo gesto.
   * Pasó en el E2E: escribir el nombre, bajar el teclado y volver a la lista de
   * chats con el grupo sin crear.
   *
   * Atrás retrocede de paso; solo cierra desde el primer paso y sin nada
   * elegido.
   */
  const atras = () => {
    if (paso === 'info' && modo === 'borrador') return volverAContactos();
    if (paso === 'info') return setPaso('contactos');
    if (elegidos.length > 0) return;
    cerrar();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={atras}>
      <View className="flex-1 bg-background" testID="pantalla-nuevo-chat">
        <View className="flex-row items-center gap-2 px-4 pb-3" style={{ paddingTop: margenes.cabecera }}>
          <Pressable
            testID="btn-cerrar-nuevo-chat"
            onPress={() => (paso === 'info' ? volverAContactos() : cerrar())}
            className="h-11 w-11 items-center justify-center"
          >
            <ArrowLeft size={22} color={colores["on-surface"]} />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text className="text-lg font-bold text-on-surface">
              {modo === 'borrador' ? 'Nuevo borrador' : paso === 'info' ? 'Información del grupo' : modo === 'grupo' ? 'Nuevo grupo' : 'Nuevo chat'}
            </Text>
            <Text className="text-[12px] text-on-surface-variant">
              {modo === 'borrador'
                ? 'Un chat solo contigo'
                : paso === 'info'
                ? `${elegidos.length} ${elegidos.length === 1 ? 'participante' : 'participantes'}`
                : modo === 'grupo'
                  ? 'Elige a quiénes agregar'
                  : 'Elige con quién hablar'}
            </Text>
          </View>
        </View>

        {paso === 'contactos' ? (
          <ContactPicker
            credential={credential}
            selected={elegidos.map((contact) => contact.id)}
            onToggle={alternar}
            multiple={modo === 'grupo'}
            // Solo en «nuevo chat»: armando un grupo, invitar a alguien que
            // todavía no está no ayuda — no se lo puede agregar igual.
            conInvitar={modo === 'directo'}
            header={
              modo === 'directo' ? (
                <View className="mx-4 mb-3">
                  <GrupoDeAjustes>
                    <FilaDeAjuste testID="btn-nuevo-grupo" icono={Users} titulo="Nuevo grupo" onPress={() => setModo('grupo')} />
                    <FilaDeAjuste
                      testID="btn-nuevo-borrador"
                      icono={NotebookPen}
                      titulo="Nuevo borrador"
                      detalle="Un chat solo contigo, con nombre: notas, fotos y links."
                      onPress={() => {
                        setModo('borrador');
                        setPaso('info');
                      }}
                    />
                    {/* El chat secreto se elige ANTES de tocar a la persona: al
                        tocarla se abre la conversación, así que después ya es
                        tarde. */}
                    <FilaDeAjuste
                      testID="switch-secreto"
                      icono={Lock}
                      titulo="Chat secreto"
                      detalle="Cifrado de punta a punta. Lila no puede leerlo y no se recupera si pierdes el teléfono."
                      onPress={() => setSecreto((valor) => !valor)}
                      derecha={<Interruptor value={secreto} onValueChange={setSecreto} />}
                    />
                  </GrupoDeAjustes>
                </View>
              ) : null
            }
          />
        ) : (
          <View className="flex-1 px-4">
            <View className="flex-row items-center gap-2 rounded-xl bg-primary/[0.07] px-4">
              <TextInput
                testID="input-nombre-grupo"
                value={nombre}
                onChangeText={(text) => {
                  setNombre(text.slice(0, MAX_NOMBRE_DE_GRUPO));
                  setError('');
                }}
                placeholder={modo === 'borrador' ? 'Ideas, Compras, Obra…' : 'Nombre del grupo'}
                placeholderTextColor={colores["on-surface-variant"]}
                autoFocus
                className="min-h-[52px] min-w-0 flex-1 text-base text-on-surface"
              />
              {/* El contador del diseño: 25 caracteres es el tope. */}
              <Text className="text-[11px] text-on-surface-variant">
                {nombre.length}/{MAX_NOMBRE_DE_GRUPO}
              </Text>
            </View>

            {modo === 'borrador' ? (
              <Text className="mt-3 text-[13px] leading-5 text-on-surface-variant">
                Solo tú lo ves. Guarda ahí notas, fotos, links y lo que quieras tener a mano. Puedes tener varios, uno por tema.
              </Text>
            ) : (
            <Text className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-wider text-primary">
              Participantes
            </Text>
            )}
            <View className="flex-row flex-wrap gap-3">
              {elegidos.map((contact) => (
                <View key={contact.id} className="w-16 items-center">
                  <View className="relative">
                    <Avatar nombre={contact.name ?? contact.phone} tamano={AVATAR_ELEGIDO} />
                    {/* La × de la captura, para sacar a alguien sin volver atrás. */}
                    <Pressable
                      // 24 dp de dibujo, 44 de toque.
                      hitSlop={10}
                      testID={`quitar-${contact.id}`}
                      onPress={() =>
                        setElegidos((actuales) => actuales.filter((item) => item.id !== contact.id))
                      }
                      className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-on-surface-variant"
                    >
                      <X size={11} color={colores["on-primary"]} />
                    </Pressable>
                  </View>
                  <Text className="mt-1 text-[11px] text-on-surface-variant" numberOfLines={1}>
                    {contact.name ?? contact.phone}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {error ? (
          <Text className="px-4 pb-2 text-sm text-error" testID="error-nuevo-chat">
            {error}
          </Text>
        ) : null}

        {modo === 'borrador' ? (
          <View className="px-4 pt-2" style={{ paddingBottom: margenes.pie }}>
            <Pressable
              testID="btn-crear-borrador"
              disabled={guardando || !nombre.trim()}
              onPress={() => void crearBorrador()}
              className={`min-h-[54px] flex-row items-center justify-center gap-2 rounded-xl ${guardando || !nombre.trim() ? 'bg-primary/40' : 'bg-primary'}`}
            >
              <Check size={18} color={colores['on-primary']} />
              <Text className="text-base font-bold text-on-primary">{guardando ? 'Creando…' : 'Crear borrador'}</Text>
            </Pressable>
          </View>
        ) : null}
        {modo === 'grupo' ? (
          <View className="px-4 pt-2" style={{ paddingBottom: margenes.pie }}>
            <Pressable
              testID="btn-continuar-grupo"
              disabled={guardando || elegidos.length === 0}
              onPress={() => (paso === 'contactos' ? setPaso('info') : void crearGrupo())}
              className={`min-h-[54px] flex-row items-center justify-center gap-2 rounded-xl ${
                guardando || elegidos.length === 0 ? 'bg-primary/40' : 'bg-primary'
              }`}
            >
              <Check size={18} color={colores["on-primary"]} />
              <Text className="text-base font-bold text-on-primary">
                {paso === 'contactos'
                  ? `Continuar${elegidos.length ? ` (${elegidos.length})` : ''}`
                  : guardando
                    ? 'Creando…'
                    : 'Crear grupo'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
