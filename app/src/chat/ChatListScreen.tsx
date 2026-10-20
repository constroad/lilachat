import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BackHandler, Pressable, RefreshControl, Text, View } from 'react-native';
import { MessageCircle, PenSquare } from 'lucide-react-native';
import {
  accionesDeSeleccion,
  contarChats,
  filtrarChats,
  nombreDeContacto,
  ordenarChats,
  separarArchivados,
  busquedaValida,
  type FiltroDeChats,
} from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { connectSocket } from './socketClient';
import { configureNotificationHandler, registerPushToken } from './pushRegistration';
import {
  buscarMensajes,
  listChats,
  type ChatSummary,
  type ResultadoBusqueda,
} from '../api/client';
import { conciliarCache } from './cacheDeChats';
import { chatsEnMemoria, guardarChats, leerChatsGuardados } from './chatsGuardados';
import { aplicarAcuseALista, aplicarBorradoALista, aplicarEdicionALista, aplicarMensajeALista, debeRecargarAlConectar, marcarLeido, puntoEnLinea, type AcuseEnVivo, type CambioDeMensaje, type CursoresEnVivo, type MensajeEnVivo } from '@lilachat/shared';
import { inicioDelProceso, medirUnaVez } from '../diagnostico/diagnostico';
import { FlashList } from '@shopify/flash-list';
import { useBorradores } from './borradores';
import { FilaDeChat } from './FilaDeChat';
import { useAccionesDeSeleccion } from './useAccionesDeSeleccion';
import { CabeceraDeArchivados, FilaDeArchivados } from './Archivados';
import { BuscadorDeChats } from './BuscadorDeChats';
import { ResultadosDeMensajes } from './ResultadosDeMensajes';
import { BarraDeSeleccionDeChats } from './BarraDeSeleccionDeChats';
import { useColores } from '../ui/tema';
import { decidirAtras } from '../ui/botonAtras';
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
  chatAbierto = null,
}: {
  credential: Credential;
  /** `irASeq`: abrir en ese mensaje (un resultado de la búsqueda, FL9d). */
  onOpenChat: (chat: ChatSummary, irASeq?: number) => void;
  onNewChat: () => void;
  /** El chat abierto encima (FL1): sus mensajes se leen al llegar. */
  chatAbierto?: string | null;
}) {
  const colores = useColores();
  /** Lo escrito y no mandado en cada chat (FL9): «Borrador: …» en la fila. */
  const borradores = useBorradores();
  /**
   * La agenda se SUSCRIBE, no se lee una vez: la precarga termina despues de que
   * esta pantalla monto, y sin re-render la lista se quedaria con los numeros
   * pelados hasta que algo mas la refresque.
   */
  const agenda = useSyncExternalStore(suscribirAgenda, agendaPorTelefono, agendaPorTelefono);
  // Desde la memoria del proceso si ya se leyó: sin esqueleto al remontar.
  const [chats, setChats] = useState<ChatSummary[] | null>(() => chatsEnMemoria());
  /**
   * Lo guardado se pinta ANTES de preguntarle a la red: abrir la app y ver
   * esqueletos cada vez es la diferencia de fondo con WhatsApp, que es
   * local-first. La red confirma o corrige por detrás.
   */
  const chatsRef = useRef<ChatSummary[] | null>(chats);

  /** Lo que cada miembro acusó en vivo (`aplicarAcuseALista`). */
  const cursoresEnVivo = useRef<CursoresEnVivo>(new Map());
  // En un ref: el listener del socket lo lee sin re-suscribirse.
  const chatAbiertoRef = useRef(chatAbierto);
  chatAbiertoRef.current = chatAbierto;

  /**
   * Abrir un chat lo deja leído en la lista. Antes la lista se remontaba al
   * volver y traía el contador del server; ahora queda viva debajo (FL1).
   */
  useEffect(() => {
    if (!chatAbierto) return;
    setChats((actuales) => (actuales ? marcarLeido(actuales, chatAbierto) : actuales));
  }, [chatAbierto]);

  useEffect(() => {
    chatsRef.current = chats;
    // Línea base de FL0 (spec §45): del arranque del proceso a la lista con chats.
    if (chats && chats.length > 0) medirUnaVez('arranque-a-lista', inicioDelProceso, { chats: chats.length });
  }, [chats]);

  useEffect(() => {
    void leerChatsGuardados().then((guardados) => {
      if (guardados && chatsRef.current === null) setChats(guardados);
    });
  }, []);
  const [refreshing, setRefreshing] = useState(false);
  // Por refs (FL4): renovar el token no es motivo para volver a pedir la lista,
  // y saber cuándo se cargó evita repetirla al conectar el socket.
  const jwtRef = useRef(credential.jwt);
  jwtRef.current = credential.jwt;
  const ultimaCarga = useRef<number | null>(null);
  const load = useCallback(async () => {
    const result = await listChats(jwtRef.current);
    // El server MANDA: no se fusiona con la caché, porque un chat borrado desde
    // otro teléfono tiene que desaparecer de este.
    if (result.ok) {
      ultimaCarga.current = Date.now();
      // El chat que está abierto encima queda leído (auditoría 19/10): al volver
      // de la galería la lista se recarga ANTES de que llegue mi acuse, y el
      // server todavía contaba como sin leer lo que estoy mirando.
      const delServer = conciliarCache({ guardado: null, delServer: result.data.chats });
      const abierto = chatAbiertoRef.current;
      const visibles = abierto && delServer ? marcarLeido(delServer, abierto) : delServer;
      chatsRef.current = visibles;
      setChats(visibles);
      void guardarChats(result.data.chats);
    } else if (chatsRef.current === null) {
      // Sin red y sin caché: recién ahí se dice «no hay». Con caché se deja lo
      // que ya había, que es lo que hace que abrir sin señal siga sirviendo.
      setChats([]);
    }
  }, []);

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
    // Un mensaje nuevo cambia SU fila, sin ir al server (`listaEnVivo.ts`).
    // Recargar la lista entera por cada mensaje eran cuatro viajes a la base.
    // Solo un chat que la lista no conoce (una conversación nueva) la recarga.
    const onNew = (mensaje: MensajeEnVivo) => {
      const actual = chatsRef.current;
      const parchada = actual
        ? aplicarMensajeALista(actual, mensaje, credential.userId, chatAbiertoRef.current)
        : null;
      if (!parchada) {
        void load();
        return;
      }
      if (parchada === actual) return;
      // Ya, no en el efecto: dos avisos seguidos leían la lista de antes y el segundo pisaba al primero.
      chatsRef.current = parchada;
      setChats(parchada);
      void guardarChats(parchada);
    };
    // Al RECONECTAR (volver de segundo plano) se recarga: mientras el socket
    // estuvo pausado llegaron mensajes por push que la lista no vio, y sin esto
    // el contador de no leídos queda viejo hasta un pull manual.
    const onConnect = () => {
      if (debeRecargarAlConectar({ ultimaCarga: ultimaCarga.current, ahora: Date.now() })) void load();
    };
    // Un chat cambió (nombre, foto, miembros; o me sacaron, FL9d): la fila
    // sale del server. Son eventos raros: un pedido cada uno.
    const onCambio = () => void load();
    // Checks, ediciones y borrados, en vivo en la fila (auditoría 19/10): sin
    // esto la lista —y el chat, al volver a abrirlo— se quedaban con lo viejo.
    const aplicarALista = (cambiar: (chats: ChatSummary[]) => ChatSummary[]) => {
      const actual = chatsRef.current;
      const parchada = actual ? cambiar(actual) : actual;
      if (!parchada || parchada === actual) return;
      chatsRef.current = parchada;
      setChats(parchada);
      void guardarChats(parchada);
    };
    const onAcuse = (acuse: AcuseEnVivo) => aplicarALista((chats) => aplicarAcuseALista(chats, acuse, credential.userId, cursoresEnVivo.current));
    const onEditado = (cambio: CambioDeMensaje) => aplicarALista((chats) => aplicarEdicionALista(chats, cambio));
    const onBorrado = (cambio: CambioDeMensaje) => aplicarALista((chats) => aplicarBorradoALista(chats, cambio, new Date().toISOString()));
    socket.on('msg.new', onNew);
    socket.on('receipt', onAcuse);
    socket.on('msg.edited', onEditado);
    socket.on('msg.deleted', onBorrado);
    socket.on('connect', onConnect);
    socket.on('chat.changed', onCambio);
    return () => {
      socket.off('presence.snapshot', onSnapshot);
      socket.off('presence', onPresence);
      socket.off('typing', onTyping);
      // Con el handler SIEMPRE: `off('msg.new')` a secas borraba también los
      // listeners de App y TabsShell (guardar mensajes, sonar) al cambiar de
      // pestaña.
      socket.off('msg.new', onNew);
      socket.off('receipt', onAcuse);
      socket.off('msg.edited', onEditado);
      socket.off('msg.deleted', onBorrado);
      socket.off('connect', onConnect);
      socket.off('chat.changed', onCambio);
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [credential.jwt, credential.userId, load]);

  /**
   * El nombre se resuelve contra TU agenda: quien no se puso nombre en Lilachat
   * llegaba acá como un número suelto (27/08/2026, chateando con Wilson).
   */
  const title = (chat: ChatSummary) =>
    nombreDeContacto({ delServidor: chat.name, telefono: chat.phone, agenda }) || 'Conversación';

  const [busqueda, setBusqueda] = useState('');
  // FL9: con una búsqueda escrita, atrás la limpia en vez de cerrar la app. Se
  // registra en cada cambio para quedar ÚLTIMO, que es el que Android llama primero.
  const [filtro, setFiltro] = useState<FiltroDeChats>('todos');
  /** Mirando «Archivados» (FL9) en vez de la lista principal. */
  const [verArchivados, setVerArchivados] = useState(false);

  /**
   * Búsqueda DENTRO de las conversaciones (aparte del filtro de la lista). Se
   * consulta al server con un debounce: pegarle en cada tecla sería un pedido
   * por letra. Lo cifrado no aparece (el server no tiene el texto).
   */
  const [resultadosMensajes, setResultadosMensajes] = useState<ResultadoBusqueda[]>([]);
  useEffect(() => {
    const consulta = busqueda.trim();
    if (!busquedaValida(consulta)) {
      setResultadosMensajes([]);
      return;
    }
    const id = setTimeout(async () => {
      const respuesta = await buscarMensajes(credential.jwt, consulta);
      // Solo se pisan los resultados si la consulta sigue siendo la misma: una
      // respuesta lenta de una búsqueda vieja no debe tapar la nueva.
      if (respuesta.ok) setResultadosMensajes(respuesta.data.resultados);
    }, 300);
    return () => clearTimeout(id);
  }, [busqueda, credential.jwt]);

  /**
   * Lo que se muestra: la lista pasada por el chip y por el buscador.
   *
   * El título se resuelve ACÁ y se le pasa al motor: buscar «Wilson» tiene que
   * encontrarlo aunque el server solo conozca su número, que es el nombre que la
   * fila muestra. El motor no sabe de agendas.
   */
  // Principal y «Archivados» (FL9). Buscar mira en los dos, como WhatsApp:
  // un chat archivado no tiene que ser imposible de encontrar.
  const { principales, archivados } = useMemo(
    () =>
      separarArchivados(
        (chats ?? []).map((chat) => ({
          chat,
          titulo: '',
          esGrupo: chat.kind === 'group',
          esBorrador: chat.kind === 'notas',
          sinLeer: chat.unread,
          marcadoNoLeido: chat.markedUnread === true,
          archivado: chat.archived === true,
        }))
      ),
    [chats]
  );

  const visibles = useMemo(() => {
    const base = busqueda.trim() ? [...principales, ...archivados] : verArchivados ? archivados : principales;
    return filtrarChats({
      chats: base.map((uno) => ({ ...uno, titulo: title(uno.chat), ultimo: uno.chat.lastMessage?.body })),
      filtro: verArchivados ? 'todos' : filtro,
      texto: busqueda,
    }).map((uno) => uno.chat);
    // `agenda` está en las dependencias porque `title` la usa: sin ella, la
    // lista se quedaría con los nombres viejos al llegar la agenda.
  }, [principales, archivados, verArchivados, agenda, filtro, busqueda]);

  const cuentas = useMemo(() => contarChats(principales), [principales]);
  const archivadosSinLeer = useMemo(() => contarChats(archivados)['no-leidos'], [archivados]);

  // Sin archivados no hay nada que mirar: se vuelve solo a la principal.
  useEffect(() => {
    if (verArchivados && archivados.length === 0) setVerArchivados(false);
  }, [verArchivados, archivados.length]);

  const hayChats = (chats?.length ?? 0) > 0;

  /**
   * Selección múltiple, como WhatsApp: mantener presionada una fila entra al
   * modo y a partir de ahí un toque marca/desmarca. El modo ES «hay algo
   * seleccionado»; vaciar la selección sale del modo, sin un flag aparte.
   */
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const enSeleccion = seleccion.size > 0;

  const alternarSeleccion = useCallback((id: string) => {
    setSeleccion((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }, []);

  const limpiarSeleccion = useCallback(() => setSeleccion(new Set()), []);

  // Atrás deshace lo último, como WhatsApp: la selección, la búsqueda,
  // «Archivados»; recién después sale (lo decide `App`).
  useEffect(() => {
    if (!enSeleccion && !busqueda && !verArchivados) return;
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
      const accion = decidirAtras({
        pantalla: 'tabs',
        tab: 'chats',
        haySeleccion: enSeleccion,
        buscando: Boolean(busqueda),
        enArchivados: verArchivados,
      });
      if (accion === 'soltar-seleccion') limpiarSeleccion();
      else if (accion === 'limpiar-busqueda') setBusqueda('');
      else if (accion === 'cerrar-archivados') setVerArchivados(false);
      else return false;
      return true;
    });
    return () => suscripcion.remove();
  }, [enSeleccion, busqueda, verArchivados, limpiarSeleccion]);

  // En modo selección el toque marca/desmarca; fuera de él, abre. Mantener
  // presionado SIEMPRE entra al modo y marca esa fila.
  const alTocarFila = useCallback(
    (chat: ChatSummary) => (enSeleccion ? alternarSeleccion(chat.id) : onOpenChat(chat)),
    [enSeleccion, alternarSeleccion, onOpenChat]
  );

  // Un chat que desaparece de la lista (lo borré en otro teléfono) no puede
  // quedar seleccionado y fantasma en la barra de acciones.
  useEffect(() => {
    if (seleccion.size === 0) return;
    const vivos = new Set((chats ?? []).map((chat) => chat.id));
    setSeleccion((actual) => {
      const filtrada = new Set([...actual].filter((id) => vivos.has(id)));
      return filtrada.size === actual.size ? actual : filtrada;
    });
  }, [chats, seleccion.size]);

  /** Los chats seleccionados, resueltos a objeto (para la barra de acciones). */
  const chatsSeleccionados = useMemo(
    () => (chats ?? []).filter((chat) => seleccion.has(chat.id)),
    [chats, seleccion]
  );

  const acciones = useMemo(
    () =>
      accionesDeSeleccion(
        chatsSeleccionados.map((chat) => ({
          id: chat.id,
          esGrupo: chat.kind === 'group',
          muted: chat.muted === true,
          pinned: chat.pinned === true,
          unread: chat.unread,
          fechaOrden: msDe(chat.lastMessage?.at),
          archived: chat.archived === true,
          marcadoNoLeido: chat.markedUnread === true,
        }))
      ),
    [chatsSeleccionados]
  );

  const { aplicarAjuste, cambiarLectura, salirDeGrupos, eliminarChats } = useAccionesDeSeleccion({
    jwt: credential.jwt,
    seleccionados: chatsSeleccionados,
    limpiarSeleccion,
    recargar: load,
  });

  /**
   * El orden final: fijados arriba, cada grupo por recencia. Se aplica DESPUÉS
   * del filtro/buscador —lo que se ve— sobre `fechaOrden` = hora del último
   * mensaje; sin último mensaje va al fondo.
   */
  const ordenados = useMemo(
    () => ordenarChats(visibles.map((chat) => ({ chat, pinned: chat.pinned === true, fechaOrden: msDe(chat.lastMessage?.at) }))).map((uno) => uno.chat),
    [visibles]
  );

  return (
    <View className="flex-1 bg-background" testID="pantalla-chats">
      {/* Header del diseño: marca a la izquierda, avatar tocable a la derecha.
          El «Cerrar sesión» ya NO es un botón gigante al pie —eso no estaba en
          ningún diseño—: vive detrás del avatar, que es donde se lo busca. */}
      {/* Buscador y chips, como en WhatsApp. Solo cuando HAY chats: filtrar una
          lista vacía no lleva a ningún lado y ocupa la pantalla donde tiene que
          estar el vacío que explica qué hacer. */}
      {/* Barra de selección múltiple: reemplaza al buscador mientras hay algo
          marcado, como el app bar de WhatsApp. Las acciones se derivan del
          conjunto (motor `accionesDeSeleccion`): una sola acción por lote. */}
      {enSeleccion ? (
        <BarraDeSeleccionDeChats
          cantidad={seleccion.size}
          acciones={acciones}
          onCancelar={limpiarSeleccion}
          onLectura={(lectura) => void cambiarLectura(lectura)}
          onFijar={(pinned) => void aplicarAjuste({ pinned })}
          onSilenciar={(muted) => void aplicarAjuste({ muted })}
          onArchivar={(archived) => void aplicarAjuste({ archived })}
          onSalir={() => void salirDeGrupos()}
          onEliminar={eliminarChats}
        />
      ) : verArchivados ? (
        <CabeceraDeArchivados onVolver={() => setVerArchivados(false)} />
      ) : hayChats ? (
        <BuscadorDeChats busqueda={busqueda} onBuscar={setBusqueda} filtro={filtro} onFiltrar={setFiltro} cuentas={cuentas} />
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
          data={ordenados}
          keyExtractor={(chat) => chat.id}
          // Con el teclado abierto (buscando), el toque en un resultado ABRE el
          // chat. Sin esto el primer toque solo cerraba el teclado y había que
          // tocar dos veces (visto en el E2E de FL1).
          keyboardShouldPersistTaps="handled"
          // El vacío del FILTRO no es el vacío de la app: decir «sin
          // conversaciones» cuando hay diez y el filtro no devuelve ninguna
          // haría pensar que se perdieron.
          ListEmptyComponent={
            <View className="items-center px-8 pt-16" testID="chats-sin-coincidencias">
              <Text className="text-center text-sm leading-5 text-on-surface-variant">
                {busqueda
                  ? `Ningún chat coincide con «${busqueda}».`
                  : filtro === 'todos'
                    ? 'Todos tus chats están en Archivados.'
                    : filtro === 'no-leidos'
                    ? 'No te queda nada sin leer.'
                    : 'Todavía no tienes grupos.'}
              </Text>
            </View>
          }
          // «Archivados» arriba de todo, como WhatsApp (FL9), con cuántos de
          // ellos tienen algo sin leer. No se muestra buscando: ahí ya entran.
          ListHeaderComponent={
            !verArchivados && !busqueda.trim() && archivados.length > 0 ? (
              <FilaDeArchivados
                sinLeer={archivadosSinLeer}
                onAbrir={() => {
                  limpiarSeleccion();
                  setVerArchivados(true);
                }}
              />
            ) : null
          }
          // Resultados de buscar DENTRO de las conversaciones, debajo de los
          // chats que coinciden por nombre. Como WhatsApp: dos secciones.
          ListFooterComponent={
            busquedaValida(busqueda) && resultadosMensajes.length > 0 ? (
              <ResultadosDeMensajes
                resultados={resultadosMensajes}
                chats={chats}
                busqueda={busqueda}
                tituloDe={title}
                onAbrir={onOpenChat}
              />
            ) : null
          }
          // Virtualizada: un ScrollView monta TODAS las filas de una y la
          // lista tarda en aparecer en cuanto hay unas cuantas conversaciones.
          renderItem={({ item: chat }) => (
            <FilaDeChat
              chat={chat}
              titulo={title(chat)}
              miUserId={credential.userId}
              miFoto={credential.avatarUrl}
              marcado={seleccion.has(chat.id)}
              enLinea={puntoEnLinea(chat, credential.userId, onlineIds)}
              escribiendo={typingIn.has(chat.id)}
              borrador={borradores.get(chat.id)}
              onTocar={alTocarFila}
              onMantener={alternarSeleccion}
            />
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

      {/* FAB de conversación nueva: se esconde en modo selección — ahí el pulgar
          está en la barra de acciones, no creando un chat. */}
      {enSeleccion ? null : (
      <Pressable
        testID="btn-nuevo-chat"
        onPress={onNewChat}
        className="absolute bottom-5 right-5 h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-lg"
      >
        <PenSquare size={22} color={colores["on-primary"]} />
      </Pressable>
      )}

    </View>
  );
}

/** La hora del último mensaje en ms, para ordenar. Sin mensaje va al fondo. */
function msDe(at?: string): number {
  if (!at) return 0;
  const ms = Date.parse(at);
  return Number.isNaN(ms) ? 0 : ms;
}
