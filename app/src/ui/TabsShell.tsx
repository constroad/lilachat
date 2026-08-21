import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Camera, Search } from 'lucide-react-native';
import type { Credential } from '../auth/credentialStore';
import { listChats, type ChatSummary } from '../api/client';
import { ChatListScreen } from '../chat/ChatListScreen';
import { CreateSheet } from '../agenda/CreateSheet';
import { EventsScreen } from '../agenda/EventsScreen';
import { PollsScreen } from '../agenda/PollsScreen';
import { RemindersScreen } from '../agenda/RemindersScreen';
import { AppHeader, BottomNav, type Tab } from './BottomNav';

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
}: {
  credential: Credential;
  onOpenChat: (chat: ChatSummary) => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<Tab>('chats');
  const [creating, setCreating] = useState<'event' | 'reminder' | 'poll' | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  // Los chats se cargan acá porque los necesitan TRES pantallas: la lista, y
  // los formularios de evento y encuesta —que preguntan en qué conversación—.
  const loadChats = useCallback(async () => {
    const result = await listChats(credential.jwt);
    if (result.ok) setChats(result.data.chats);
  }, [credential.jwt]);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  return (
    <View className="flex-1 bg-background">
      <AppHeader>
        {tab === 'chats' ? (
          <>
            {/* Cámara y búsqueda están en el diseño; quedan inertes hasta que
                existan (la búsqueda es F6). */}
            <View className="h-11 w-9 items-center justify-center opacity-40">
              <Camera size={20} color="#494454" />
            </View>
            <View className="h-11 w-9 items-center justify-center opacity-40">
              <Search size={20} color="#494454" />
            </View>
          </>
        ) : null}
        <Pressable
          testID="btn-perfil"
          onPress={onLogout}
          className="ml-1 h-9 w-9 items-center justify-center rounded-full bg-primary/10"
        >
          <Text className="text-sm font-bold text-primary" testID="saludo-usuario">
            {(credential.name ?? credential.phone).slice(0, 1).toUpperCase()}
          </Text>
        </Pressable>
      </AppHeader>

      <View className="flex-1" key={`${tab}-${reloadKey}`}>
        {tab === 'chats' ? (
          <ChatListScreen
            credential={credential}
            onOpenChat={onOpenChat}
            onNewChat={() => undefined}
            onLogout={onLogout}
          />
        ) : tab === 'encuestas' ? (
          <PollsScreen credential={credential} onCreate={() => setCreating('poll')} />
        ) : tab === 'eventos' ? (
          <EventsScreen credential={credential} onCreate={() => setCreating('event')} />
        ) : tab === 'avisos' ? (
          <RemindersScreen credential={credential} onCreate={() => setCreating('reminder')} />
        ) : (
          <View className="flex-1 items-center justify-center px-8" testID="pantalla-ajustes">
            <Text className="text-lg font-semibold text-on-surface">
              {credential.name ?? credential.phone}
            </Text>
            <Text className="mt-1 text-sm text-on-surface-variant">{credential.phone}</Text>
            <Pressable
              testID="btn-salir"
              onPress={onLogout}
              className="mt-6 min-h-[44px] items-center justify-center rounded-lg bg-surface-variant px-6"
            >
              <Text className="text-sm font-semibold text-on-surface">Cerrar sesión</Text>
            </Pressable>
          </View>
        )}
      </View>

      <BottomNav active={tab} onChange={setTab} />

      {creating ? (
        <CreateSheet
          kind={creating}
          visible
          credential={credential}
          chats={chats}
          onClose={() => setCreating(null)}
          // Re-montar la pestaña es lo que la hace recargar: sin esto, lo recién
          // creado no aparece hasta tirar para refrescar.
          onCreated={() => setReloadKey((key) => key + 1)}
        />
      ) : null}
    </View>
  );
}
