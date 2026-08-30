// PRIMERO: enchufa `crypto.getRandomValues` en Hermes, antes de que algo cifre.
import './src/crypto/polyfill';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/ui/ErrorBoundary';
import './global.css';
import { refreshSession } from './src/api/client';
import {
  clearCredential,
  loadCredential,
  saveCredential,
  type Credential,
} from './src/auth/credentialStore';
import { PhoneScreen } from './src/onboarding/PhoneScreen';
import { OtpScreen } from './src/onboarding/OtpScreen';
import { TabsShell } from './src/ui/TabsShell';
import { ChatScreen } from './src/chat/ChatScreen';
import { disconnectSocket } from './src/chat/socketClient';
import { olvidarChats } from './src/chat/chatsGuardados';
import { olvidarMensajes } from './src/chat/mensajesGuardados';
import { decidirServicio } from './src/chat/servicioDeConexion';
import { agendaPorTelefono, olvidarAgenda, precargarAgenda } from './src/contacts/agendaEnMemoria';
import { nombreDeContacto } from '@lilachat/shared';
import { ProveedorTema, useColores, useTema } from './src/ui/tema';
import {
  guardarSegundoPlano,
  leerSegundoPlano,
  SEGUNDO_PLANO_POR_DEFECTO,
} from './src/settings/preferencias';
import { detenerServicio, iniciarServicio } from './modules/servicio-socket/src';
import type { ChatSummary } from './src/api/client';

/**
 * Boot (F1): credencial guardada → refrescar sesión → adentro.
 *
 * La regla que ordena el arranque: **la ausencia de respuesta NO revoca**.
 * Solo un 401 REAL del server borra la credencial; un 503 o falta de red dejan
 * pasar con la sesión anterior — quedarse sin chat porque la red está mal es
 * exactamente lo que esta app existe para evitar.
 */
type Boot =
  | { phase: 'loading' }
  | { phase: 'email' }
  | { phase: 'otp'; phone: string }
  | { phase: 'home'; credential: Credential }
  | { phase: 'chat'; credential: Credential; chat: ChatSummary };

/**
 * La raíz: solo monta los proveedores.
 *
 * `Contenido` se separó al agregar el modo oscuro (27/08/2026) por una razón
 * mecánica — `useColores()` necesita el proveedor POR ENCIMA, y un componente no
 * puede consumir un contexto que él mismo monta. Sin el corte, el `StatusBar` y
 * el indicador de carga de esta pantalla se quedaban en claro para siempre.
 */
export default function App() {
  return (
    // El proveedor es lo que hace que `useSafeAreaInsets` devuelva algo distinto
    // de cero. Sin él, todas las pantallas creen que no hay barras y el botón
    // del pie termina debajo de la de Android.
    <SafeAreaProvider>
      <ProveedorTema>
        {/* Envuelve TODO: un error de render dejaba la pantalla en blanco sin
            explicación para nadie, ni siquiera para nosotros. */}
        <ErrorBoundary pantalla="app">
          <Contenido />
        </ErrorBoundary>
      </ProveedorTema>
    </SafeAreaProvider>
  );
}

