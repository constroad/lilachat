import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  Text,
  View,
} from 'react-native';
import { ProgramarMensajeModal } from './ProgramarMensajeModal';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { KeyboardAvoidingView, useKeyboardState } from 'react-native-keyboard-controller';
import { terminarCronometro } from '../diagnostico/diagnostico';
import { ChevronDown } from 'lucide-react-native';
import { formatDayLabel, startsNewDay } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { AttachSheet } from './AttachSheet';
import { CreateEventScreen } from '../agenda/CreateEventScreen';
import { CreatePollScreen } from '../agenda/CreatePollScreen';
import { CatchUpBanner } from './CatchUpBanner';
import { SecretChatBanner } from '../crypto/SecretChatBanner';
import { useSecretChat } from '../crypto/useSecretChat';
import { DaySeparator, MessageRow, isPending, type Row } from './MessageRow';
import { formatClock } from '@lilachat/shared';
import { abrirConOtraApp } from './guardarYCompartir';
import { Composer, type ComposerHandle } from './Composer';
import { previewDeMensaje } from './MessageRow';
import { ChatDetailScreen } from './ChatDetailScreen';
import { useChat } from './useChat';
import { useLlamadas } from '../calls/ProveedorDeLlamadas';
import { descartarMensaje, reintentarMensaje } from './outboxStore';
import { descartarArchivo, reintentarArchivo } from './colaDeArchivos';
import { useArchivosDelChat } from './useArchivosDelChat';
import { useLimpiarAvisoDelChat } from './useLimpiarAvisoDelChat';
import { SeleccionDeMensaje } from './SeleccionDeMensaje';
import { useProgramados } from './useProgramados';
import { VisorDelChat } from './VisorDelChat';
import { EncabezadoDelChat } from './EncabezadoDelChat';
import { EnviarFotos } from './EnviarFotos';
import { useAdjuntosDelChat } from './useAdjuntosDelChat';
import { sinOcultos, useOcultos } from './ocultos';
import { DivisorNoLeidos, useDivisorNoLeidos } from './useDivisorNoLeidos';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';
import { decidirAtras } from '../ui/botonAtras';
import { BuscadorDelChat } from './BuscadorDelChat';
import { useBuscarEnChat } from './useBuscarEnChat';
import { textoDeSubida } from './progresoDeSubida';
import { citadosPorSeq, tipoDeFila } from './filasDelChat';
import { useNombresDelGrupo } from './useNombresDelGrupo';
import { subtituloDelChat } from './cabeceraDelChat';
import { FondoDelChat } from './FondoDelChat';
import { useFinalDeLaConversacion } from './useFinalDeLaConversacion';

/**
 * La conversación (diseño Stitch «Chat de Grupo»). Burbuja propia a la derecha
 * en acento; la ajena a la izquierda en superficie — y la esquina-cola de 4px
 * apunta al emisor, que es el token `rounded-tail` de Vivid Pulse.
 */
/** El pie del composer con el teclado abierto (dp). */
const MARGEN_CON_TECLADO = 8;
/** El segundo `scrollToIndex`, cuando la zona ya se midió. */
const SEGUNDO_PASE_MS = 400;
/** Cuánto queda resaltado el original de una cita. */
const RESALTADO_DE_CITA_MS = 1500;

