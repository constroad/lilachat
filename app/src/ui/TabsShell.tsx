import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { ArrowLeft, BellRing, Camera, ChevronRight, CloudUpload, Moon, RefreshCw, Search, Sun, SunMoon, User, UserPlus } from 'lucide-react-native';
import type { Credential } from '../auth/credentialStore';
import { listChats, type ChatSummary } from '../api/client';
import { connectSocket } from '../chat/socketClient';
import { avisarMensaje, prepararAvisos } from '../chat/avisoLocal';
import { iniciarServicio } from '../../modules/servicio-socket/src';
import { ChatListScreen } from '../chat/ChatListScreen';
import { CreateEventScreen } from '../agenda/CreateEventScreen';
import { CreatePollScreen } from '../agenda/CreatePollScreen';
import { CreateReminderScreen } from '../agenda/CreateReminderScreen';
import { AgendaScreen } from '../agenda/AgendaScreen';
import { PollsScreen } from '../agenda/PollsScreen';
import { InviteScreen } from '../contacts/InviteScreen';
import { NewChatScreen } from '../contacts/NewChatScreen';
import { publishPublicKey } from '../crypto/deviceKeys';
import { BackupScreen } from '../settings/BackupScreen';
import type { ResultadoDelChequeo } from '../settings/actualizacion';
import { buscarActualizacion, versionActual } from '../settings/versionApi';
import { AppHeader, BottomNav, type Tab } from './BottomNav';
import { useMargenes } from './useMargenes';
import { nombreDeContacto } from '@lilachat/shared';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { useColores, useTema } from './tema';

/**
 * El contenedor de las pestañas: header y barra inferior viven ACÁ y las
 * pantallas solo traen su contenido.
 *
 * Antes cada pantalla dibujaba su propia barra, y eso garantiza que se
 * desincronicen —una pestaña activa distinta, un alto distinto— apenas se
 * agrega la segunda.
 */
