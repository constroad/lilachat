import { useCallback } from 'react';
import { DefaultTheme, NavigationContainer, type NavigationState, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { nombreDeContacto } from '@lilachat/shared';
import type { ChatSummary } from '../api/client';
import type { Credential } from '../auth/credentialStore';
import { ChatScreen } from '../chat/ChatScreen';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { iniciarCronometro } from '../diagnostico/diagnostico';
import { TabsShell } from './TabsShell';
import { useColores, useTema } from './tema';
import { chatAbiertoDe } from './rutas';

type RutasDeSesion = {
  Inicio: undefined;
  Chat: { chat: ChatSummary };
};

const Stack = createNativeStackNavigator<RutasDeSesion>();

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
  const alCambiar = useCallback(
    (estado: NavigationState | undefined) => onChatAbierto(chatAbiertoDe(estado)),
    [onChatAbierto]
  );

  // El fondo del contenedor es el de la app: sin esto la transición muestra el
  // blanco de React Navigation por un cuadro, y en modo oscuro se ve un flash.
  const tema: Theme = {
    ...DefaultTheme,
    dark: oscuro,
    colors: { ...DefaultTheme.colors, background: colores.background, card: colores.surface },
  };

  return (
    <NavigationContainer theme={tema} onStateChange={alCambiar}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colores.background },
        }}
      >
        <Stack.Screen name="Inicio">
          {({ navigation }) => (
            <TabsShell
              credential={props.credential}
              segundoPlano={props.segundoPlano}
              onSegundoPlano={props.onSegundoPlano}
              chatAbierto={props.chatAbierto}
              onOpenChat={(chat) => {
                iniciarCronometro('abrir-chat');
                navigation.navigate('Chat', { chat });
              }}
              onLogout={props.onLogout}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Chat">
          {({ route, navigation }) => (
            <PantallaDeChat
              chat={route.params.chat}
              credential={props.credential}
              onBack={() => navigation.goBack()}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function PantallaDeChat({ chat, credential, onBack }: { chat: ChatSummary; credential: Credential; onBack: () => void }) {
  return (
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
      othersDeliveredSeq={chat.othersDeliveredSeq}
      unread={chat.unread}
      lastSeqInicial={chat.lastSeq}
      encrypted={chat.encrypted}
      // El OTRO miembro: con quién se deriva la clave compartida.
      otherUserId={chat.memberIds.find((id) => id !== credential.userId) ?? null}
      onBack={onBack}
    />
  );
}
