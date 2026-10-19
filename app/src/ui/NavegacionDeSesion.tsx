import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import { ProveedorDeLlamadas } from '../calls/ProveedorDeLlamadas';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { iniciarCronometro } from '../diagnostico/diagnostico';
import { TabsShell } from './TabsShell';
import { useColores, useTema } from './tema';
import { chatAbiertoDe, chatQueSeVe } from './rutas';
import { useAbrirDesdeAviso } from './useAbrirDesdeAviso';
import { ErrorBoundary } from './ErrorBoundary';
import { useDisposicion } from './useDisposicion';
import { ConMargenesLaterales, SinMargenArriba } from './PanelDeChat';
import type { Tab } from './BottomNav';

type RutasDeSesion = {
  Inicio: undefined;
  /** `irASeq`: viene de un resultado de la búsqueda general (FL9d). */
  Chat: { chat: ChatSummary; irASeq?: number };
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
  const [enPanel, setEnPanel] = useState<{ chat: ChatSummary; irASeq?: number } | null>(null);
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
    (chat: ChatSummary, irASeq?: number) => {
      enPanelRef.current = { chat, irASeq };
      setEnPanel({ chat, irASeq });
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
      abrirEnPanel(chat, irASeq);
    } else if (!dosPaneles && enPanelRef.current) {
      const { chat, irASeq } = enPanelRef.current;
      cerrarPanel();
      navegacion.navigate('Chat', { chat, irASeq });
    }
  }, [dosPaneles, abrirEnPanel, cerrarPanel]);
  // La pestaña que pide una notificación de la agenda; `n` la vuelve a pedir
  // aunque ya se hubiera pedido antes.
  const [pestanaPedida, setPestanaPedida] = useState<{ tab: 'agenda'; n: number } | null>(null);

  // Tocar una notificación (FL8): su chat encima de la lista, o la Agenda.
  useAbrirDesdeAviso({
    jwt: props.credential.jwt,
    abrirChat: (chat) => {
      if (!navegacion.isReady()) return;
      if (dosPaneles) {
        if (chatAbiertoDe(navegacion.getRootState())) navegacion.dispatch(StackActions.popToTop());
        return abrirEnPanel(chat);
      }
      if (chatAbiertoDe(navegacion.getRootState()) === chat.id) return;
      // Si había otro chat abierto, se reemplaza: atrás vuelve a la lista.
      if (chatAbiertoDe(navegacion.getRootState())) navegacion.dispatch(StackActions.replace('Chat', { chat }));
      else navegacion.navigate('Chat', { chat });
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
    <ProveedorDeLlamadas jwt={props.credential.jwt}>
    <NavigationContainer ref={navegacion} theme={tema} onStateChange={alCambiar}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
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
                    <PantallaDeChat key={enPanel.chat.id} chat={enPanel.chat} irASeq={enPanel.irASeq} credential={props.credential} onBack={cerrarPanel} />
                  </SinMargenArriba>
                ) : null
              }
              onOpenChat={(chat, irASeq) => {
                iniciarCronometro('abrir-chat');
                if (dosPaneles) abrirEnPanel(chat, irASeq);
                else navigation.navigate('Chat', { chat, irASeq });
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
                irASeq={route.params.irASeq}
                credential={props.credential}
                onBack={() => navigation.goBack()}
              />
            </ConMargenesLaterales>
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
    </ProveedorDeLlamadas>
  );
}

function PantallaDeChat({
  chat,
  irASeq,
  credential,
  onBack,
}: {
  chat: ChatSummary;
  irASeq?: number;
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
        nombreDeContacto({ delServidor: chat.name, telefono: chat.phone, agenda: agendaPorTelefono() }) ||
        'Conversación'
      }
      chatAvatarUrl={chat.avatarUrl}
      credential={credential}
      othersReadSeq={chat.othersReadSeq}
      acuseDe={chat.acuseDe}
      othersDeliveredSeq={chat.othersDeliveredSeq}
      unread={chat.unread}
      lastSeqInicial={chat.lastSeq}
      irASeq={irASeq}
      encrypted={chat.encrypted}
      // El OTRO miembro, SOLO en un 1:1: con él se deriva la clave y se llama.
      // En un grupo es null — antes iba «el primero», así la pantalla no se
      // enteraba de que era un grupo (sin nombres de autor) y el botón de
      // llamar llamaba a un miembro cualquiera.
      otherUserId={chat.kind === 'direct' ? (chat.memberIds.find((id) => id !== credential.userId) ?? null) : null}
      onBack={onBack}
    />
    </ErrorBoundary>
  );
}
