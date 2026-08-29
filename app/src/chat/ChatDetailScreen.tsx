import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Image } from 'expo-image';
import {
  ArrowLeft,
  Lock,
  LogOut,
  Phone,
  Search,
  Flag,
  UserPlus,
  Video,
} from 'lucide-react-native';
import { nombreDeContacto, type ContactGroup } from '@lilachat/shared';
import { listContacts } from '../contacts/contactsApi';
import type { Credential } from '../auth/credentialStore';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import type { ServerMessage } from './socketClient';

/**
 * «Chat Detail» — la pantalla de `design/stitch/info-grupo-alpha.png`.
 *
 * Estaba diseñada y sin implementar, y José lo notó: «no está implementada la
 * screen de detail chat, revisá nuevamente Stitch porque esa screen sí existe».
 * Tenía razón; peor todavía, yo había construido el visor de imágenes sin mirar
 * su diseño, que también existe.
 *
 * **Sirve para 1:1 y para grupo, y no son la misma pantalla.** El diseño muestra
 * un grupo, pero la mayoría de las conversaciones son de a dos: ahí no hay
 * «participantes» que listar ni grupo del que salir, y dejar esas filas vacías o
 * inertes es peor que no ponerlas. Lo que cambia se decide por `kind`.
 */
type Miembro = {
  id: string;
  name: string | null;
  phone: string | null;
  role: 'admin' | 'member';
  esYo: boolean;
};

type Detalle = {
  id: string;
  kind: 'direct' | 'group';
  name?: string;
  encrypted: boolean;
  members: Miembro[];
};

type Estado =
  | { fase: 'cargando' }
  | { fase: 'error'; mensaje: string }
  | { fase: 'listo'; detalle: Detalle };

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lilachat.constroad.com';

