// PRIMERO: enchufa `crypto.getRandomValues` en Hermes, antes de que algo cifre.
import './src/crypto/polyfill';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
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

export default function App() {
  const [boot, setBoot] = useState<Boot>({ phase: 'loading' });

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
      await Promise.all([clearCredential(), olvidarChats()]);
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
    // El proveedor es lo que hace que `useSafeAreaInsets` devuelva algo distinto
    // de cero. Sin él, todas las pantallas creen que no hay barras y el botón
    // del pie termina debajo de la de Android.
    <SafeAreaProvider>
      {/* Envuelve TODO: un error de render dejaba la pantalla en blanco sin
          explicación para nadie, ni siquiera para nosotros. */}
      <ErrorBoundary pantalla="app">
      <View className="flex-1 bg-background">
      <StatusBar style="dark" />
      {boot.phase === 'loading' ? (
        <View className="flex-1 items-center justify-center" testID="pantalla-cargando">
          <ActivityIndicator color="#6b38d4" size="large" />
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
          onOpenChat={(chat) => setBoot({ phase: 'chat', credential: boot.credential, chat })}
          onLogout={() => {
            // El socket se cierra ANTES de borrar la credencial: si no, queda
            // vivo con un JWT que ya no vale y reconecta en bucle.
            disconnectSocket();
            void olvidarChats();
            void clearCredential().then(() => setBoot({ phase: 'email' }));
          }}
        />
      ) : (
        <ChatScreen
          chatId={boot.chat.id}
          chatName={boot.chat.name ?? 'Conversación'}
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
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
