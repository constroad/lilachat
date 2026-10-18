import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { ArrowLeft, BellRing, ChevronRight, CloudUpload, User, UserPlus } from 'lucide-react-native';
import type { Credential } from '../auth/credentialStore';
import { listChats, type ChatSummary } from '../api/client';
import { connectSocket } from '../chat/socketClient';
import { avisarMensaje, prepararAvisos } from '../chat/avisoLocal';
import { iniciarServicio } from '../../modules/servicio-socket/src';
import { AvisoDePantallaCompleta } from './AvisoDePantallaCompleta';
import { ChatListScreen } from '../chat/ChatListScreen';
import { CreatePollScreen } from '../agenda/CreatePollScreen';
import { AgendaScreen } from '../agenda/AgendaScreen';
import { PollsScreen } from '../agenda/PollsScreen';
import { InviteScreen } from '../contacts/InviteScreen';
import { NewChatScreen } from '../contacts/NewChatScreen';
import { publishPublicKey } from '../crypto/deviceKeys';
import { BackupScreen } from '../settings/BackupScreen';
import { BandaDeActualizacion } from '../settings/BandaDeActualizacion';
import { AutoRespuestaAjuste } from '../settings/AutoRespuestaAjuste';
import { PerfilAjuste } from '../settings/PerfilAjuste';
import { Image } from 'expo-image';
import { usePerfilPropio } from '../settings/perfilPropio';
import { RespaldoAjuste } from '../settings/RespaldoAjuste';
import { useEsOperador } from '../settings/useEsOperador';
import { useActualizacionesDeLaApp } from '../settings/useActualizacionesDeLaApp';
import { AparienciaAjuste } from '../settings/AparienciaAjuste';
import { BuscarActualizacionesAjuste } from '../settings/BuscarActualizacionesAjuste';
import { Rotulo } from './Rotulo';
import { AppHeader, BottomNav, type Tab } from './BottomNav';
import { useMargenes } from './useMargenes';
import { DiagnosticoAjuste } from '../diagnostico/DiagnosticoAjuste';
import { visitadasCon } from './pestanas';
import { useAlVolver } from './useAlVolver';
import { decidirAtras } from './botonAtras';
import { nombreDeContacto } from '@lilachat/shared';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { useColores } from './tema';

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
  chatAbierto,
  pestanaPedida,
}: {
  credential: Credential;
  onOpenChat: (chat: ChatSummary, irASeq?: number) => void;
  onLogout: () => void;
  /**
   * Si el servicio en primer plano puede correr. Baja desde `App.tsx` en vez de
   * leerse acá otra vez: dos copias del mismo ajuste se desincronizan, y el
   * síntoma sería el peor posible —el interruptor en una posición y la
   * notificación en la otra—.
   */
  segundoPlano: boolean;
  onSegundoPlano: (activo: boolean) => void;
  /** El chat abierto encima (FL1): la lista sigue montada debajo. */
  chatAbierto: string | null;
  /** Una notificación de la agenda pide esta pestaña (FL8). */
  pestanaPedida?: { tab: 'agenda'; n: number } | null;
}) {
  // En un ref: el listener del socket no se re-suscribe al abrir y cerrar chats.
  const chatAbiertoRef = useRef(chatAbierto);
  chatAbiertoRef.current = chatAbierto;
  const colores = useColores();
  const perfilPropio = usePerfilPropio(credential);
  const margenes = useMargenes();
  const [tab, setTab] = useState<Tab>('chats');
  useEffect(() => {
    if (pestanaPedida) setTab(pestanaPedida.tab);
  }, [pestanaPedida]);
  const [creating, setCreating] = useState<'poll' | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  /** La lista al día para el aviso, sin re-suscribir el socket en cada cambio. */
  const chatsRef = useRef<ChatSummary[]>([]);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);
  const [reloadKey, setReloadKey] = useState(0);
  // Encuestas vuelve a pedir al entrar otra vez (votos y encuestas de otros).
  useAlVolver(tab === 'encuestas', () => setReloadKey((key) => key + 1));
  const [visitadas, setVisitadas] = useState<ReadonlySet<Tab>>(() => new Set<Tab>(['chats']));
  useEffect(() => setVisitadas((antes) => visitadasCon(antes, tab)), [tab]);
  /** Una pestaña montada pero no activa se oculta sin desmontarse. */
  const panel = (cual: Tab) => ({ flex: 1, display: cual === tab ? ('flex' as const) : ('none' as const) });
  const [showBackup, setShowBackup] = useState(false);
  const esOperador = useEsOperador(credential.jwt);
  const [invitando, setInvitando] = useState(false);
  const actualizaciones = useActualizacionesDeLaApp();
  const [newChat, setNewChat] = useState(false);

  /**
   * El botón ATRÁS de Android: cierra lo que esté abierto encima, si no vuelve a
   * Chats, y solo desde Chats sale. Sin esto Android cerraba la app desde
   * cualquier pestaña (José, 27/08/2026).
   *
   * Las sobrecapas se cierran de a UNA y en orden de encima hacia abajo: cerrar
   * las cuatro de un saque perdería el formulario que la persona tenga a medio
   * llenar detrás.
   */
  useEffect(() => {
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
      const haySobreCapa = Boolean(creating) || newChat || showBackup || invitando;
      const accion = decidirAtras({ pantalla: 'tabs', tab, haySobreCapa });

      if (accion === 'cerrar-sobrecapa') {
        if (creating) setCreating(null);
        else if (newChat) setNewChat(false);
        else if (showBackup) setShowBackup(false);
        else setInvitando(false);
        return true;
      }
      if (accion === 'ir-a-chats') {
        setTab('chats');
        return true;
      }
      return false; // desde Chats: que Android cierre, como cualquier app
    });
    return () => suscripcion.remove();
  }, [tab, creating, newChat, showBackup, invitando]);

  // Los chats se cargan acá porque los necesitan TRES pantallas: la lista, y
  // los formularios de evento y encuesta —que preguntan en qué conversación—.
  // Por ref (FL4): renovar el token no vuelve a pedir la lista.
  const jwtRef = useRef(credential.jwt);
  jwtRef.current = credential.jwt;
  const loadChats = useCallback(async () => {
    const result = await listChats(jwtRef.current);
    if (result.ok) setChats(result.data.chats);
  }, []);

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
      // Con un chat abierto avisa `App` (`sonarPorMensaje`): la lista ya no se
      // desmonta al abrir uno, y sin esto sonaba dos veces.
      if (chatAbiertoRef.current) return;

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

    const onNew = (mensaje: Parameters<typeof alLlegar>[0]) => void alLlegar(mensaje);
    socket.on('msg.new', onNew);
    return () => {
      // Con el handler: a secas borraba los listeners de App y de la lista.
      socket.off('msg.new', onNew);
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
            {/* La cámara apagada que había acá se fue (FL3): un botón que no
                hace nada enseña que la app no responde. La cámara vive en la
                píldora de cada chat. */}
            {/* La lupa de la cabecera se fue: el buscador vive AHORA en la
                lista, siempre visible. Dejar además un ícono apagado al lado de
                un buscador que funciona es enseñar que hay botones que no
                responden. */}
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
          {perfilPropio.avatarUrl ? (
            <Image
              testID="saludo-usuario"
              source={{ uri: perfilPropio.avatarUrl }}
              style={{ width: 44, height: 44, borderRadius: 22 }}
              contentFit="cover"
            />
          ) : perfilPropio.name?.trim() ? (
            <Text className="text-sm font-bold text-primary" testID="saludo-usuario">
              {perfilPropio.name.trim().slice(0, 1).toUpperCase()}
            </Text>
          ) : (
            // Sin nombre NO se muestra la inicial del teléfono: un «9» suelto no
            // significa nada para nadie. El ícono al menos dice «esto sos vos».
            <User size={18} color={colores.primary} testID="saludo-usuario" />
          )}
        </Pressable>
      </AppHeader>

      {/* Las pestañas quedan MONTADAS después de la primera visita y solo se
          ocultan (`pestanas.ts`): remontarlas mostraba el esqueleto en cada
          cambio. Al crear algo, la lista vuelve a pedir por la prop `recarga`,
          sin remontarse ni volver al esqueleto. */}
      <View className="flex-1">
        {visitadas.has('chats') ? (
          <View style={panel('chats')}>
          {/* La banda va arriba de la lista y SOLO en Chats: es la pantalla de
              entrada, y repetirla en las cuatro pestañas la convierte en ruido. */}
          <BandaDeActualizacion
            aviso={actualizaciones.aviso}
            estado={actualizaciones.estado}
            onActualizar={actualizaciones.actualizarDesdeBanda}
            onAbrirTienda={actualizaciones.abrirTienda}
            onDescartar={actualizaciones.descartarAviso}
          />
          <ChatListScreen
            credential={credential}
            chatAbierto={chatAbierto}
            onOpenChat={onOpenChat}
            onNewChat={() => setNewChat(true)}
          />
          </View>
        ) : null}
        {visitadas.has('encuestas') ? (
          <View style={panel('encuestas')}>
            <PollsScreen recarga={reloadKey} credential={credential} onCreate={() => setCreating('poll')} />
          </View>
        ) : null}
        {visitadas.has('agenda') ? (
          <View style={panel('agenda')}>
            {/* Eventos y avisos en una sola pestaña: el botón de crear ofrece
                los dos tipos en vez de adivinar por el filtro activo. */}
            <AgendaScreen credential={credential} activa={tab === 'agenda'} />
          </View>
        ) : null}
        {visitadas.has('ajustes') ? (
          <View style={panel('ajustes')}>
          {/* `padding` también en Android: con edge-to-edge la ventana ya no se
              encoge con el teclado, y la passphrase del respaldo quedaba tapada
              sin forma de subirla (mismo motivo que en ChatScreen). */}
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16 }}
            keyboardShouldPersistTaps="handled"
            testID="pantalla-ajustes"
          >
            <PerfilAjuste credential={credential} />

            <AparienciaAjuste />

            <Rotulo>Avisos</Rotulo>
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
                  Conexión permanente
                </Text>
                <Text className="text-[11px] text-on-surface-variant">
                  {segundoPlano
                    ? 'Android exige mostrar un aviso fijo, y gasta más batería'
                    : 'No hace falta: los mensajes llegan por notificación push'}
                </Text>
              </View>
              <Switch
                testID="sw-segundo-plano"
                value={segundoPlano}
                onValueChange={onSegundoPlano}
              />
            </View>
            <AvisoDePantallaCompleta visible={tab === 'ajustes'} />

            <Rotulo>Datos</Rotulo>
            <RespaldoAjuste credential={credential} />
            {/* El volcado de la base entera es de operadores (FL10): para el
                resto había dos «respaldos» en Ajustes y uno no era suyo. */}
            {esOperador ? (
              <Pressable
                testID="btn-respaldo"
                onPress={() => setShowBackup(true)}
                className="mt-2 min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-4"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <CloudUpload size={18} color={colores.primary} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold text-on-surface">Respaldo del servidor</Text>
                  <Text className="text-[11px] text-on-surface-variant">
                    La base entera, cada noche · operadores
                  </Text>
                </View>
                <ChevronRight size={18} color={colores.outline} />
              </Pressable>
            ) : null}

            <Rotulo>Lilachat</Rotulo>

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

            <AutoRespuestaAjuste jwt={credential.jwt} />

            <DiagnosticoAjuste />

            <BuscarActualizacionesAjuste
              chequeo={actualizaciones.chequeo}
              estado={actualizaciones.estado}
              verificando={actualizaciones.verificando}
              onVerificar={() => void actualizaciones.verificar()}
            />

            <Pressable
              testID="btn-salir"
              onPress={() =>
                // Con un toque borraba historial y passphrase sin preguntar (FL8).
                Alert.alert(
                  'Cerrar sesión',
                  'Se borran de este teléfono el historial y la passphrase del respaldo, y deja de recibir avisos. Tus chats vuelven al entrar; el historial, si tienes respaldo.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Cerrar sesión', style: 'destructive', onPress: onLogout },
                  ]
                )
              }
              className="mt-6 min-h-[48px] items-center justify-center rounded-lg bg-surface-variant px-6"
            >
              <Text className="text-sm font-semibold text-on-surface">Cerrar sesión</Text>
            </Pressable>
          </ScrollView>
          </KeyboardAvoidingView>
          </View>
        ) : null}
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
            memberIds: nuevo.memberIds,
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
        enlaceApp={actualizaciones.enlaceApp}
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
              className="h-11 w-11 items-center justify-center"
            >
              <ArrowLeft size={22} color={colores["on-surface"]} />
            </Pressable>
            <Text className="flex-1 text-lg font-bold text-on-surface">Respaldo del servidor</Text>
          </View>
          <BackupScreen credential={credential} />
        </View>
      </Modal>

      {/* Crear encuesta. Eventos y avisos se crean y editan dentro de la
          Agenda (17/10/2026). Al crear sube `reloadKey` y la lista vuelve a
          pedir sin remontarse. */}
      {creating === 'poll' ? (
        <CreatePollScreen
          visible
          credential={credential}
          onClose={() => setCreating(null)}
          onCreated={() => setReloadKey((key) => key + 1)}
        />
      ) : null}
    </View>
  );
}