export function ChatDetailScreen({
  visible,
  chatId,
  chatName,
  credential,
  mensajes,
  onCerrar,
  onSalio,
  onLlamar,
  onVerImagen,
}: {
  visible: boolean;
  chatId: string;
  chatName: string;
  credential: Credential;
  /** Los mensajes ya cargados: de ahí sale la tira de multimedia, sin pedir nada. */
  mensajes: ServerMessage[];
  onCerrar: () => void;
  /**
   * Se salió del grupo: hay que cerrar TAMBIÉN la conversación.
   *
   * Cerrar solo el detalle deja a la persona dentro del chat que acaba de
   * abandonar, con el campo de escribir habilitado sobre algo donde ya no puede
   * escribir. Hay que tocar atrás para enterarse de que funcionó (visto en el
   * emulador, 29/08/2026).
   */
  onSalio?: () => void;
  onLlamar?: (video: boolean) => void;
  onVerImagen?: (url: string) => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' });
  const [silenciado, setSilenciado] = useState(false);

  const [accionando, setAccionando] = useState(false);
  /** La hoja para elegir a quién sumar. */
  const [agregando, setAgregando] = useState(false);
  const [aviso, setAviso] = useState('');

  /**
   * Sumar o salir. Las dos recargan el detalle al terminar: es la lista que la
   * persona está mirando, y dejarla vieja después de una acción propia es lo que
   * hace dudar de si funcionó.
   */
  const llamar = useCallback(
    async (ruta: string, cuerpo?: Record<string, unknown>) => {
      setAccionando(true);
      setAviso('');
      try {
        const respuesta = await fetch(`${BASE_URL}/api/chats/${chatId}/${ruta}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${credential.jwt}`,
          },
          body: JSON.stringify(cuerpo ?? {}),
          signal: AbortSignal.timeout(10_000),
        });
        if (!respuesta.ok) {
          const cuerpoError = (await respuesta.json().catch(() => null)) as {
            message?: string;
          } | null;
          // El motivo del server se muestra: son accionables («ya está en el
          // grupo»), no errores técnicos.
          setAviso(cuerpoError?.message ?? 'No se pudo.');
          return false;
        }
        return true;
      } catch {
        setAviso('Sin conexión. Probá de nuevo.');
        return false;
      } finally {
        setAccionando(false);
      }
    },
    [chatId, credential.jwt]
  );

  const cargar = useCallback(async () => {
    setEstado({ fase: 'cargando' });
    try {
      const respuesta = await fetch(`${BASE_URL}/api/chats/${chatId}/detail`, {
        headers: { Authorization: `Bearer ${credential.jwt}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!respuesta.ok) {
        setEstado({ fase: 'error', mensaje: 'No pudimos cargar los datos del chat.' });
        return;
      }
      setEstado({ fase: 'listo', detalle: (await respuesta.json()) as Detalle });
    } catch {
      // **El error se DICE.** Una pantalla que se queda en blanco al fallar la
      // red es indistinguible de una pantalla rota.
      setEstado({ fase: 'error', mensaje: 'Sin conexión. Probá de nuevo.' });
    }
  }, [chatId, credential.jwt]);

  useEffect(() => {
    if (visible) void cargar();
  }, [visible, cargar]);

  /**
   * Las fotos del chat, sacadas de los mensajes que la pantalla anterior YA
   * tiene cargados. No se pide nada al server: la tira del diseño es un vistazo,
   * no un archivo completo, y un endpoint nuevo para mostrar cuatro miniaturas
   * sería trabajo y latencia por nada.
   */
  const fotos = mensajes
    .filter((m) => m.media?.thumbUrl && !m.deletedAt)
    .slice(-12)
    .reverse();

  const agenda = agendaPorTelefono();
  const nombreDe = (miembro: Miembro) =>
    miembro.esYo
      ? 'Vos'
      : nombreDeContacto({ delServidor: miembro.name, telefono: miembro.phone, agenda }) ||
        'Sin nombre';

  const detalle = estado.fase === 'listo' ? estado.detalle : null;
  const esGrupo = detalle?.kind === 'group';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <View className="flex-1 bg-background" testID="pantalla-detalle-chat">
        <View
          className="flex-row items-center gap-2 border-b border-outline/10 bg-surface px-3 pb-3"
          style={{ paddingTop: margenes.cabecera }}
        >
          <Pressable
            testID="btn-cerrar-detalle"
            accessibilityLabel="Volver a la conversación"
            onPress={onCerrar}
            className="h-11 w-11 items-center justify-center"
          >
            <ArrowLeft size={22} color={colores['on-surface']} />
          </Pressable>
          <Text className="flex-1 text-lg font-bold text-on-surface">Detalle del chat</Text>
        </View>

        {estado.fase === 'cargando' ? (
          /* Esqueleto con la GEOMETRÍA real: así el contenido no salta al
             llegar, que es la regla del catálogo de UI. */
          <View className="px-4 pt-6" testID="detalle-cargando">
            <View className="items-center">
              <View className="h-24 w-24 rounded-full bg-surface-variant" />
              <View className="mt-3 h-5 w-40 rounded bg-surface-variant" />
            </View>
            {[0, 1, 2].map((i) => (
              <View key={i} className="mt-4 h-14 rounded-xl bg-surface-variant" />
            ))}
          </View>
        ) : estado.fase === 'error' ? (
          <View className="flex-1 items-center justify-center px-8" testID="detalle-error">
            <Text className="text-center text-base text-on-surface">{estado.mensaje}</Text>
            <Pressable
              testID="btn-reintentar-detalle"
              onPress={() => void cargar()}
              className="mt-5 min-h-[48px] items-center justify-center rounded-xl bg-primary px-6"
            >
              <Text className="text-sm font-semibold text-on-primary">Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: margenes.pie + 24 }}>
            {/* Identidad, como en el diseño: avatar grande, nombre, y debajo el
                dato que ubica —cuántos son, o el teléfono en un 1:1—. */}
            <View className="items-center px-6 pt-6">
              <View className="h-24 w-24 items-center justify-center rounded-full bg-primary/10">
                <Text className="text-3xl font-bold text-primary">
                  {chatName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <Text className="mt-3 text-center text-xl font-bold text-on-surface">{chatName}</Text>
              <Text className="mt-0.5 text-sm text-on-surface-variant">
                {esGrupo
                  ? `${detalle!.members.length} participantes`
                  : (detalle!.members.find((m) => !m.esYo)?.phone ?? '')}
              </Text>
            </View>

            {/* Fila de acciones del diseño. Solo van las que HACEN algo: una
                acción inerte enseña que los botones de esta app no responden. */}
            <View className="mt-6 flex-row justify-center gap-3 px-4">
              {!esGrupo && onLlamar ? (
                <>
                  <AccionRedonda
                    testID="btn-detalle-llamar"
                    etiqueta="Llamar"
                    onPress={() => onLlamar(false)}
                  >
                    <Phone size={20} color={colores.primary} />
                  </AccionRedonda>
                  <AccionRedonda
                    testID="btn-detalle-video"
                    etiqueta="Video"
                    onPress={() => onLlamar(true)}
                  >
                    <Video size={20} color={colores.primary} />
                  </AccionRedonda>
                </>
              ) : null}
              {esGrupo ? (
                <AccionRedonda
                  testID="btn-detalle-agregar"
                  etiqueta="Añadir"
                  onPress={() => setAgregando(true)}
                >
                  <UserPlus size={20} color={colores.primary} />
                </AccionRedonda>
              ) : null}
              <AccionRedonda testID="btn-detalle-buscar" etiqueta="Buscar" deshabilitado>
                <Search size={20} color={colores['on-surface-variant']} />
              </AccionRedonda>
            </View>

            <Rotulo>Multimedia</Rotulo>
            {fotos.length === 0 ? (
              <Text className="px-4 text-sm text-on-surface-variant">
                Todavía no compartieron fotos en este chat.
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
                {fotos.map((m) => (
                  <Pressable
                    key={m.seq}
                    testID={`detalle-media-${m.seq}`}
                    onPress={() => onVerImagen?.(m.media!.thumbUrl!)}
                    className="mr-2 overflow-hidden rounded-lg"
                  >
                    <Image
                      source={{ uri: m.media!.thumbUrl! }}
                      style={{ width: 84, height: 84 }}
                      contentFit="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {esGrupo ? (
              <>
                <Rotulo>Participantes</Rotulo>
                <View className="px-4">
                  {detalle!.members.map((miembro) => (
                    <View
                      key={miembro.id}
                      testID={`miembro-${miembro.id}`}
                      className="mb-2 flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-3"
                    >
                      <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Text className="text-sm font-bold text-primary">
                          {nombreDe(miembro).slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <Text className="flex-1 text-sm font-semibold text-on-surface">
                        {nombreDe(miembro)}
                      </Text>
                      {miembro.role === 'admin' ? (
                        <View className="rounded bg-primary/15 px-2 py-0.5">
                          <Text className="text-[10px] font-semibold text-primary">Admin</Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {aviso ? (
              <Text
                testID="aviso-detalle"
                className="mt-4 px-4 text-sm text-error"
              >
                {aviso}
              </Text>
            ) : null}

            <Rotulo>Ajustes del chat</Rotulo>
            <View className="px-4">
              <View className="mb-2 min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-4">
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold text-on-surface">
                    Silenciar notificaciones
                  </Text>
                  <Text className="text-[11px] text-on-surface-variant">
                    {silenciado ? 'No te avisamos de este chat' : 'Te avisamos de cada mensaje'}
                  </Text>
                </View>
                <Switch testID="sw-silenciar" value={silenciado} onValueChange={setSilenciado} />
              </View>

              {/* El cifrado se DICE como es, no como nos gustaría. Solo los chats
                  secretos son de punta a punta; en los demás el servidor guarda
                  el texto, y decir otra cosa acá sería mentir sobre privacidad. */}
              <View className="mb-2 min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-4">
                <Lock size={18} color={colores['on-surface-variant']} />
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold text-on-surface">
                    {detalle!.encrypted ? 'Chat secreto' : 'Chat normal'}
                  </Text>
                  <Text className="text-[11px] text-on-surface-variant">
                    {detalle!.encrypted
                      ? 'Cifrado de punta a punta. El servidor no puede leerlo.'
                      : 'El servidor guarda los mensajes para sincronizarlos entre tus aparatos.'}
                  </Text>
                </View>
              </View>

              {esGrupo ? (
                <Pressable
                  testID="btn-salir-grupo"
                  disabled={accionando}
                  onPress={async () => {
                    // `onSalio` cierra el detalle Y la conversación: quedarse
                    // adentro del grupo que se acaba de dejar no tiene sentido.
                    if (await llamar('leave')) (onSalio ?? onCerrar)();
                  }}
                  className={`mb-2 min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-4 ${accionando ? 'opacity-50' : ''}`}
                >
                  <LogOut size={18} color={colores.error} />
                  <Text className="text-sm font-semibold" style={{ color: colores.error }}>
                    Salir del grupo
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                testID="btn-reportar"
                className="min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-4 opacity-50"
                disabled
              >
                <Flag size={18} color={colores.error} />
                <Text className="text-sm font-semibold" style={{ color: colores.error }}>
                  {esGrupo ? 'Reportar grupo' : 'Reportar contacto'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
        <ElegirParaSumar
          visible={agregando}
          credential={credential}
          yaEstan={detalle?.members.map((m) => m.id) ?? []}
          onCerrar={() => setAgregando(false)}
          onElegir={async (userId) => {
            setAgregando(false);
            // Se recarga el detalle: la lista de participantes es justo lo que
            // la persona está mirando, y dejarla vieja hace dudar de si funcionó.
            if (await llamar('members', { userId })) await cargar();
          }}
        />
      </View>
    </Modal>
  );
}

function Rotulo({ children }: { children: string }) {
  return (
    <Text className="mb-2 mt-6 px-4 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
      {children}
    </Text>
  );
}

/**
 * Los botones redondos de la fila del diseño.
 *
 * Los que todavía no hacen nada van **apagados y sin respuesta al toque**, no
 * activos y mudos: un botón que se ve normal y no reacciona enseña que los
 * botones de esta app no funcionan, y esa lección después se aplica a los que sí.
 */
function AccionRedonda({
  children,
  etiqueta,
  onPress,
  testID,
  deshabilitado,
}: {
  children: React.ReactNode;
  etiqueta: string;
  onPress?: () => void;
  testID: string;
  deshabilitado?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityLabel={etiqueta}
      className={`items-center ${deshabilitado ? 'opacity-40' : ''}`}
    >
      <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        {children}
      </View>
      <Text className="mt-1 text-[11px] text-on-surface-variant">{etiqueta}</Text>
    </Pressable>
  );
}

/**
 * Elegir a quién sumar al grupo.
 *
 * Se listan los contactos de Lilachat —gente con la que ya compartís una
 * conversación— **menos los que ya están**. Mostrarlos igual y fallar al tocarlos
 * («esa persona ya está») sería hacerle descubrir la regla a los golpes.
 */
function ElegirParaSumar({
  visible,
  credential,
  yaEstan,
  onCerrar,
  onElegir,
}: {
  visible: boolean;
  credential: Credential;
  yaEstan: string[];
  onCerrar: () => void;
  onElegir: (userId: string) => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const [grupos, setGrupos] = useState<ContactGroup[] | null>(null);

  useEffect(() => {
    if (!visible) return;
    setGrupos(null);
    void listContacts(credential.jwt).then((r) => setGrupos(r.ok ? r.data.groups : []));
  }, [visible, credential.jwt]);

  const dentro = new Set(yaEstan);
  const candidatos = (grupos ?? [])
    .flatMap((g) => g.contacts)
    .filter((c) => !dentro.has(c.id));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <View className="flex-1 bg-background" testID="elegir-para-sumar">
        <View
          className="flex-row items-center gap-2 border-b border-outline/10 bg-surface px-3 pb-3"
          style={{ paddingTop: margenes.cabecera }}
        >
          <Pressable
            testID="btn-cerrar-sumar"
            accessibilityLabel="Cancelar"
            onPress={onCerrar}
            className="h-11 w-11 items-center justify-center"
          >
            <ArrowLeft size={22} color={colores['on-surface']} />
          </Pressable>
          <Text className="flex-1 text-lg font-bold text-on-surface">Sumar al grupo</Text>
        </View>

        {grupos === null ? (
          <View className="px-4 pt-4" testID="sumar-cargando">
            {[0, 1, 2].map((i) => (
              <View key={i} className="mb-2 h-14 rounded-xl bg-surface-variant" />
            ))}
          </View>
        ) : candidatos.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            {/* El vacío EXPLICA: «no hay contactos» a secas haría pensar que la
                agenda falló, cuando lo normal es que ya estén todos adentro. */}
            <Text className="text-center text-base leading-6 text-on-surface-variant">
              {yaEstan.length > 1
                ? 'Todos tus contactos de Lilachat ya están en este grupo.'
                : 'Todavía no tenés contactos en Lilachat para sumar.'}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {candidatos.map((contacto) => (
              <Pressable
                key={contacto.id}
                testID={`sumar-${contacto.id}`}
                onPress={() => onElegir(contacto.id)}
                className="mb-2 min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-3"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Text className="text-sm font-bold text-primary">
                    {(contacto.name ?? contacto.phone).slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold text-on-surface" numberOfLines={1}>
                    {contacto.name ?? contacto.phone}
                  </Text>
                  <Text className="text-[11px] text-on-surface-variant">{contacto.phone}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