function Contenido() {
  const { oscuro } = useTema();
  const colores = useColores();
  const [boot, setBoot] = useState<Boot>({ phase: 'loading' });

  /**
   * El servicio en primer plano que sostiene el socket.
   *
   * Con la app atrás, Android suspende el proceso y el socket se cae: los
   * mensajes entran recién al volver a abrir. WhatsApp lo evita con FCM, que es
   * un canal del sistema; sin Firebase, la única forma de que un socket propio
   * sobreviva es este servicio — y su precio es la notificación permanente que
   * Android exige a cambio.
   *
   * Se enciende con la sesión, no al pasar a segundo plano: esperar deja una
   * ventana en la transición —el momento más frágil— donde el proceso puede
   * morir antes de que el servicio arranque.
   */
  const haySesion = boot.phase === 'home' || boot.phase === 'chat';

  /**
   * `null` mientras se lee la preferencia del disco.
   *
   * Se espera a saberla antes de decidir: arrancar el servicio y apagarlo medio
   * segundo después publica la notificación permanente y la borra, y ese
   * parpadeo en la bandeja es justo lo que se está tratando de sacar.
   */
  const [segundoPlano, setSegundoPlano] = useState<boolean | null>(null);

  useEffect(() => {
    void leerSegundoPlano().then(setSegundoPlano);
  }, []);

  /**
   * La agenda se lee APENAS hay sesión, no al tocar el lápiz.
   *
   * Reclamo de José (27/08/2026): «al lápiz ya me debería aparecer precargado
   * los contactos y no recién allí ponerme a cargar». Leerlos acá es leerlos
   * mientras mira la lista de chats — un rato en el que no está esperando nada.
   */
  useEffect(() => {
    if (haySesion) void precargarAgenda();
  }, [haySesion]);

  useEffect(() => {
    if (segundoPlano === null) return;
    const decision = decidirServicio({
      haySesion,
      estado: AppState.currentState,
      enSegundoPlano: segundoPlano,
    });
    if (decision === 'encender') iniciarServicio();
    else detenerServicio();
  }, [haySesion, segundoPlano]);

  const start = useCallback(async () => {
    const stored = await loadCredential();
    if (!stored) {
      setBoot({ phase: 'email' });
      return;
    }
    const session = await refreshSession({
      deviceId: stored.deviceId,
      deviceSecret: stored.deviceSecret,
    });
    if (session.ok) {
      // El refresh también REPARA: una credencial guardada por una versión
      // vieja puede no tener `userId`, y sin él la pantalla no distingue los
      // mensajes propios de los ajenos — se veían todos como recibidos.
      const refreshed = {
        ...stored,
        jwt: session.data.jwt,
        ...(session.data.user
          ? { userId: session.data.user.id, name: session.data.user.name }
          : {}),
      };
      await saveCredential(refreshed);
      setBoot({ phase: 'home', credential: refreshed });
      return;
    }
    if (session.status === 401) {
      // Revocado de verdad: se vuelve al alta, sin llaves que no abren.
      // La caché de chats se borra con la credencial: la lista de con quién
      // habla alguien no se hereda al siguiente que entre en este teléfono.
      await Promise.all([clearCredential(), olvidarChats(), olvidarMensajes()]);
      setBoot({ phase: 'email' });
      return;
    }
    // 503 / sin red: se entra con lo que hay.
    setBoot({ phase: 'home', credential: stored });
  }, []);

  useEffect(() => {
    void start();
  }, [start]);

  return (
      <View className="flex-1 bg-background">
      {/* La hora y la batería: con fondo navy tienen que ser CLARAS o
          desaparecen contra la barra. Es lo único del chrome del sistema que no
          se resuelve con una clase de Tailwind. */}
      <StatusBar style={oscuro ? 'light' : 'dark'} />
      {boot.phase === 'loading' ? (
        <View className="flex-1 items-center justify-center" testID="pantalla-cargando">
          <ActivityIndicator color={colores.primary} size="large" />
        </View>
      ) : boot.phase === 'email' ? (
        <PhoneScreen onCodeRequested={(phone) => setBoot({ phase: 'otp', phone })} />
      ) : boot.phase === 'otp' ? (
        <OtpScreen
          phone={boot.phone}
          onBack={() => setBoot({ phase: 'email' })}
          onDone={(credential) => setBoot({ phase: 'home', credential })}
        />
      ) : boot.phase === 'home' ? (
        <TabsShell
          credential={boot.credential}
          // Mientras se lee la preferencia se asume el defecto: el interruptor
          // no puede mostrarse apagado un instante y saltar a encendido.
          segundoPlano={segundoPlano ?? SEGUNDO_PLANO_POR_DEFECTO}
          onSegundoPlano={(activo) => {
            setSegundoPlano(activo);
            void guardarSegundoPlano(activo);
          }}
          onOpenChat={(chat) => setBoot({ phase: 'chat', credential: boot.credential, chat })}
          onLogout={() => {
            // El socket se cierra ANTES de borrar la credencial: si no, queda
            // vivo con un JWT que ya no vale y reconecta en bucle.
            disconnectSocket();
            void olvidarChats();
            void olvidarMensajes();
            // La agenda también: otro teléfono, otra persona. Dejarla cargada
            // le mostraría a quien entre después los contactos del anterior.
            olvidarAgenda();
            void clearCredential().then(() => setBoot({ phase: 'email' }));
          }}
        />
      ) : (
        <ChatScreen
          chatId={boot.chat.id}
          // Mismo criterio que la lista: gana el nombre de TU agenda. Sin esto
          // la cabecera decia «960397018» aunque la lista ya dijera «Wilson».
          chatName={
            nombreDeContacto({
              delServidor: boot.chat.name,
              telefono: boot.chat.phone,
              agenda: agendaPorTelefono(),
            }) || 'Conversación'
          }
          chatAvatarUrl={boot.chat.avatarUrl}
          credential={boot.credential}
          othersReadSeq={boot.chat.othersReadSeq}
          othersDeliveredSeq={boot.chat.othersDeliveredSeq}
          unread={boot.chat.unread}
          encrypted={boot.chat.encrypted}
          // El OTRO miembro: con quién se deriva la clave compartida.
          otherUserId={
            boot.chat.memberIds.find((id) => id !== boot.credential.userId) ?? null
          }
          onBack={() => setBoot({ phase: 'home', credential: boot.credential })}
        />
      )}
      </View>
  );
}
