import { useCallback, useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, Camera, ChevronRight, CloudUpload, RefreshCw, Search, UserPlus } from 'lucide-react-native';
import type { Credential } from '../auth/credentialStore';
import { listChats, type ChatSummary } from '../api/client';
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
  const margenes = useMargenes();
  const [tab, setTab] = useState<Tab>('chats');
  const [creating, setCreating] = useState<'event' | 'reminder' | 'poll' | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [showBackup, setShowBackup] = useState(false);
  const [invitando, setInvitando] = useState(false);
  const [chequeo, setChequeo] = useState<ResultadoDelChequeo | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [enlaceApp, setEnlaceApp] = useState('');

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
              Datos
            </Text>
            <Pressable
              testID="btn-respaldo"
              onPress={() => setShowBackup(true)}
              className="min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <CloudUpload size={18} color="#6b38d4" />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-semibold text-on-surface">Copia de seguridad</Text>
                <Text className="text-[11px] text-on-surface-variant">
                  Tus chats, respaldados cada noche
                </Text>
              </View>
              <ChevronRight size={18} color="#7b7486" />
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
                <UserPlus size={18} color="#6b38d4" />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-semibold text-on-surface">Invitar a alguien</Text>
                <Text className="text-[11px] text-on-surface-variant">
                  Desde tus contactos, con el enlace de descarga
                </Text>
              </View>
              <ChevronRight size={18} color="#7b7486" />
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
                <RefreshCw size={18} color="#6b38d4" />
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
              <ChevronRight size={18} color="#7b7486" />
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
              <ArrowLeft size={22} color="#0b1c30" />
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
