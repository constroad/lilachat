import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CommonActions,
  createNavigationContainerRef,
  DefaultTheme,
  NavigationContainer,
  StackActions,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { nombreDeContacto } from '@lilachat/shared';
import type { ChatSummary } from '../api/client';
import type { Credential } from '../auth/credentialStore';
import { ChatScreen } from '../chat/ChatScreen';
import { chatsEnMemoria } from '../chat/chatsGuardados';
import { ProveedorDeLlamadas } from '../calls/ProveedorDeLlamadas';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { iniciarCronometro } from '../diagnostico/diagnostico';
import { TabsShell } from './TabsShell';
import { FullScreenCallsPrompt } from './FullScreenCallsPrompt';
import { CallLinkOpener } from '../chat/scheduledCall/CallLinkOpener';
import { useColores, useTema } from './tema';
import { chatAbiertoDe, chatQueSeVe } from './rutas';
import { useAbrirDesdeAviso } from './useAbrirDesdeAviso';
import type { EntryPoint } from './destinoDeAviso';
import { ErrorBoundary } from './ErrorBoundary';
import { useDisposicion } from './useDisposicion';
import { ConMargenesLaterales, SinMargenArriba } from './PanelDeChat';
import type { Tab } from './BottomNav';
import { ReminderAlarmHost } from '../agenda/ReminderAlarmHost';
import { AppLockGate } from '../settings/AppLockGate';
import { WhatsNewHost } from '../settings/WhatsNewHost';
import { SilentUpdateHost } from '../updates/SilentUpdateHost';

/**
 * Where the person lands when the chat is opened from outside (general search FL9d, a notice, «Menciones y actividad»).
 * `requestedAt` changes with every tap on a notice: with the chat already open, it is what sends it to jump again.
 */
type ChatEntry = EntryPoint & { requestedAt?: number };

type RutasDeSesion = {
  Inicio: undefined;
  Chat: { chat: ChatSummary } & ChatEntry;
};

const Stack = createNativeStackNavigator<RutasDeSesion>();
const navegacion = createNavigationContainerRef<RutasDeSesion>();

/**
 * La sesión con navegación NATIVA (FL1, spec §45): un stack con la lista
 * («Inicio», con sus pestañas) y la conversación encima.
 *
 * Antes `App.tsx` intercambiaba árboles: abrir un chat DESMONTABA la lista y
 * volver la remontaba desde cero, sin scroll, sin búsqueda, sin filtro y sin
 * transición. Con el stack la lista queda viva debajo, la conversación entra
 * con la animación del sistema y atrás funciona como en cualquier app.
 */
