import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Lock, MessageCircle, PenSquare, Search, X } from 'lucide-react-native';
import {
  contarChats,
  filtrarChats,
  formatChatTimestamp,
  nombreDeContacto,
  resolveChatPreview,
  textoDeAviso,
  type FiltroDeChats,
} from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { connectSocket } from './socketClient';
import { configureNotificationHandler, registerPushToken } from './pushRegistration';
import { listChats, type ChatSummary } from '../api/client';
import { conciliarCache } from './cacheDeChats';
import { guardarChats, leerChatsGuardados } from './chatsGuardados';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useColores } from '../ui/tema';
import { agendaPorTelefono, suscribirAgenda } from '../contacts/agendaEnMemoria';

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
  const colores = useColores();
  /**
   * La agenda se SUSCRIBE, no se lee una vez: la precarga termina despues de que
   * esta pantalla monto, y sin re-render la lista se quedaria con los numeros
   * pelados hasta que algo mas la refresque.
   */
  const agenda = useSyncExternalStore(suscribirAgenda, agendaPorTelefono, agendaPorTelefono);
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  /**
   * Lo guardado se pinta ANTES de preguntarle a la red: abrir la app y ver
   * esqueletos cada vez es la diferencia de fondo con WhatsApp, que es
   * local-first. La red confirma o corrige por detrás.
   */
  const chatsRef = useRef<ChatSummary[] | null>(null);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    void leerChatsGuardados().then((guardados) => {
      if (guardados && chatsRef.current === null) setChats(guardados);
    });
  }, []);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    const result = await listChats(credential.jwt);
    // El server MANDA: no se fusiona con la caché, porque un chat borrado desde
    // otro teléfono tiene que desaparecer de este.
    if (result.ok) {
      setChats(conciliarCache({ guardado: null, delServer: result.data.chats }));
      void guardarChats(result.data.chats);
    } else if (chatsRef.current === null) {
      // Sin red y sin caché: recién ahí se dice «no hay». Con caché se deja lo
      // que ya había, que es lo que hace que abrir sin señal siga sirviendo.
      setChats([]);
    }
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
    // Al RECONECTAR (volver de segundo plano) se recarga: mientras el socket
    // estuvo pausado llegaron mensajes por push que la lista no vio, y sin esto
    // el contador de no leídos queda viejo hasta un pull manual.
    socket.on('connect', () => void load());
    return () => {
      socket.off('presence.snapshot', onSnapshot);
      socket.off('presence', onPresence);
      socket.off('typing', onTyping);
      socket.off('msg.new');
      socket.off('connect');
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [credential.jwt, load]);

  /**
   * El nombre se resuelve contra TU agenda: quien no se puso nombre en Lilachat
   * llegaba acá como un número suelto (27/08/2026, chateando con Wilson).
   */
  const title = (chat: ChatSummary) =>
    nombreDeContacto({ delServidor: chat.name, telefono: chat.phone, agenda }) || 'Conversación';

  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroDeChats>('todos');

  /**
   * Lo que se muestra: la lista pasada por el chip y por el buscador.
   *
   * El título se resuelve ACÁ y se le pasa al motor: buscar «Wilson» tiene que
   * encontrarlo aunque el server solo conozca su número, que es el nombre que la
   * fila muestra. El motor no sabe de agendas.
   */
  const visibles = useMemo(() => {
    const lista = chats ?? [];
    return filtrarChats({
      chats: lista.map((chat) => ({
        chat,
        titulo: title(chat),
        ultimo: chat.lastMessage?.body,
        esGrupo: chat.kind === 'group',
        sinLeer: chat.unread,
      })),
      filtro,
      texto: busqueda,
    }).map((uno) => uno.chat);
    // `agenda` está en las dependencias porque `title` la usa: sin ella, la
    // lista se quedaría con los nombres viejos al llegar la agenda.
  }, [chats, agenda, filtro, busqueda]);

  const cuentas = useMemo(
    () =>
      contarChats(
        (chats ?? []).map((chat) => ({
          titulo: '',
          esGrupo: chat.kind === 'group',
          sinLeer: chat.unread,
        }))
      ),
    [chats]
  );

  const hayChats = (chats?.length ?? 0) > 0;



  return (
    <View className="flex-1 bg-background" testID="pantalla-chats">
      {/* Header del diseño: marca a la izquierda, avatar tocable a la derecha.
          El «Cerrar sesión» ya NO es un botón gigante al pie —eso no estaba en
          ningún diseño—: vive detrás del avatar, que es donde se lo busca. */}
      {/* Buscador y chips, como en WhatsApp. Solo cuando HAY chats: filtrar una
          lista vacía no lleva a ningún lado y ocupa la pantalla donde tiene que
          estar el vacío que explica qué hacer. */}
      {hayChats ? (
        <>
          <View className="px-4 pb-2 pt-1">
            <View className="flex-row items-center gap-2 rounded-full bg-primary/[0.07] px-4">
              <Search size={16} color={colores.outline} />
              <TextInput
                testID="buscar-chats"
                value={busqueda}
                onChangeText={setBusqueda}
                placeholder="Buscar"
                placeholderTextColor={colores['on-surface-variant']}
                className="min-h-[44px] min-w-0 flex-1 text-[15px] text-on-surface"
              />
              {busqueda ? (
                <Pressable
                  testID="btn-limpiar-busqueda"
                  accessibilityLabel="Limpiar la búsqueda"
                  onPress={() => setBusqueda('')}
                  className="h-11 w-8 items-center justify-center"
                >
                  <X size={16} color={colores['on-surface-variant']} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Los chips scrollean en horizontal: son tres y entran, pero el
              contador puede empujarlos en pantallas angostas y una fila de
              filtros partida en dos se ve rota. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            // Un ScrollView dentro de una columna CRECE hasta llenar lo que
            // sobra: sin esto la fila de chips se comía media pantalla y dejaba
            // dos huecos enormes alrededor.
            style={{ flexGrow: 0 }}
            // `alignItems: 'center'` NO es cosmético: sin él el ScrollView
            // estira a los hijos a TODA su altura y los chips salen como
            // píldoras gigantes. Visto en el emulador.
            contentContainerStyle={{
              paddingHorizontal: 16,
              gap: 8,
              paddingBottom: 8,
              alignItems: 'center',
            }}
          >
            {(
              [
                { id: 'todos', etiqueta: 'Todos', cuenta: 0 },
                { id: 'no-leidos', etiqueta: 'No leídos', cuenta: cuentas['no-leidos'] },
                { id: 'grupos', etiqueta: 'Grupos', cuenta: cuentas.grupos },
              ] as const
            ).map((chip) => {
              const activo = filtro === chip.id;
              return (
                <Pressable
                  key={chip.id}
                  testID={`filtro-${chip.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activo }}
                  onPress={() => setFiltro(chip.id)}
                  className={`min-h-[36px] flex-row items-center gap-1.5 rounded-full border px-4 ${
                    activo ? 'border-primary bg-primary/[0.14]' : 'border-outline/20'
                  }`}
                >
                  <Text
                    className={`text-[13px] ${activo ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}
                  >
                    {chip.etiqueta}
                  </Text>
                  {chip.cuenta > 0 ? (
                    <Text
                      className={`shrink-0 text-[11px] ${activo ? 'text-primary' : 'text-on-surface-variant'}`}
                    >
                      {chip.cuenta}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

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
            <MessageCircle size={28} color={colores.primary} />
          </View>
          <Text className="mt-4 text-lg font-semibold text-on-surface">Sin conversaciones</Text>
          <Text className="mt-1 text-center text-sm leading-5 text-on-surface-variant">
            Cuando alguien te escriba, la conversación aparece acá.
          </Text>
        </View>
      ) : (
        <FlashList
          data={visibles}
          keyExtractor={(chat) => chat.id}
          // El vacío del FILTRO no es el vacío de la app: decir «sin
          // conversaciones» cuando hay diez y el filtro no devuelve ninguna
          // haría pensar que se perdieron.
          ListEmptyComponent={
            <View className="items-center px-8 pt-16" testID="chats-sin-coincidencias">
              <Text className="text-center text-sm leading-5 text-on-surface-variant">
                {busqueda
                  ? `Ningún chat coincide con «${busqueda}».`
                  : filtro === 'no-leidos'
                    ? 'No te queda nada sin leer.'
                    : 'Todavía no tenés grupos.'}
              </Text>
            </View>
          }
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
                <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary/10">
                  {chat.avatarUrl ? (
                    <Image
                      source={{ uri: chat.avatarUrl }}
                      style={{ width: 48, height: 48 }}
                      contentFit="cover"
                    />
                  ) : (
                    <Text className="text-base font-bold text-primary">
                      {title(chat).slice(0, 1).toUpperCase()}
                    </Text>
                  )}
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
                  {chat.encrypted ? <Lock size={13} color={colores.primary} /> : null}
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
                          // El aviso de grupo se rearma con los nombres de TU
                          // agenda, igual que adentro de la conversación; si no
                          // se puede, queda el texto del server.
                          lastBody: avisoDelUltimo(chat, credential.userId) ?? chat.lastMessage?.body,
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
        <PenSquare size={22} color={colores["on-primary"]} />
      </Pressable>

    </View>
  );
}

/**
 * El texto del aviso de grupo para la vista previa, con los nombres de la
 * agenda. `null` si el último mensaje no es un aviso o si no alcanza para
 * armarlo — ahí manda el texto que compuso el server.
 */
function avisoDelUltimo(chat: ChatSummary, miUserId: string): string | null {
  const aviso = chat.lastMessage?.system;
  if (!aviso) return null;

  const agenda = agendaPorTelefono();
  const nombreDe = (persona?: { phone?: string; name?: string }) =>
    persona
      ? nombreDeContacto({
          delServidor: persona.name ?? null,
          telefono: persona.phone ?? null,
          agenda,
        })
      : '';

  return (
    textoDeAviso({
      quien: nombreDe(aviso.quien) || 'Alguien',
      esMio: chat.lastMessage?.senderId === miUserId,
      evento: aviso.evento,
      aQuien: nombreDe(aviso.aQuien) || undefined,
      valor: aviso.valor,
    }) || null
  );
}
