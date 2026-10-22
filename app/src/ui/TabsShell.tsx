import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, BackHandler, Pressable, Text, View } from 'react-native';
import { Modal } from './Modal';
import { ArrowLeft } from 'lucide-react-native';
import type { Credential } from '../auth/credentialStore';
import { listChats, type ChatSummary } from '../api/client';
import { connectSocket } from '../chat/socketClient';
import { avisarMensaje, prepararAvisos } from '../chat/avisoLocal';
import { iniciarServicio } from '../../modules/servicio-socket/src';
import { ChatListScreen } from '../chat/ChatListScreen';
import { SpaceChatsScreen } from '../spaces/SpaceChatsScreen';
import { findSpaceChat } from '../spaces/spacesApi';
import { useSpacesUi } from '../spaces/useSpacesUi';
import { CreatePollScreen } from '../agenda/CreatePollScreen';
import { AgendaScreen } from '../agenda/AgendaScreen';
import { PollsScreen } from '../agenda/PollsScreen';
import { InviteScreen } from '../contacts/InviteScreen';
import { NewChatScreen } from '../contacts/NewChatScreen';
import { publishPublicKey } from '../crypto/deviceKeys';
import { BackupScreen } from '../settings/BackupScreen';
import { BandaDeActualizacion } from '../settings/BandaDeActualizacion';
import { NovedadesDeLaVersion } from '../settings/NovedadesDeLaVersion';
import { UpdateLockScreen } from '../settings/UpdateLockScreen';
import { NowPlayingBar } from '../chat/NowPlayingBar';
import { versionActual } from '../settings/versionApi';
import { PantallaDeAjustes } from '../settings/PantallaDeAjustes';
import { usePerfilPropio } from '../settings/perfilPropio';
import { useEsOperador } from '../settings/useEsOperador';
import { useActualizacionesDeLaApp } from '../settings/useActualizacionesDeLaApp';
import { AppHeader, BottomNav, type Tab } from './BottomNav';
import { tabAfterModeChange } from './bottomTabs';
import { useMargenes } from './useMargenes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorBoundary } from './ErrorBoundary';
import { ANCHO_DE_LISTA, ANCHO_MAXIMO_DE_CONTENIDO } from './disposicion';
import { useDisposicion } from './useDisposicion';
import { SinChatElegido } from './PanelDeChat';
import { visitadasCon } from './pestanas';
import { useAlVolver } from './useAlVolver';
import { usePendientesDeAgenda } from '../agenda/usePendientesDeAgenda';
import { useIsFocused } from '@react-navigation/native';
import { decidirAtras } from './botonAtras';
import { nombreDeContacto } from '@lilachat/shared';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { useColores } from './tema';
import { buscarChat } from './buscarChat';
import { Avatar } from './Avatar';