export function NavegacionDeSesion(props: {
  credential: Credential;
  segundoPlano: boolean;
  onSegundoPlano: (activo: boolean) => void;
  onLogout: () => void;
  chatAbierto: string | null;
  onChatAbierto: (chatId: string | null) => void;
}) {
  const colores = useColores();
  const { oscuro } = useTema();
  const { onChatAbierto } = props;
  // En tablet (FL10) el chat se abre en un panel al lado de la lista, no en el stack.
  const { dosPaneles } = useDisposicion();
  const [enPanel, setEnPanel] = useState<({ chat: ChatSummary } & ChatEntry) | null>(null);
  const pestana = useRef<Tab>('chats');
  const enPanelRef = useRef(enPanel);
  enPanelRef.current = enPanel;
  const avisarAbierto = useCallback(
    () =>
      onChatAbierto(
        chatQueSeVe({
          deLaPila: navegacion.isReady() ? chatAbiertoDe(navegacion.getRootState()) : null,
          enPanel: enPanelRef.current?.chat.id ?? null,
          pestana: pestana.current,
        })
      ),
    [onChatAbierto]
  );
  const alCambiar = useCallback(() => avisarAbierto(), [avisarAbierto]);
  const abrirEnPanel = useCallback(
    (chat: ChatSummary, entry: ChatEntry = {}) => {
      enPanelRef.current = { chat, ...entry };
      setEnPanel({ chat, ...entry });
      avisarAbierto();
    },
    [avisarAbierto]
  );
  const cerrarPanel = useCallback(() => {
    enPanelRef.current = null;
    setEnPanel(null);
    avisarAbierto();
  }, [avisarAbierto]);
  const alCambiarPestana = useCallback(
    (tab: Tab) => {
      pestana.current = tab;
      avisarAbierto();
    },
    [avisarAbierto]
  );

  // Al girar una tablet chica, el chat pasa del stack al panel y al revés.
  useEffect(() => {
    if (!navegacion.isReady()) return;
    const ruta = navegacion.getCurrentRoute();
    if (dosPaneles && ruta?.name === 'Chat' && ruta.params) {
      const { chat, irASeq } = ruta.params as RutasDeSesion['Chat'];
      navegacion.dispatch(StackActions.popToTop());
      abrirEnPanel(chat, { irASeq });
    } else if (!dosPaneles && enPanelRef.current) {
      const { chat, irASeq } = enPanelRef.current;
      cerrarPanel();
      navegacion.navigate('Chat', { chat, irASeq });
    }
  }, [dosPaneles, abrirEnPanel, cerrarPanel]);
  // «Enviar mensaje» during a call (pending 106): its chat, while the call goes on minimized.
  const openCallChat = useCallback(
    (chatId: string) => {
      const chat = chatsEnMemoria()?.find((one) => one.id === chatId);
      if (!chat) return;
      if (dosPaneles) abrirEnPanel(chat, {});
      else if (navegacion.isReady()) navegacion.navigate('Chat', { chat });
    },
    [dosPaneles, abrirEnPanel]
  );
  // La pestaña que pide una notificación de la agenda; `n` la vuelve a pedir
  // aunque ya se hubiera pedido antes.
  const [pestanaPedida, setPestanaPedida] = useState<{ tab: 'agenda'; n: number } | null>(null);

  // Tocar una notificación (FL8): su chat encima de la lista, o la Agenda.
  useAbrirDesdeAviso({
    jwt: props.credential.jwt,
    abrirChat: (chat, entry) => {
      if (!navegacion.isReady()) return false;
      const target: ChatEntry | undefined = entry && { ...entry, requestedAt: Date.now() };
      if (dosPaneles) {
        if (chatAbiertoDe(navegacion.getRootState())) navegacion.dispatch(StackActions.popToTop());
        abrirEnPanel(chat, target);
        return true;
      }
      const openChatId = chatAbiertoDe(navegacion.getRootState());
      if (openChatId === chat.id) {
        // Already on screen: the message or thread of the tap is asked of it, not ignored.
        if (target) navegacion.dispatch(CommonActions.setParams(target));
        return true;
      }
      // Si había otro chat abierto, se reemplaza: atrás vuelve a la lista.
      if (openChatId) navegacion.dispatch(StackActions.replace('Chat', { chat, ...target }));
      else navegacion.navigate('Chat', { chat, ...target });
      return true;
    },
    abrirAgenda: () => {
      if (navegacion.isReady() && chatAbiertoDe(navegacion.getRootState())) navegacion.dispatch(StackActions.popToTop());
      setPestanaPedida((antes) => ({ tab: 'agenda', n: (antes?.n ?? 0) + 1 }));
    },
  });

  // El fondo del contenedor es el de la app: sin esto la transición muestra el
  // blanco de React Navigation por un cuadro, y en modo oscuro se ve un flash.
  const tema: Theme = {
    ...DefaultTheme,
    dark: oscuro,
    colors: { ...DefaultTheme.colors, background: colores.background, card: colores.surface },
  };

  return (
    // Las llamadas envuelven toda la sesión: suenan en cualquier pantalla (FL8).
    <ProveedorDeLlamadas jwt={props.credential.jwt} me={props.credential.userId} onOpenChat={openCallChat}>
    {/* Pending 63: a reminder that rang full screen, over any screen. */}
    <ReminderAlarmHost jwt={props.credential.jwt} />
    <WhatsNewHost />
    <SilentUpdateHost />
    <NavigationContainer ref={navegacion} theme={tema} onStateChange={alCambiar}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          // 200 ms con la de atrás en parallax, como WhatsApp (20/10): `slide_from_right` dura 400 en Android y se sentía lenta.
          animation: 'ios_from_right',
          contentStyle: { backgroundColor: colores.background },
        }}
      >
        {/* Congelada mientras hay un chat encima (FL12, §49 #12): la lista
            seguía redibujándose con cada «escribiendo», presencia y mensaje,
            peleando con la conversación por el hilo JS. Al volver se pone al día. */}
        <Stack.Screen name="Inicio" options={{ freezeOnBlur: true }}>
          {({ navigation }) => (
            <TabsShell
              credential={props.credential}
              segundoPlano={props.segundoPlano}
              onSegundoPlano={props.onSegundoPlano}
              chatAbierto={props.chatAbierto}
              pestanaPedida={pestanaPedida}
              onPestana={alCambiarPestana}
              panelDeChat={
                dosPaneles && enPanel ? (
                  <SinMargenArriba>
                    <PantallaDeChat key={enPanel.chat.id} chat={enPanel.chat} entry={enPanel} credential={props.credential} onBack={cerrarPanel} />
                  </SinMargenArriba>
                ) : null
              }
              onOpenChat={(chat, irASeq, openThread) => {
                iniciarCronometro('abrir-chat');
                if (dosPaneles) abrirEnPanel(chat, { irASeq, openThread });
                else navigation.navigate('Chat', { chat, irASeq, openThread });
              }}
              onLogout={props.onLogout}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Chat">
          {({ route, navigation }) => (
            <ConMargenesLaterales>
              <PantallaDeChat
                chat={route.params.chat}
                entry={route.params}
                credential={props.credential}
                onBack={() => navigation.goBack()}
              />
            </ConMargenesLaterales>
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
    {/* Pending 9: the app lock covers the chats; the call screens above stay reachable. */}
    <AppLockGate />
    <FullScreenCallsPrompt />
    <CallLinkOpener jwt={props.credential.jwt} />
    </ProveedorDeLlamadas>
  );
}

function PantallaDeChat({
  chat,
  entry,
  credential,
  onBack,
}: {
  chat: ChatSummary;
  entry: ChatEntry;
  credential: Credential;
  onBack: () => void;
}) {
  // Su propia red (FL10): un chat roto no se lleva puesta la app, y se vuelve a la lista.
  return (
    <ErrorBoundary pantalla="chat" onVolver={onBack}>
    <ChatScreen
      chatId={chat.id}
      // Mismo criterio que la lista: gana el nombre de TU agenda. Sin esto la
      // cabecera decía «960397018» aunque la lista ya dijera «Wilson».
      chatName={
        // A channel of a space reads «# obra-miraflores», like Slack (design `s-01`).
        chat.channel && chat.name ? `# ${chat.name}` :
        nombreDeContacto({ delServidor: chat.name, telefono: chat.phone, agenda: agendaPorTelefono() }) ||
        'Conversación'
      }
      // El chat contigo («Tú», 20/10) lleva tu foto, como WhatsApp.
      chatAvatarUrl={chat.propio ? (credential.avatarUrl ?? undefined) : chat.avatarUrl}
      credential={credential}
      othersReadSeq={chat.othersReadSeq}
      acuseDe={chat.acuseDe}
      othersDeliveredSeq={chat.othersDeliveredSeq}
      unread={chat.unread}
      readSeq={chat.readSeq}
      lastSeqInicial={chat.lastSeq}
      irASeq={entry.irASeq}
      openThread={entry.openThread}
      highlightReply={entry.highlightReply}
      requestedAt={entry.requestedAt}
      encrypted={chat.encrypted}
      // El OTRO miembro, SOLO en un 1:1: con él se deriva la clave y se llama.
      // En un grupo es null — antes iba «el primero», así la pantalla no se
      // enteraba de que era un grupo (sin nombres de autor) y el botón de
      // llamar llamaba a un miembro cualquiera.
      otherUserId={chat.kind === 'direct' ? (chat.memberIds.find((id) => id !== credential.userId) ?? null) : null}
      esBorrador={chat.kind === 'notas'}
      workspaceId={chat.workspaceId} appId={chat.appId}
      onBack={onBack}
    />
    </ErrorBoundary>
  );
}
