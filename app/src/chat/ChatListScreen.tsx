import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { Lock, MessageCircle, PenSquare } from 'lucide-react-native';
import { formatChatTimestamp, resolveChatPreview } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { connectSocket } from './socketClient';
import { configureNotificationHandler, registerPushToken } from './pushRegistration';
import { listChats, type ChatSummary } from '../api/client';
import { FlashList } from '@shopify/flash-list';

/**
 * La lista de chats (diseño Stitch «Lilachat: Chats»).
 *
 * Los TRES estados están, y muestran cosas distintas: cargando = skeleton con
 * la geometría real; con datos = la lista; vacío de verdad = icono +
 * explicación. Un hueco en blanco se lee como «no tengo nada» y es el bug que
 * ya se pagó en el drive público.
 */
export function ChatListScreen({
  credential,
  onOpenChat,
  onNewChat,
}: {
  credential: Credential;
  onOpenChat: (chat: ChatSummary) => void;
  onNewChat: () => void;
}) {
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    const result = await listChats(credential.jwt);
    if (result.ok) setChats(result.data.chats);
    else setChats([]);
  }, [credential.jwt]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Chats donde alguien está escribiendo. El server lo emite desde F2. */
  const [typingIn, setTypingIn] = useState<Set<string>>(new Set());
  /** Quién está en línea. Del socket: `presence.snapshot` al conectar y
   *  `presence` en cada cambio (F4). */
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  // El permiso de notificaciones se pide ACÁ, con la lista ya en pantalla —
  // no en el arranque: pedirlo antes de ver un mensaje se contesta que no, y
  // en Android ese diálogo no se puede volver a abrir desde la app.
  useEffect(() => {
    configureNotificationHandler();
    void registerPushToken(credential.jwt);
  }, [credential.jwt]);

  useEffect(() => {
    const socket = connectSocket(credential.jwt);
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const onTyping = (frame: { chatId: string; on: boolean }) => {
      setTypingIn((current) => {
        const next = new Set(current);
        if (frame.on) next.add(frame.chatId);
        else next.delete(frame.chatId);
        return next;
      });
      // Se apaga solo: si el otro cierra la app mientras escribe, el «on» nunca
      // se cancela y la fila queda diciendo «Escribiendo…» para siempre.
      clearTimeout(timers.get(frame.chatId));
      if (frame.on) {
        timers.set(
          frame.chatId,
          setTimeout(
            () =>
              setTypingIn((current) => {
                const next = new Set(current);
                next.delete(frame.chatId);
                return next;
              }),
            6000
          )
        );
      }
    };
    const onSnapshot = (frame: { online: string[] }) => setOnlineIds(new Set(frame.online));
    const onPresence = (frame: { userId: string; online: boolean }) =>
      setOnlineIds((current) => {
        const next = new Set(current);
        if (frame.online) next.add(frame.userId);
        else next.delete(frame.userId);
        return next;
      });

    socket.on('presence.snapshot', onSnapshot);
    socket.on('presence', onPresence);
    socket.on('typing', onTyping);
    // Un mensaje nuevo refresca la lista: sin esto la vista previa y el no
    // leído se quedan viejos hasta que alguien tire para refrescar.
    socket.on('msg.new', () => void load());
    return () => {
      socket.off('presence.snapshot', onSnapshot);
      socket.off('presence', onPresence);
      socket.off('typing', onTyping);
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [credential.jwt, load]);

  const title = (chat: ChatSummary) => chat.name ?? 'Conversación';



  return (
    <View className="flex-1 bg-background" testID="pantalla-chats">
      {/* Header del diseño: marca a la izquierda, avatar tocable a la derecha.
          El «Cerrar sesión» ya NO es un botón gigante al pie —eso no estaba en
          ningún diseño—: vive detrás del avatar, que es donde se lo busca. */}
      {chats === null ? (
        <View className="px-5 pt-4" testID="chats-cargando">
          {[0, 1, 2].map((index) => (
            <View key={index} className="mb-3 flex-row items-center gap-3">
              <View className="h-12 w-12 rounded-full bg-surface-variant" />
              <View className="flex-1">
                <View className="h-4 w-1/3 rounded bg-surface-variant" />
                <View className="mt-2 h-3 w-2/3 rounded bg-surface-variant" />
              </View>
            </View>
          ))}
        </View>
      ) : chats.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8" testID="chats-vacio">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <MessageCircle size={28} color="#6b38d4" />
          </View>
          <Text className="mt-4 text-lg font-semibold text-on-surface">Sin conversaciones</Text>
          <Text className="mt-1 text-center text-sm leading-5 text-on-surface-variant">
            Cuando alguien te escriba, la conversación aparece acá.
          </Text>
        </View>
      ) : (
        <FlashList
          data={chats}
          keyExtractor={(chat) => chat.id}
          // Virtualizada: un ScrollView monta TODAS las filas de una y la
          // lista tarda en aparecer en cuanto hay unas cuantas conversaciones.
          renderItem={({ item: chat }) => (
            <Pressable
              key={chat.id}
              testID={`chat-${chat.id}`}
              onPress={() => onOpenChat(chat)}
              className="min-h-[72px] flex-row items-center gap-3 border-b border-outline/5 px-5 py-3"
            >
              <View className="h-12 w-12 shrink-0">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Text className="text-base font-bold text-primary">
                    {title(chat).slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                {/* Punto de «en línea» como el diseño: abajo a la derecha del
                    avatar y con anillo del color del fondo, que es lo que lo
                    recorta en vez de dejarlo pegado. */}
                {chat.memberIds.some(
                  (id) => id !== credential.userId && onlineIds.has(id)
                ) ? (
                  <View
                    testID={`en-linea-${chat.id}`}
                    className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-emerald-500"
                  />
                ) : null}
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-2">
                  {/* Candado pegado al nombre: quién es y cómo se le habla se
                      leen de una sola mirada. */}
                  {chat.encrypted ? <Lock size={13} color="#6b38d4" /> : null}
                  <Text className="min-w-0 flex-1 text-base font-semibold text-on-surface" numberOfLines={1}>
                    {title(chat)}
                  </Text>
                  {/* Hora RELATIVA como el diseño (reloj hoy, «Ayer», el día,
                      la fecha), y en ACENTO cuando hay sin leer: en el diseño la
                      de Sofía —3 sin leer— es violeta y la de Carlos, gris. */}
                  {chat.lastMessage ? (
                    <Text
                      className={`shrink-0 text-[11px] ${
                        chat.unread > 0 ? 'font-semibold text-primary' : 'text-on-surface-variant'
                      }`}
                      testID={`hora-${chat.id}`}
                    >
                      {formatChatTimestamp(chat.lastMessage.at)}
                    </Text>
                  ) : null}
                </View>
                {/* El badge va en ESTA línea, junto al preview — no centrado en
                    la fila, que es donde lo había puesto la primera versión. */}
                <View className="mt-0.5 flex-row items-center gap-2">
                  {(() => {
                    // EN UN CHAT SECRETO LA LISTA NO MUESTRA EL ÚLTIMO MENSAJE.
                    //
                    // No es una decisión de estilo: el server manda el sobre, no
                    // el texto, así que acá no HAY nada que mostrar. Y aunque lo
                    // hubiera, la vista previa se ve en la pantalla bloqueada y
                    // en la notificación — el lugar donde menos sentido tiene
                    // filtrar lo que se acaba de cifrar.
                    const preview = chat.encrypted
                      ? { text: 'Mensaje cifrado', style: 'normal' as const }
                      : resolveChatPreview({
                          typing: typingIn.has(chat.id),
                          lastBody: chat.lastMessage?.body,
                          lastKind: chat.lastMessage?.kind,
                        });
                    return (
                      <Text
                        className={`min-w-0 flex-1 text-sm ${
                          preview.style === 'typing'
                            ? 'italic text-primary'
                            : 'text-on-surface-variant'
                        }`}
                        numberOfLines={1}
                        testID={`preview-${chat.id}`}
                      >
                        {preview.text}
                      </Text>
                    );
                  })()}
                  {chat.unread > 0 ? (
                    <View
                      className="h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-primary px-1.5"
                      testID={`no-leidos-${chat.id}`}
                    >
                      <Text className="text-[11px] font-bold text-on-primary">{chat.unread}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load().finally(() => setRefreshing(false));
              }}
            />
          }
        />
      )}

      {/* FAB de conversación nueva: está en el diseño y faltaba por completo. */}
      <Pressable
        testID="btn-nuevo-chat"
        onPress={onNewChat}
        className="absolute bottom-5 right-5 h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-lg"
      >
        <PenSquare size={22} color="#ffffff" />
      </Pressable>

    </View>
  );
}