/** Tu avatar en la cabecera (dp): 36 de dibujo dentro de 44 de toque. */
const AVATAR_PROPIO = 36;

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
  panelDeChat,
  onPestana,
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
  /** Tablet (FL10): el chat abierto, al lado de la lista. */
  panelDeChat?: ReactNode;
  /** La pestaña a la vista: con dos paneles decide si el chat del panel se está viendo. */
  onPestana?: (tab: Tab) => void;
}) {
  // En un ref: el listener del socket no se re-suscribe al abrir y cerrar chats.
  const chatAbiertoRef = useRef(chatAbierto);
  chatAbiertoRef.current = chatAbierto;
  const colores = useColores();
  const perfilPropio = usePerfilPropio(credential);
  const margenes = useMargenes();
  const [tab, setTab] = useState<Tab>('chats');
  /** Los contadores de Agenda y Encuestas en la barra (18/10). */
  const { pendientes, refrescar: refrescarPendientes } = usePendientesDeAgenda(credential.jwt);
  // Al cambiar de pestaña (se pudo votar o responder) y al volver de un chat.
  useEffect(() => {
    void refrescarPendientes();
  }, [tab, refrescarPendientes]);
  const enFoco = useIsFocused();
  useAlVolver(enFoco, () => void refrescarPendientes());
  const cuentasDeLaBarra = { agenda: pendientes.eventos, encuestas: pendientes.encuestas };
  useEffect(() => {
    if (pestanaPedida) setTab(pestanaPedida.tab);
  }, [pestanaPedida]);
  const [creating, setCreating] = useState<'poll' | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  // The company spaces (E1/E2): the Chats title switches between personal and each space.
  const espacios = useSpacesUi({ jwt: credential.jwt, myUserId: credential.userId, me: { name: perfilPropio.name?.trim() || 'Tú', phone: credential.phone }, personalUnread: chats.filter((chat) => chat.unread > 0).length, onOpenChat });
  const inSpace = Boolean(espacios.current);
  // Entering or leaving a space changes the bar: a tab the new one does not have goes back to Chats.
  useEffect(() => {
    setTab((current) => tabAfterModeChange(current, inSpace));
  }, [inSpace]);
  /** In a space, Directorio and Menciones open their screens over the list (design `e-07`); the bar stays on Chats. */
  const onTab = (next: Tab) => {
    if (next === 'directory') espacios.listProps.onWorkspace('directory');
    else if (next === 'mentions') espacios.listProps.onActivity('mentions');
    else setTab(next);
  };
  /** Mis grupos, para la agenda: un evento con la misma gente va al que ya existe (FL10). */
  const grupos = useMemo(
    () => chats.filter((chat) => chat.kind === 'group' && chat.memberIds.includes(credential.userId)).map((chat) => ({ id: chat.id, memberIds: chat.memberIds })),
    [chats, credential.userId]
  );
  /** La lista al día para el aviso, sin re-suscribir el socket en cada cambio. */
  const chatsRef = useRef<ChatSummary[]>([]);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);
  const [reloadKey, setReloadKey] = useState(0);
  // Encuestas vuelve a pedir al entrar otra vez (votos y encuestas de otros).
  useAlVolver(tab === 'encuestas', () => setReloadKey((key) => key + 1));
  const [visitadas, setVisitadas] = useState<ReadonlySet<Tab>>(() => new Set<Tab>(['chats']));
  useEffect(() => {
    setVisitadas((antes) => visitadasCon(antes, tab));
  }, [tab]);
  /** Una pestaña montada pero no activa se oculta sin desmontarse. */
  const panel = (cual: Tab) => ({ flex: 1, display: cual === tab ? ('flex' as const) : ('none' as const) });
  // Girado o en tablet (FL10): riel a la izquierda y el contenido centrado; en
  // tablet, la lista y el chat lado a lado.
  const { amplia, dosPaneles } = useDisposicion();
  const insets = useSafeAreaInsets();
  const centrado = amplia ? { width: '100%' as const, maxWidth: ANCHO_MAXIMO_DE_CONTENIDO, alignSelf: 'center' as const } : null;
  useEffect(() => {
    onPestana?.(tab);
  }, [tab, onPestana]);
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
      kind: 'text' | 'image' | 'video' | 'audio' | 'file' | 'poll' | 'event' | 'checklist' | 'sticker';
      body?: string;
      envelope?: unknown;
    }) => {
      // Lo mío no se avisa: acabo de escribirlo.
      if (mensaje.senderId === credential.userId) return;
      // Con un chat abierto avisa `App` (`sonarPorMensaje`): la lista ya no se
      // desmonta al abrir uno, y sin esto sonaba dos veces.
      if (chatAbiertoRef.current) return;
      // En el fondo (pantalla apagada, otra app) avisa el teléfono con el push
      // nativo, que ahora llega siempre (20/10): este aviso local lo duplicaba.
      if (AppState.currentState !== 'active') return;

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

    const onNew = (mensaje: Parameters<typeof alLlegar>[0]) => {
      // Una encuesta o un evento nuevos en algún chat: cambian los contadores.
      if (mensaje.kind === 'poll' || mensaje.kind === 'event') void refrescarPendientes();
      void alLlegar(mensaje);
    };
    socket.on('msg.new', onNew);
    return () => {
      // Con el handler: a secas borraba los listeners de App y de la lista.
      socket.off('msg.new', onNew);
    };
  }, [credential.jwt, credential.userId, loadChats, refrescarPendientes]);

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
    <View className="flex-1 bg-background" style={{ paddingLeft: insets.left, paddingRight: insets.right }}>
      <AppHeader tab={tab} chatsTitle={espacios.title}>
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
        {/* En Ajustes no va: llevaría a la pantalla donde ya estás. */}
        {tab === 'ajustes' ? null : (
          <Pressable
            testID="btn-perfil"
            accessibilityLabel="Tu perfil y ajustes"
            onPress={() => setTab('ajustes')}
            className="ml-1 h-11 w-11 items-center justify-center"
          >
            {/* Sin nombre va el ícono y no la inicial del teléfono: un «9» suelto
                no significa nada para nadie. */}
            <Avatar
              testID="saludo-usuario"
              nombre={perfilPropio.name?.trim() ?? ''}
              foto={perfilPropio.avatarUrl}
              tamano={AVATAR_PROPIO}
            />
          </Pressable>
        )}
      </AppHeader>

      {/* Las pestañas quedan MONTADAS después de la primera visita y solo se
          ocultan (`pestanas.ts`): remontarlas mostraba el esqueleto en cada
          cambio. Al crear algo, la lista vuelve a pedir por la prop `recarga`,
          sin remontarse ni volver al esqueleto. */}
      <View className={amplia ? 'flex-1 flex-row' : 'flex-1'}>
      {amplia ? <BottomNav vertical active={tab} onChange={onTab} cuentas={cuentasDeLaBarra} inSpace={inSpace} /> : null}
      <View className="flex-1">
        {visitadas.has('chats') ? (
          <View style={[panel('chats'), dosPaneles ? { flexDirection: 'row' } : centrado]}>
          <View style={dosPaneles ? { width: ANCHO_DE_LISTA } : { flex: 1 }} className={dosPaneles ? 'border-r border-outline/10' : undefined}>
          {/* La banda va arriba de la lista y SOLO en Chats: es la pantalla de
              entrada, y repetirla en las cuatro pestañas la convierte en ruido. */}
          {/* A voice note that keeps playing outside its chat (backlog 34). */}
          <NowPlayingBar openChatId={chatAbierto} onOpen={(chatId) => { const chat = chats.find((one) => one.id === chatId); if (chat) onOpenChat(chat); }} />
          <BandaDeActualizacion
            aviso={actualizaciones.aviso}
            estado={actualizaciones.estado}
            onActualizar={actualizaciones.requestUpdate}
            onAbrirTienda={actualizaciones.abrirTienda}
            onDescartar={actualizaciones.descartarAviso}
          />
          <ErrorBoundary pantalla="lista">
          {espacios.current ? (
            <SpaceChatsScreen key={espacios.current.id} space={espacios.current} jwt={credential.jwt} myUserId={credential.userId} active={tab === 'chats'} openChatId={chatAbierto} onOpenChat={onOpenChat} onChannels={espacios.openChannels} onInvite={espacios.openInvite} {...espacios.listProps} />
          ) : (
          <ChatListScreen
            credential={credential}
            chatAbierto={chatAbierto}
            onOpenChat={onOpenChat}
            onNewChat={() => setNewChat(true)}
          />
          )}
          </ErrorBoundary>
          </View>
          {dosPaneles ? <View className="flex-1">{tab === 'chats' && panelDeChat ? panelDeChat : <SinChatElegido />}</View> : null}
          </View>
        ) : null}
        {visitadas.has('encuestas') ? (
          <View style={[panel('encuestas'), centrado]}>
            <ErrorBoundary pantalla="encuestas">
              <PollsScreen recarga={reloadKey} credential={credential} onCreate={() => setCreating('poll')} onCambio={() => void refrescarPendientes()} />
            </ErrorBoundary>
          </View>
        ) : null}
        {visitadas.has('agenda') ? (
          <View style={[panel('agenda'), centrado]}>
            {/* Eventos y avisos en una sola pestaña: el botón de crear ofrece
                los dos tipos en vez de adivinar por el filtro activo. */}
            <ErrorBoundary pantalla="agenda">
              <AgendaScreen
                credential={credential}
                activa={tab === 'agenda'}
                grupos={grupos}
                onCambio={() => void refrescarPendientes()}
                chatNameOf={(chatId) => {
                  const chat = chatsRef.current.find((one) => one.id === chatId);
                  return (chat && nombreDeContacto({ delServidor: chat.name, telefono: chat.phone, agenda: agendaPorTelefono() })) || 'Conversación';
                }}
                onOpenTask={(chatId, seq) => void buscarChat(chatId, credential.jwt).then((chat) => chat && onOpenChat(chat, seq))}
              />
            </ErrorBoundary>
          </View>
        ) : null}
        {visitadas.has('ajustes') ? (
          <View style={[panel('ajustes'), centrado]}>
          <ErrorBoundary pantalla="ajustes">
          <PantallaDeAjustes
            credential={credential}
            visible={tab === 'ajustes'}
            esOperador={esOperador}
            segundoPlano={segundoPlano}
            onSegundoPlano={onSegundoPlano}
            actualizaciones={actualizaciones}
            onInvitar={() => setInvitando(true)}
            onRespaldoDelServidor={() => setShowBackup(true)}
            onLogout={onLogout}
            onAbrirDestacado={(chatId, seq) => void buscarChat(chatId, credential.jwt).then((chat) => chat && onOpenChat(chat, seq))}
            media={{ spaceId: espacios.current?.id ?? null, spaceName: espacios.current?.name, onOpen: (item) => void (espacios.current ? findSpaceChat(credential.jwt, espacios.current.id, item.chatId) : buscarChat(item.chatId, credential.jwt)).then((chat) => chat && onOpenChat(chat, item.seq)) }}
          />
          </ErrorBoundary>
          </View>
        ) : null}
      </View>
      </View>

      {amplia ? null : <BottomNav active={tab} onChange={onTab} cuentas={cuentasDeLaBarra} inSpace={inSpace} />}

      {/* El lápiz de la lista, que no hacía nada. */}
      {espacios.layer}
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
        onClose={() => setInvitando(false)}
      />

      {/* Under the minimum version nothing else can be used (backlog 32). */}
      <UpdateLockScreen
        visible={actualizaciones.aviso.tipo === 'obligatoria'}
        installed={versionActual()}
        latest={actualizaciones.aviso.tipo === 'ninguno' ? '' : actualizaciones.aviso.version}
        novedades={actualizaciones.novedades}
        size={actualizaciones.size}
        state={actualizaciones.estado}
        onUpdate={actualizaciones.actualizarDesdeBanda}
        onOpenStore={actualizaciones.abrirTienda}
      />

      <NovedadesDeLaVersion
        novedades={actualizaciones.novedades}
        visible={actualizaciones.viendoNovedades}
        onCerrar={actualizaciones.cerrarNovedades}
        onDescargar={actualizaciones.descargarDesdeNovedades}
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