export function ChatScreen({
  chatId,
  chatName,
  chatAvatarUrl,
  credential,
  othersReadSeq,
  acuseDe,
  othersDeliveredSeq,
  unread,
  lastSeqInicial,
  encrypted,
  otherUserId,
  onBack,
}: {
  chatId: string;
  chatName: string;
  /** La foto del grupo, si tiene. Sin ella se dibuja la inicial. */
  chatAvatarUrl?: string;
  credential: Credential;
  othersReadSeq: number;
  /** Quiénes cuentan para el check azul (FL8): en un grupo, todos menos yo y Lila. */
  acuseDe?: readonly string[];
  othersDeliveredSeq: number;
  /** Cuántos sin leer traía la lista: decide si la banda de Lila aparece. */
  unread: number;
  /**
   * El `lastSeq` que el server reportó al abrir. Se marca leído HASTA acá, no
   * solo hasta el último mensaje cargado: si un mensaje del final se borró en
   * duro, `lastSeq` queda por delante y el cliente nunca llegaria a marcarlo
   * —dejando un «sin leer» fantasma que no baja (José, 31/08/2026)—. Abrir el
   * chat es haberlo visto todo lo que el server dice que hay.
   */
  lastSeqInicial?: number;
  /** Chat secreto (F9): cifra, y apaga a Lila. */
  encrypted?: boolean;
  otherUserId?: string | null;
  onBack: () => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const secreto = useSecretChat({
    credential,
    otherUserId: otherUserId ?? null,
    enabled: Boolean(encrypted),
  });
  const sesionLista = encrypted && secreto.estado === 'listo' ? secreto : null;
  useLimpiarAvisoDelChat(chatId);
  const {
    eliminar,
    editar,
    messages,
    pending,
    connected,
    othersRead,
    othersDelivered,
    enLinea,
    escribiendo,
    avisarEscribiendo,
    send,
    markRead,
    cargandoAnteriores,
    hayAnteriores,
    cargarAnteriores,
  } = useChat({
    chatId,
    token: credential.jwt,
    miUserId: credential.userId,
    seal: sesionLista?.seal,
    open: sesionLista?.open,
    acuseDe,
    baseLeido: othersReadSeq,
    baseEntregado: othersDeliveredSeq,
  });
  // El borrador vive en el Composer (FL2): una tecla ya no re-renderiza esto.
  const composerRef = useRef<ComposerHandle>(null);
  /** El mensaje al que se está respondiendo (deslizando sobre él), o null. */
  const [respondiendoA, setRespondiendoA] = useState<{ seq: number; texto: string; mio: boolean } | null>(null);
  const respondiendoRef = useRef(false);
  respondiendoRef.current = respondiendoA !== null;
  /** El mensaje propio que se está editando (José, 17/10/2026), o null. */
  const [editando, setEditando] = useState<{ seq: number; texto: string } | null>(null);
  const editandoRef = useRef(false);
  editandoRef.current = editando !== null;
  const alCancelarEdicion = useCallback(() => setEditando(null), []);
  const alEditar = useCallback(
    async (seq: number, texto: string) => {
      const resultado = await editar(seq, texto);
      if (!resultado.ok) {
        setMediaError(resultado.motivo ?? 'No se pudo editar.');
        return false;
      }
      setEditando(null);
      return true;
    },
    [editar]
  );

  // Mensajes programados (F11): long-press en enviar abre el modal.
  const programados = useProgramados({ jwt: credential.jwt, chatId, alProgramado: () => composerRef.current?.limpiar() });
  const [attachOpen, setAttachOpen] = useState(false);
  // Crear desde la conversación: el chat YA está elegido, así que las pantallas
  // de crear no vuelven a preguntar dónde.
  const [creando, setCreando] = useState<'event' | 'poll' | null>(null);
  const [falloCifrado, setFalloCifrado] = useState(false);
  // Las llamadas son de la sesión (FL8): suenan en cualquier pantalla.
  const { llamar } = useLlamadas();

  /**
   * El botón ATRÁS de Android vuelve a la lista, no cierra la app.
   *
   * Sin este manejador, Android aplica su comportamiento por defecto —cerrar la
   * actividad— y como esta app tiene una sola, eso es salir. José lo reportó el
   * 27/08/2026 estando en el chat con Wilson.
   *
   * Devolver `true` significa «ya me encargué»; `false` deja pasar a Android.
   */
  useEffect(() => {
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
      // FL9: primero se deshace lo que se está haciendo (selección, respuesta).
      const accion = decidirAtras({
        pantalla: 'chat',
        haySeleccion: elegidoRef.current !== null,
        editando: editandoRef.current,
        respondiendo: respondiendoRef.current,
        buscando: buscandoRef.current,
      });
      if (accion === 'soltar-seleccion') setElegido(null);
      else if (accion === 'limpiar-busqueda') cerrarBusquedaRef.current();
      else if (accion === 'cancelar-edicion') setEditando(null);
      else if (accion === 'cancelar-respuesta') setRespondiendoA(null);
      else if (accion === 'ir-a-lista') onBack();
      else return false;
      return true;
    });
    return () => suscripcion.remove();
  }, [onBack]);
  const [mediaError, setMediaError] = useState('');
  /** Las fotos elegidas que se están por mandar (FL9b); vacío = cerrado. */

  const archivosEnCola = useArchivosDelChat(chatId);
  const subidaEnCurso = archivosEnCola.find((uno) => uno.progreso !== undefined)?.progreso;
  /** La foto abierta a pantalla completa, o `null`. */
  /** El `seq` de la foto abierta a pantalla completa, o `null`. */
  const [viendoSeq, setViendoSeq] = useState<number | null>(null);
  /** El mensaje seleccionado con pulsación larga, o `null`. */
  const [elegido, setElegido] = useState<number | null>(null);
  const elegidoRef = useRef(elegido);
  elegidoRef.current = elegido;
  /** El mensaje resaltado un momento al saltar desde una cita (FL9). */
  const [resaltado, setResaltado] = useState<number | null>(null);
  const { ocultos, ocultar } = useOcultos(chatId);
  const [verDetalle, setVerDetalle] = useState(false);
  /**
   * Lo que se cambió en el detalle, para pintarlo YA en esta cabecera.
   *
   * Los props vienen de la lista, que es una foto del momento en que se abrió
   * el chat: sin esto, cambiar el nombre del grupo lo mostraba nuevo adentro
   * del detalle y viejo al cerrarlo, que se lee como que no se guardó.
   */
  const [infoPropia, setInfoPropia] = useState<{ name?: string; avatarUrl?: string }>({});


  /**
   * Terminar la grabación y mandarla.
   *
   * Pasa por el MISMO `upload` que una foto: la nota de voz es media como
   * cualquier otra, y duplicar el camino sería duplicar la cola, el progreso y
   * el manejo de errores.
   */
  const alEnviar = useCallback(
    async (texto: string, respondeA?: number) => {
      setRespondiendoA(null);
      // Lo que mando yo SIEMPRE se ve: aunque estuviera leyendo arriba.
      requestAnimationFrame(() => listaRef.current?.scrollToEnd({ animated: true }));
      const resultado = await send(texto, respondeA);
      // Si NO se pudo cifrar, el mensaje no salió y hay que decirlo: en un chat
      // con candado, un envío que falla en silencio engaña.
      if (resultado?.ok) return true;
      setFalloCifrado(true);
      return false;
    },
    [send]
  );
  const alAdjuntar = useCallback(() => setAttachOpen(true), []);
  const { fotosElegidas, cerrarFotos, alEnviarFotos, alCamara, alNotaDeVoz, pickFromCamera, pickFromGallery, pickFile } =
    useAdjuntosDelChat({ chatId, onError: setMediaError });
  // Por un ref: `pickFromCamera` se rearma en cada render y el Composer es memo.
  const alCancelarRespuesta = useCallback(() => setRespondiendoA(null), []);

  const nombreVisible = infoPropia.name ?? chatName;

  /**
   * El subtítulo del header: «escribiendo…» / «en línea» como WhatsApp.
   *
   * En un 1:1 se sabe quién es el otro (`otherUserId`). En un grupo puede
   * escribir cualquiera y acá no está la lista de miembros con sus nombres, así
   * que se dice que ALGUIEN escribe —nombrarlo pediría un fetch de miembros que
   * no vale la pena para un cartel—. «En línea» no se muestra en grupo: con
   * varios conectados sería ruido permanente.
   */
  const esGrupoChat = otherUserId === null || otherUserId === undefined;
  const otroEscribe = otherUserId ? escribiendo.has(otherUserId) : escribiendo.size > 0;
  const otroEnLinea = otherUserId ? enLinea.has(otherUserId) : false;
  const nombresDelGrupo = useNombresDelGrupo(chatId, credential.jwt, esGrupoChat);
  const subtitulo = subtituloDelChat({
    esGrupo: esGrupoChat,
    escriben: [...escribiendo],
    otroEnLinea,
    nombres: nombresDelGrupo,
    yo: credential.userId,
  });
  const fotoVisible = infoPropia.avatarUrl ?? chatAvatarUrl;

  /**
   * Las fotos del chat, en el formato que consume el visor.
   *
   * Se arman ACÁ y no en el visor: el nombre del autor sale de la agenda del
   * teléfono y la hora de un formateador nuestro. Un visor que resolviera eso
   * solo tendría que conocer la agenda, la sesión y el formato de fechas — tres
   * cosas que no son suyas.
   */
  const fotos = messages
    .filter((m) => m.media?.thumbUrl && !m.deletedAt)
    .map((m) => ({
      // El archivo COMPLETO, no la miniatura. Con `thumbUrl` el visor mostraba
      // una foto borrosa a pantalla completa —y un video no se reproducía nunca,
      // porque lo que le llegaba era su cuadro de portada en JPG—. La miniatura
      // sigue siendo la de la burbuja.
      url: m.media!.url ?? m.media!.thumbUrl!,
      mime: m.media!.mime,
      nombre: m.media!.fileName,
      cuandoReal: new Date(m.at),
      seq: m.seq,
      mia: m.senderId === credential.userId,
      // En un grupo, quién la mandó; antes decía el nombre del GRUPO.
      autor:
        m.senderId === credential.userId
          ? 'Tú'
          : esGrupoChat
            ? (nombresDelGrupo.get(String(m.senderId)) ?? chatName)
            : chatName,
      cuando: formatClock(new Date(m.at)),
      miniatura: m.media!.thumbUrl,
    }));


  /**
   * La foto en vuelo se suma como una fila pendiente mas. Va al FINAL: es lo
   * ultimo que mando la persona y tiene que verse abajo de todo, no intercalada.
   */
  /**
   * La lista, para poder mandarla al final.
   *
   * Hace falta porque con MENOS contenido que pantalla el ancla al fondo deja
   * la última fila debajo de la barra de escribir: se veía cortada hasta que la
   * persona scrolleaba. Con la conversación llena no pasa, así que el defecto
   * solo aparecía en chats nuevos — que ahora, con los avisos del grupo, es
   * todo grupo recién creado.
   */
  const listaRef = useRef<FlashListRef<Row> | null>(null);

  // Memoizadas: sin esto cada render (una tecla, un «escribiendo») rearmaba
  // las filas y la lista volvía a dibujar todas las burbujas (FL2).
  const rows: Row[] = useMemo(
    () => [
      // «Eliminar para mí» (FL9): ocultos en este teléfono.
      ...sinOcultos(messages, ocultos),
      ...pending,
      ...archivosEnCola.map(({ archivo, progreso }) => ({
        clientKey: archivo.clientKey,
        queuedAt: archivo.queuedAt,
        pending: true as const,
        mediaUri: archivo.uri,
        mediaMime: archivo.mimeType,
        mediaNombre: archivo.fileName,
        body: archivo.caption,
        progreso,
        fallo: archivo.fallo,
      })),
    ],
    [messages, ocultos, pending, archivosEnCola]
  );

  const { divisorSeq, noLeidos: noLeidosAlAbrir, irAlInicio } = useDivisorNoLeidos({
    rows,
    yo: credential.userId,
    noLeidos: unread,
    listaRef,
  });

  /** Llevar la lista a un mensaje (la cita y la búsqueda, FL9). */
  const irAMensaje = useCallback(
    (seq: number): boolean => {
      const indice = rows.findIndex((fila) => !isPending(fila) && fila.seq === seq);
      if (indice < 0) return false;
      listaRef.current?.scrollToIndex({ index: indice, animated: true, viewPosition: 0.4 });
      // Segundo pase: con alturas variables, si esa zona todavía no se midió el
      // primero cae corto o no se mueve (visto en el E2E con el chat recién abierto).
      setTimeout(() => listaRef.current?.scrollToIndex({ index: indice, animated: false, viewPosition: 0.4 }), SEGUNDO_PASE_MS);
      return true;
    },
    [rows]
  );

  /** Tocar una cita: al original, resaltado un momento (FL9). */
  const alTocarCita = useCallback(
    (seq: number) => {
      if (!irAMensaje(seq)) return setMediaError('El mensaje original está más arriba: sube para cargarlo.');
      setResaltado(seq);
      setTimeout(() => setResaltado((actual) => (actual === seq ? null : actual)), RESALTADO_DE_CITA_MS);
    },
    [irAMensaje]
  );

  // Buscar dentro del chat (FL9): sobre lo que se ve —sin lo «eliminado para mí»—.
  const visiblesParaBuscar = useMemo(() => sinOcultos(messages, ocultos), [messages, ocultos]);
  const busqueda = useBuscarEnChat({ mensajes: visiblesParaBuscar, irA: irAMensaje });
  const buscandoRef = useRef(false);
  buscandoRef.current = busqueda.activo;
  const cerrarBusquedaRef = useRef(busqueda.cerrar);
  cerrarBusquedaRef.current = busqueda.cerrar;

  const mensajeElegido = elegido === null ? null : (messages.find((mensaje) => mensaje.seq === elegido) ?? null);

  /** Las citas, una vez por cambio de mensajes (antes un `find` por fila y por render). */
  const citados = useMemo(
    () =>
      citadosPorSeq(
        messages,
        { yo: credential.userId, esGrupo: esGrupoChat, nombreDelOtro: nombreVisible, nombres: nombresDelGrupo },
        previewDeMensaje
      ),
    [messages, credential.userId, esGrupoChat, nombreVisible, nombresDelGrupo]
  );
  const leidoHasta = Math.max(othersReadSeq, othersRead);
  const entregadoHasta = Math.max(othersDeliveredSeq, othersDelivered);
  // En refs: `alVerImagen` tiene que ser estable (las burbujas son `memo`).
  const fotosRef = useRef(fotos);
  fotosRef.current = fotos;
  const mensajesRef = useRef(messages);
  mensajesRef.current = messages;
  /**
   * Tocar una foto, un video o un archivo. Lo que tiene miniatura va al visor;
   * un documento SIN miniatura (Word, Excel, zip, mp3: lila solo la genera
   * para PDF) no estaba en el visor y el toque no hacía nada (FL8). Ahora se
   * abre directo con la app del teléfono que sepa hacerlo.
   */
  const alVerImagen = useCallback((seq: number) => {
    if (fotosRef.current.some((foto) => foto.seq === seq)) return setViendoSeq(seq);
    const mensaje = mensajesRef.current.find((m) => m.seq === seq);
    if (!mensaje?.media?.url) return;
    void abrirConOtraApp({
      url: mensaje.media.url,
      cuando: new Date(mensaje.at),
      mime: mensaje.media.mime,
      seq,
      nombre: mensaje.media.fileName,
    }).then((r) => {
      if (!r.ok) setMediaError(r.motivo);
    });
  }, []);
  const alResponder = useCallback(
    (seq: number, texto: string, mio: boolean) => setRespondiendoA({ seq, texto, mio }),
    []
  );

  /**
   * Una fila. Estable mientras no cambien los mensajes ni los acuses: con
   * `MessageRow` memoizado, un mensaje nuevo dibuja SU burbuja y la de al lado
   * (por el agrupado), no la pantalla entera (FL2).
   */
  /**
   * Un mensaje que el server rechazó para siempre (FL8). Antes desaparecía sin
   * aviso; ahora se ve «No se envió» y se decide acá.
   */
  const archivosRef = useRef(archivosEnCola);
  archivosRef.current = archivosEnCola;
  const alFallido = useCallback((clientKey: string, motivo: string) => {
    // Texto y archivos viven en colas distintas: cada uno se reintenta en la suya.
    const esArchivo = archivosRef.current.some(({ archivo }) => archivo.clientKey === clientKey);
    Alert.alert('No se envió', motivo, [
      { text: 'Borrar', style: 'destructive', onPress: () => void (esArchivo ? descartarArchivo : descartarMensaje)(clientKey) },
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Reintentar', onPress: () => void (esArchivo ? reintentarArchivo : reintentarMensaje)(clientKey) },
    ]);
  }, []);

  const dibujarFila = useCallback(
    ({ item, index }: { item: Row; index: number }) => {
      const previous = rows[index - 1];
      const next = rows[index + 1];
      const at = isPending(item) ? item.queuedAt : item.at;
      const previousAt = previous ? (isPending(previous) ? previous.queuedAt : previous.at) : undefined;
      return (
        <>
          {startsNewDay(at, previousAt) ? <DaySeparator label={formatDayLabel(at)} /> : null}
          {!isPending(item) && item.seq === divisorSeq ? <DivisorNoLeidos cantidad={noLeidosAlAbrir} /> : null}
          <MessageRow
            item={item}
            previous={previous}
            next={next}
            myUserId={credential.userId}
            othersReadSeq={leidoHasta}
            othersDeliveredSeq={entregadoHasta}
            esGrupo={esGrupoChat}
            nombreAutor={isPending(item) ? undefined : nombresDelGrupo.get(String(item.senderId))}
            onVerImagen={alVerImagen}
            onSeleccionar={setElegido}
            onResponder={alResponder}
            citado={isPending(item) ? null : (citados.get(item.seq) ?? null)}
            seleccionado={!isPending(item) && (item.seq === elegido || item.seq === resaltado || item.seq === busqueda.seqActual)}
            onFallido={alFallido}
            onTocarCita={alTocarCita}
          />
        </>
      );
    },
    [rows, credential.userId, leidoHasta, entregadoHasta, esGrupoChat, nombresDelGrupo, alVerImagen, alResponder, citados, elegido, resaltado, busqueda.seqActual, divisorSeq, noLeidosAlAbrir, alFallido, alTocarCita]
  );

  const { alScrollear, abajoLejos, nuevosAbajo } = useFinalDeLaConversacion(listaRef, messages, credential.userId);

  // Con el teclado abierto no hay barra de navegación debajo: el margen del pie
  // dejaba un hueco entre el campo y el teclado (auditoría del 16/10).
  const tecladoAbierto = useKeyboardState((estado) => estado.isVisible);

  const hayContenido = rows.length > 0;
  useEffect(() => {
    if (!hayContenido) return;
    // Línea base de FL0 (spec §45): del toque en la lista a ver mensajes.
    terminarCronometro('abrir-chat');
    // Un tick después del primer pintado: antes de eso la lista todavía no
    // midió y el scroll no llega a ningún lado.
    // 150 ms y no 0: con 0 la lista todavía no midió y el scroll no llega a
    // ningún lado — probado en el emulador.
    // FL9: al divisor de no leídos si los hay; si no, al final.
    const t = setTimeout(irAlInicio, 150);
    return () => clearTimeout(t);
    // Solo al pasar de vacío a con contenido: reaccionar a cada mensaje pelearía
    // con quien está leyendo mensajes viejos más arriba.
  }, [hayContenido]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    // Hasta el MÁXIMO entre lo cargado y lo que el server dijo que existe: así
    // un mensaje final borrado en duro no deja un «sin leer» que no baja.
    const hasta = Math.max(last?.seq ?? 0, lastSeqInicial ?? 0);
    if (hasta > 0) markRead(hasta);
  }, [messages, markRead, lastSeqInicial]);

  return (
    <KeyboardAvoidingView
      // `style` y no `className`: NativeWind no estiliza componentes de terceros
      // y sin `flex: 1` la pantalla se aplastaba.
      style={{ flex: 1, backgroundColor: colores['fondo-chat'] }}
      /**
       * `padding` TAMBIEN en Android, y no es un descuido.
       *
       * Android trae `adjustResize` en el manifiesto, que historicamente
       * alcanzaba: el sistema encogia la ventana y el compositor subia solo. Pero
       * este proyecto tiene `edgeToEdgeEnabled=true` (Expo SDK 57), y con
       * edge-to-edge la ventana YA NO se encoge — la app dibuja por debajo del
       * teclado. Resultado: el campo de escribir desaparecia y quedaba una
       * pantalla vacia con el teclado encima (visto por Jose el 27/08/2026,
       * chateando con Wilson).
       */
      behavior="padding"
      testID="pantalla-chat"
    >
      {/**
       * Con un mensaje seleccionado, la cabecera se REEMPLAZA por la barra de
       * acciones — no se apila encima. Es lo que hace WhatsApp: mientras estás
       * eligiendo qué borrar, el nombre y las llamadas no sirven de nada, y dos
       * barras a la vez empujan la conversación fuera de la pantalla.
       */}
      {elegido !== null && mensajeElegido ? (
        <SeleccionDeMensaje
          mensaje={mensajeElegido}
          yo={credential.userId}
          chatSecreto={Boolean(encrypted)}
          onCancelar={() => setElegido(null)}
          onResponder={(seq) => alResponder(seq, previewDeMensaje(mensajeElegido), mensajeElegido.senderId === credential.userId)}
          onEliminarParaTodos={eliminar}
          onEliminarParaMi={ocultar}
          onEditar={(seq, texto) => {
            setRespondiendoA(null);
            setEditando({ seq, texto });
          }}
          onError={setMediaError}
        />
      ) : busqueda.activo ? (
        <BuscadorDelChat
          consulta={busqueda.consulta}
          onConsulta={busqueda.setConsulta}
          posicion={busqueda.posicion}
          total={busqueda.total}
          onAnterior={busqueda.anterior}
          onSiguiente={busqueda.siguiente}
          onCerrar={busqueda.cerrar}
        />
      ) : (
      <>
      <EncabezadoDelChat
        nombre={nombreVisible}
        foto={fotoVisible}
        secreto={Boolean(encrypted)}
        conectado={connected}
        subtitulo={subtitulo}
        otroEscribe={otroEscribe}
        puedeLlamar={Boolean(otherUserId)}
        onVolver={onBack}
        onAbrirDetalle={() => setVerDetalle(true)}
        onLlamar={(conVideo) => llamar(chatId, chatName, conVideo)}
      />
      </>
      )}

      {creando === 'event' ? (
        <CreateEventScreen
          visible
          credential={credential}
          fixedChat={{ id: chatId, name: chatName }}
          onClose={() => setCreando(null)}
          onCreated={() => setCreando(null)}
        />
      ) : creando === 'poll' ? (
        <CreatePollScreen
          visible
          credential={credential}
          fixedChat={{ id: chatId, name: chatName }}
          onClose={() => setCreando(null)}
          onCreated={() => setCreando(null)}
        />
      ) : null}

      {/* En un chat cifrado NO se ofrece «ponme al día»: Lila no puede leerlo,
          y un botón que siempre falla es peor que no tenerlo. */}
      {/* La pantalla de llamada se monta SOBRE el chat: al colgar se vuelve a
          la conversación, que es donde uno estaba. */}

      <ProgramarMensajeModal
        visible={programados.visible}
        texto={programados.texto}
        onProgramar={programados.programar}
        onCerrar={programados.cerrar}
      />

      {programados.aviso ? (
        <View className="mx-4 mb-1 rounded-lg bg-primary/[0.10] px-3 py-2" testID="aviso-programado">
          <Text className="text-[12px] text-primary">🗓️ Programado. {programados.aviso}.</Text>
        </View>
      ) : null}

      {falloCifrado ? (
        <Text className="px-4 pb-1 text-sm text-error" testID="error-cifrado">
          No se pudo cifrar el mensaje. No se envió.
        </Text>
      ) : null}

      {encrypted ? (
        <SecretChatBanner session={secreto} />
      ) : (
        <CatchUpBanner chatId={chatId} credential={credential} unread={unread} />
      )}

      <View className="flex-1">
        <FondoDelChat />
      <FlashList
          ref={listaRef}
          data={rows}
          // Cuando la lista terminó de montar, al final. Es el momento exacto en
          // que ya midió, sin adivinar con un temporizador.
          onLoad={irAlInicio}
          testID="lista-mensajes"
          /**
           * `flex-1` NO es cosmético: sin él la lista no está acotada por la
           * columna y su borde inferior queda DEBAJO de la barra de escribir. Con
           * la conversación llena no se nota —lo que sobra queda fuera de la
           * pantalla y el último mensaje cae justo arriba de la barra— pero con
           * pocos mensajes el contenido se ancla al fondo de la lista, o sea
           * tapado. Se vio con un grupo cuyo único contenido era un aviso: la
           * línea aparecía cortada a la mitad detrás del campo de texto.
           */
          className="flex-1"
          // El scroll hacia arriba trae los mensajes viejos, como WhatsApp. El
          // umbral es 0.5 pantallas: pedirlos recién al tocar el borde deja un
          // hueco visible mientras viajan.
          onStartReached={() => void cargarAnteriores()}
          onStartReachedThreshold={0.5}
          // `autoscrollToBottomThreshold`: si se está cerca del final (20 % de la
          // pantalla), lo que llega o se manda baja la lista solo, como
          // WhatsApp. Leyendo arriba, no mueve nada.
          maintainVisibleContentPosition={{ startRenderingFromBottom: true, autoscrollToBottomThreshold: 0.2 }}
          onScroll={alScrollear}
          scrollEventThrottle={100}
          ListHeaderComponent={
            cargandoAnteriores ? (
              <View className="items-center py-3" testID="cargando-anteriores">
                <ActivityIndicator color={colores.primary} />
              </View>
            ) : !hayAnteriores && rows.length > 0 ? (
              // El final de la conversación se DICE: sin esto, quien scrollea
              // hasta arriba no sabe si ya vio todo o si falta cargar.
              <Text className="py-3 text-center text-[11px] text-on-surface-variant">
                Este es el principio de la conversación
              </Text>
            ) : null
          }
          keyExtractor={(row) => (isPending(row) ? `p-${row.clientKey}` : `m-${row.seq}`)}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
          renderItem={dibujarFila}
          getItemType={tipoDeFila}
        />
        {abajoLejos ? (
          // «Bajar al final» con los que llegaron mientras se leía arriba, como
          // WhatsApp. Aparece solo lejos del final: abajo no hace falta.
          <Pressable
            testID="btn-bajar"
            accessibilityLabel="Ir al último mensaje"
            onPress={() => listaRef.current?.scrollToEnd({ animated: true })}
            className="absolute bottom-3 right-3 h-10 w-10 items-center justify-center rounded-full bg-surface shadow-md"
          >
            <ChevronDown size={22} color={colores['on-surface-variant']} />
            {nuevosAbajo > 0 ? (
              <View className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1">
                <Text className="text-[11px] font-bold text-on-primary" testID="nuevos-abajo">
                  {nuevosAbajo}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>


      {subidaEnCurso !== undefined ? (
        <Text className="px-4 pb-1 text-sm text-on-surface-variant" testID="subida-progreso">
          {textoDeSubida(subidaEnCurso)}
        </Text>
      ) : null}

      {mediaError ? (
        <Text className="px-4 pb-1 text-sm text-error" testID="error-media">
          {mediaError}
        </Text>
      ) : null}

      {/* La barra, tal como está COMPUESTA en el diseño — y no era «los mismos
          iconos en una fila»:
            · el «+» va PLANO, sin círculo de fondo;
            · hay UNA píldora larga y el emoji vive DENTRO, contra su borde;
            · a la derecha hay UN SOLO botón circular, y es excluyente:
              micrófono con el campo vacío, enviar apenas se escribe algo.
          La primera versión puso los cinco controles como hermanos: entraban
          todos, pero el campo quedaba tan angosto que el placeholder se partía
          en dos líneas. */}
      <Composer
        ref={composerRef}
        chatId={chatId}
        respondiendoA={respondiendoA}
        onCancelarRespuesta={alCancelarRespuesta}
        editando={editando}
        onCancelarEdicion={alCancelarEdicion}
        onEditar={alEditar}
        subiendo={false}
        margenPie={tecladoAbierto ? MARGEN_CON_TECLADO : margenes.pie}
        onAdjuntar={alAdjuntar}
        onCamara={alCamara}
        onEscribiendo={avisarEscribiendo}
        onEnviar={alEnviar}
        onProgramar={programados.abrir}
        onNotaDeVoz={alNotaDeVoz}
        // Chat secreto: sin clave no se manda nada; con clave, solo texto.
        modoSecreto={encrypted ? (sesionLista ? 'solo-texto' : 'bloqueado') : undefined}
      />

      <EnviarFotos fotos={fotosElegidas} onCancelar={cerrarFotos} onEnviar={(lista) => void alEnviarFotos(lista)} />

      <AttachSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        onPickCamera={() => void pickFromCamera()}
        onPickGallery={() => void pickFromGallery()}
        onCreateEvent={() => setCreando('event')}
        onCreatePoll={() => setCreando('poll')}
        onPickFile={() => void pickFile()}
      />
      <VisorDelChat
        fotos={fotos}
        viendoSeq={viendoSeq}
        onCambiar={setViendoSeq}
        onEliminar={eliminar}
        onError={setMediaError}
      />

      <ChatDetailScreen
        visible={verDetalle}
        chatId={chatId}
        chatName={nombreVisible}
        credential={credential}
        mensajes={messages}
        onInfoCambiada={(info) => setInfoPropia((antes) => ({ ...antes, ...info }))}
        onCerrar={() => setVerDetalle(false)}
        onSalio={() => {
          setVerDetalle(false);
          // Y afuera del chat: ya no es suyo.
          onBack();
        }}
        onLlamar={otherUserId ? (video) => llamar(chatId, chatName, video) : undefined}
        onVerImagen={(seq) => {
          setVerDetalle(false);
          alVerImagen(seq);
        }}
        onBuscar={() => {
          setVerDetalle(false);
          busqueda.abrir();
        }}
      />
    </KeyboardAvoidingView>
  );
}