export function TabsShell({
  credential,
  onOpenChat,
  onLogout,
  segundoPlano,
  onSegundoPlano,
}: {
  credential: Credential;
  onOpenChat: (chat: ChatSummary) => void;
  onLogout: () => void;
  /**
   * Si el servicio en primer plano puede correr. Baja desde `App.tsx` en vez de
   * leerse acá otra vez: dos copias del mismo ajuste se desincronizan, y el
   * síntoma sería el peor posible —el interruptor en una posición y la
   * notificación en la otra—.
   */
  segundoPlano: boolean;
  onSegundoPlano: (activo: boolean) => void;
}) {
  const colores = useColores();
  const { modo, setModo } = useTema();
  const margenes = useMargenes();
  const [tab, setTab] = useState<Tab>('chats');
  const [creating, setCreating] = useState<'event' | 'reminder' | 'poll' | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  /** La lista al día para el aviso, sin re-suscribir el socket en cada cambio. */
  const chatsRef = useRef<ChatSummary[]>([]);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);
  const [reloadKey, setReloadKey] = useState(0);
  const [showBackup, setShowBackup] = useState(false);
  const [invitando, setInvitando] = useState(false);
  const [chequeo, setChequeo] = useState<ResultadoDelChequeo | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [enlaceApp, setEnlaceApp] = useState('');

  /**
   * El enlace directo al APK se busca AL ARRANCAR, no al tocar «buscar
   * actualizaciones».
   *
   * Estaba atado a ese botón, así que la invitación salía con una sola puerta
   * —la tienda— y la opción 2 no aparecía nunca. Visto compartiendo de verdad
   * en el emulador (27/08/2026): el texto llegaba con «1)» y sin «2)».
   */
  useEffect(() => {
    void buscarActualizacion().then(({ downloadUrl }) => setEnlaceApp(downloadUrl));
  }, []);

  /**
   * Busca la versión publicada y, si hay una más nueva, abre su descarga.
   *
   * La app NO se instala a sí misma: eso lo hace Android con el APK bajado, y
   * el camino cómodo es el navegador. Quien tenga LilaStore la va a actualizar
   * desde ahí con verificación de `sha256`; este botón es para quien la instaló
   * directo y no tiene la tienda.
   */
  const verificar = async () => {
    if (verificando) return;
    setVerificando(true);
    const { resultado, downloadUrl } = await buscarActualizacion();
    setChequeo(resultado);
    setEnlaceApp(downloadUrl);
    setVerificando(false);
    if (resultado.estado === 'hay-nueva' && downloadUrl) void Linking.openURL(downloadUrl);
  };
  const [newChat, setNewChat] = useState(false);

  // Los chats se cargan acá porque los necesitan TRES pantallas: la lista, y
  // los formularios de evento y encuesta —que preguntan en qué conversación—.
  const loadChats = useCallback(async () => {
    const result = await listChats(credential.jwt);
    if (result.ok) setChats(result.data.chats);
  }, [credential.jwt]);

  /**
   * La burbuja de arriba cuando llega un mensaje, para CUALQUIER chat.
   *
   * Vive acá y no en `useChat` porque ese hook solo existe con un chat abierto:
   * el aviso tiene que salir sobre todo cuando NO se está mirando ese chat.
   *
   * El socket ya está conectado; esto solo escucha. Cuando la app está atrás,
   * Android lo suspende y el mensaje entra al reconectar — sostenerlo es lo que
   * hace el servicio en primer plano.
   */
  /**
   * El permiso se pide ANTES y el servicio se reinicia DESPUÉS.
   *
   * `startForeground` publica su notificación en el momento de arrancar: si en
   * ese instante `POST_NOTIFICATIONS` estaba denegado, Android la suprime y
   * **conceder el permiso después no la hace aparecer**. El servicio queda
   * corriendo e invisible — que es justo lo que se vio en el emulador
   * (27/08/2026): `isForeground=true` y la bandeja vacía. Volver a llamar a
   * `iniciarServicio()` dispara otro `onStartCommand`, que la publica de nuevo.
   *
   * **Vive en su propio efecto y no con el del socket** (27/08/2026): al
   * agregarle el interruptor, tenerlos juntos hacía que tocar el switch
   * desconectara y reconectara el socket. Cambiar una preferencia de avisos no
   * puede cortar la conexión.
   *
   * El permiso se pide igual con el interruptor apagado: las burbujas de mensaje
   * con la app abierta también lo necesitan.
   */
  useEffect(() => {
    void prepararAvisos().then(() => {
      if (segundoPlano) iniciarServicio();
    });
  }, [segundoPlano]);

  useEffect(() => {
    const socket = connectSocket(credential.jwt);
    const alLlegar = async (mensaje: {
      chatId: string;
      senderId: string;
      kind: 'text' | 'image' | 'video' | 'audio' | 'file';
      body?: string;
      envelope?: unknown;
    }) => {
      // Lo mío no se avisa: acabo de escribirlo.
      if (mensaje.senderId === credential.userId) return;

      /**
       * Si el chat no está en la lista, se recarga ANTES de avisar.
       *
       * Es el caso del primer mensaje de alguien nuevo: la conversación se creó
       * después de que la app cargó su lista, así que no se conocía el nombre y
       * la burbuja decía «Lilachat». Visto en el emulador (27/08/2026), y es
       * justo cuando el nombre más importa — no sabés quién te escribió.
       */
      let chat = chatsRef.current.find((uno) => uno.id === mensaje.chatId);
      if (!chat) {
        await loadChats();
        chat = chatsRef.current.find((uno) => uno.id === mensaje.chatId);
      }
      void avisarMensaje({
        chatId: mensaje.chatId,
        // El nombre de TU agenda, igual que en la lista: la burbuja decia
        // «960397018» y ese numero no le dice nada a nadie de un vistazo.
        chatName:
          nombreDeContacto({
            delServidor: chat?.name,
            telefono: chat?.phone,
            agenda: agendaPorTelefono(),
          }) || 'Lilachat',
        senderName: null,
        esGrupo: chat?.kind === 'group',
        kind: mensaje.kind,
        body: mensaje.body ?? '',
        // Un chat secreto no muestra el texto: la burbuja se lee en la pantalla
        // de bloqueo, y el cifrado existe justamente para que nadie lo lea.
        cifrado: Boolean(mensaje.envelope),
      });
    };

    socket.on('msg.new', (mensaje: Parameters<typeof alLlegar>[0]) => void alLlegar(mensaje));
    return () => {
      socket.off('msg.new');
    };
  }, [credential.jwt, credential.userId, loadChats]);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  /**
   * La clave pública se publica al entrar, no al abrir el primer chat secreto.
   *
   * Si se publicara recién ahí, nadie podría INICIAR una conversación cifrada
   * conmigo hasta que yo abriera una — y el otro vería «esta persona no tiene
   * clave» sin entender por qué. Es idempotente: republicar la misma no cambia
   * nada.
   */
  useEffect(() => {
    void publishPublicKey(credential.jwt);
  }, [credential.jwt]);

  return (
    <View className="flex-1 bg-background">
      <AppHeader>
        {tab === 'chats' ? (
          <>
            {/* Cámara y búsqueda están en el diseño; quedan inertes hasta que
                existan (la búsqueda es F6). */}
            <View className="h-11 w-9 items-center justify-center opacity-40">
              <Camera size={20} color={colores["on-surface-variant"]} />
            </View>
            <View className="h-11 w-9 items-center justify-center opacity-40">
              <Search size={20} color={colores["on-surface-variant"]} />
            </View>
          </>
        ) : null}
        {/**
         * El avatar LLEVA A AJUSTES; no cierra la sesión.
         *
         * Hasta el 27/08/2026 este círculo hacía `onLogout` directo. José: «hay
         * un círculo con un número, no me dice qué es ni para qué sirve». Tenía
         * más razón de la que sabía — era un botón sin etiqueta que **cerraba la
         * sesión de un toque y sin preguntar**, y el número era el primer dígito
         * de su teléfono porque no tiene nombre puesto.
         *
         * Cerrar sesión ya vive en Ajustes, escrito y en su sección. Dos formas
         * de hacer lo mismo, una de ellas muda, no es una comodidad: es una
         * trampa.
         */}
        <Pressable
          testID="btn-perfil"
          accessibilityLabel="Tu perfil y ajustes"
          onPress={() => setTab('ajustes')}
          className="ml-1 h-11 w-11 items-center justify-center rounded-full bg-primary/10"
        >
          {credential.name?.trim() ? (
            <Text className="text-sm font-bold text-primary" testID="saludo-usuario">
              {credential.name.trim().slice(0, 1).toUpperCase()}
            </Text>
          ) : (
            // Sin nombre NO se muestra la inicial del teléfono: un «9» suelto no
            // significa nada para nadie. El ícono al menos dice «esto sos vos».
            <User size={18} color={colores.primary} testID="saludo-usuario" />
          )}
        </Pressable>
      </AppHeader>

      <View className="flex-1" key={`${tab}-${reloadKey}`}>
        {tab === 'chats' ? (
          <ChatListScreen
            credential={credential}
            onOpenChat={onOpenChat}
            onNewChat={() => setNewChat(true)}
          />
        ) : tab === 'encuestas' ? (
          <PollsScreen credential={credential} onCreate={() => setCreating('poll')} />
        ) : tab === 'agenda' ? (
          // Eventos y avisos en una sola pestaña: el botón de crear ofrece los
          // dos tipos en vez de adivinar por el filtro activo.
          <AgendaScreen credential={credential} onCreate={(kind) => setCreating(kind)} />
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16 }}
            testID="pantalla-ajustes"
          >
            <View className="flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-4">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-primary">
                <Text className="text-lg font-bold text-on-primary">
                  {(credential.name ?? credential.phone).slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-base font-semibold text-on-surface">
                  {credential.name ?? credential.phone}
                </Text>
                <Text className="text-sm text-on-surface-variant">{credential.phone}</Text>
              </View>
            </View>

            <Text className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
              Apariencia
            </Text>
            {/**
             * Claro, oscuro o el del sistema (José, 27/08/2026: «lilachat no
             * tiene darkmode o light mode como lilastore»).
             *
             * **Tres opciones y no dos**, igual que LilaStore. Sin «sistema», la
             * primera vez que alguien abre la app de noche le explota una
             * pantalla blanca en la cara y la única salida es acordarse de venir
             * hasta acá. Con automático por defecto, la mayoría no toca nada.
             *
             * Control segmentado y no una lista: son opciones EXCLUYENTES y se
             * comparan entre sí — verlas juntas es la mitad de la decisión.
             */}
            <View className="flex-row rounded-xl border border-outline/10 bg-surface p-1">
              {(
                [
                  { key: 'sistema' as const, label: 'Sistema', Icono: SunMoon },
                  { key: 'claro' as const, label: 'Claro', Icono: Sun },
                  { key: 'oscuro' as const, label: 'Oscuro', Icono: Moon },
                ]
              ).map(({ key, label, Icono }) => {
                const activo = modo === key;
                return (
                  <Pressable
                    key={key}
                    testID={`tema-${key}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activo }}
                    onPress={() => setModo(key)}
                    className={`min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 rounded-lg ${
                      activo ? 'bg-primary' : ''
                    }`}
                  >
                    <Icono
                      size={15}
                      color={activo ? colores['on-primary'] : colores['on-surface-variant']}
                    />
                    <Text
                      className={`text-[13px] font-semibold ${
                        activo ? 'text-on-primary' : 'text-on-surface-variant'
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
              Avisos
            </Text>
            {/**
             * El interruptor de la notificación permanente (José, 27/08/2026).
             *
             * No se puede quitar la notificación y quedarse con los mensajes:
             * Android la exige a cambio de dejar vivo el socket, y WhatsApp se
             * la ahorra porque usa FCM —un canal del sistema— que acá se
             * descartó. Lo que sí se puede es que la decisión sea de quien la
             * ve todos los días, con el costo escrito y no escondido.
             */}
            <View className="min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-4">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <BellRing size={18} color={colores.primary} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-semibold text-on-surface">
                  Recibir con la app cerrada
                </Text>
                <Text className="text-[11px] text-on-surface-variant">
                  {segundoPlano
                    ? 'Android exige mostrar el aviso fijo mientras esté activo'
                    : 'Los mensajes llegan solo con Lilachat abierto'}
                </Text>
              </View>
              <Switch
                testID="sw-segundo-plano"
                value={segundoPlano}
                onValueChange={onSegundoPlano}
              />
            </View>

            <Text className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
              Datos
            </Text>
            <Pressable
              testID="btn-respaldo"
              onPress={() => setShowBackup(true)}
              className="min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <CloudUpload size={18} color={colores.primary} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-semibold text-on-surface">Copia de seguridad</Text>
                <Text className="text-[11px] text-on-surface-variant">
                  Tus chats, respaldados cada noche
                </Text>
              </View>
              <ChevronRight size={18} color={colores.outline} />
            </Pressable>

            <Text className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
              Lilachat
            </Text>

            <Pressable
              testID="btn-invitar"
              onPress={() => setInvitando(true)}
              className="min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <UserPlus size={18} color={colores.primary} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-semibold text-on-surface">Invitar a alguien</Text>
                <Text className="text-[11px] text-on-surface-variant">
                  Desde tus contactos, con el enlace de descarga
                </Text>
              </View>
              <ChevronRight size={18} color={colores.outline} />
            </Pressable>

            {/* «Buscar actualizaciones». Se dispara con un toque y NO al abrir
                ajustes: un pedido de red cada vez que alguien entra acá es
                tráfico que nadie pidió. */}
            <Pressable
              testID="btn-actualizaciones"
              onPress={() => void verificar()}
              className="mt-2 min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <RefreshCw size={18} color={colores.primary} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-semibold text-on-surface">
                  {chequeo?.estado === 'hay-nueva'
                    ? `Actualizar a ${chequeo.version}`
                    : 'Buscar actualizaciones'}
                </Text>
                <Text className="text-[11px] text-on-surface-variant">
                  {verificando
                    ? 'Verificando…'
                    : chequeo?.estado === 'al-dia'
                      ? `Versión ${versionActual()} · estás al día`
                      : chequeo?.estado === 'no-se-pudo'
                        ? 'No se pudo verificar. Revisá la señal.'
                        : `Versión ${versionActual()}`}
                </Text>
              </View>
              <ChevronRight size={18} color={colores.outline} />
            </Pressable>

            <Pressable
              testID="btn-salir"
              onPress={onLogout}
              className="mt-6 min-h-[48px] items-center justify-center rounded-lg bg-surface-variant px-6"
            >
              <Text className="text-sm font-semibold text-on-surface">Cerrar sesión</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>

      <BottomNav active={tab} onChange={setTab} />

      {/* El lápiz de la lista, que no hacía nada. */}
      <NewChatScreen
        visible={newChat}
        credential={credential}
        onClose={() => setNewChat(false)}
        onOpenChat={(nuevo) => {
          const abierto = chats.find((chat) => chat.id === nuevo.id);
          if (abierto) return onOpenChat(abierto);
          // Recién creado: todavía no está en la lista cargada, así que se
          // recarga y se abre con lo mínimo que la conversación necesita —
          // incluido el NOMBRE, o el header diría «Conversación».
          void loadChats();
          onOpenChat({
            id: nuevo.id,
            name: nuevo.name,
            kind: nuevo.kind,
            encrypted: nuevo.encrypted,
            memberIds: [],
            lastSeq: 0,
            unread: 0,
            lastMessage: null,
            othersReadSeq: 0,
            othersDeliveredSeq: 0,
          });
        }}
      />

      <InviteScreen
        visible={invitando}
        credential={credential}
        enlaceApp={enlaceApp}
        onClose={() => setInvitando(false)}
      />

      {/* Pantalla completa y no una pestaña: el respaldo se visita de vez en
          cuando, y una sexta pestaña permanente le daría un peso que no tiene. */}
      <Modal visible={showBackup} animationType="slide" onRequestClose={() => setShowBackup(false)}>
        <View className="flex-1 bg-background">
          <View className="flex-row items-center gap-2 border-b border-outline/10 bg-surface px-4 pb-3" style={{ paddingTop: margenes.cabecera }}>
            <Pressable
              testID="btn-cerrar-respaldo"
              onPress={() => setShowBackup(false)}
              className="h-11 w-9 items-center justify-center"
            >
              <ArrowLeft size={22} color={colores["on-surface"]} />
            </Pressable>
            <Text className="flex-1 text-lg font-bold text-on-surface">Copia de seguridad</Text>
          </View>
          <BackupScreen credential={credential} />
        </View>
      </Modal>

      {/* Tres pantallas y no una hoja genérica: el diseño hace «New Event» con
          héroe centrado y «New Poll» con el título a la izquierda, y una sola
          hoja compartida no daba ninguna de las dos.
          Re-montar la pestaña es lo que la hace recargar: sin eso, lo recién
          creado no aparece hasta tirar para refrescar. */}
      {creating === 'event' ? (
        <CreateEventScreen
          visible
          credential={credential}
          onClose={() => setCreating(null)}
          onCreated={() => setReloadKey((key) => key + 1)}
        />
      ) : creating === 'poll' ? (
        <CreatePollScreen
          visible
          credential={credential}
          onClose={() => setCreating(null)}
          onCreated={() => setReloadKey((key) => key + 1)}
        />
      ) : creating === 'reminder' ? (
        <CreateReminderScreen
          visible
          credential={credential}
          onClose={() => setCreating(null)}
          onCreated={() => setReloadKey((key) => key + 1)}
        />
      ) : null}
    </View>
  );
}
